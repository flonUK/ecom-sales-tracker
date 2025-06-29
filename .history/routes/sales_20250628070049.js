const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// Get all sales from all connected platforms
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
      platform, 
      limit = 50, 
      offset = 0, 
      start_date, 
      end_date,
      sort_by = 'sale_date',
      sort_order = 'DESC'
    } = req.query;

    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.userId];

    // Add platform filter
    if (platform) {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    // Add date range filter
    if (start_date) {
      whereClause += ' AND sale_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sale_date <= ?';
      params.push(end_date);
    }

    // Validate sort parameters
    const allowedSortFields = ['sale_date', 'price', 'item_title', 'platform', 'buyer_name'];
    const allowedSortOrders = ['ASC', 'DESC'];
    
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'sale_date';
    const sortOrder = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';

    // Get sales with pagination
    const sales = await dbHelper.all(
      `SELECT * FROM sales ${whereClause} 
       ORDER BY ${sortField} ${sortOrder} 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await dbHelper.get(
      `SELECT COUNT(*) as total FROM sales ${whereClause}`,
      params
    );

    res.json({
      sales,
      count: sales.length,
      total: countResult.total,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + sales.length < countResult.total
      }
    });

  } catch (error) {
    console.error('Sales fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get sales analytics
router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const { start_date, end_date, platform } = req.query;

    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.userId];

    if (platform) {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    if (start_date) {
      whereClause += ' AND sale_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sale_date <= ?';
      params.push(end_date);
    }

    // Total revenue
    const revenueResult = await dbHelper.get(
      `SELECT SUM(price * quantity) as total_revenue, COUNT(*) as total_sales 
       FROM sales ${whereClause}`,
      params
    );

    // Revenue by platform
    const platformRevenue = await dbHelper.all(
      `SELECT platform, SUM(price * quantity) as revenue, COUNT(*) as sales_count 
       FROM sales ${whereClause} 
       GROUP BY platform 
       ORDER BY revenue DESC`,
      params
    );

    // Revenue by month
    const monthlyRevenue = await dbHelper.all(
      `SELECT 
         strftime('%Y-%m', sale_date) as month,
         SUM(price * quantity) as revenue,
         COUNT(*) as sales_count
       FROM sales ${whereClause} 
       GROUP BY strftime('%Y-%m', sale_date) 
       ORDER BY month DESC 
       LIMIT 12`,
      params
    );

    // Top selling items
    const topItems = await dbHelper.all(
      `SELECT 
         item_title,
         platform,
         SUM(quantity) as total_quantity,
         SUM(price * quantity) as total_revenue,
         COUNT(*) as sales_count
       FROM sales ${whereClause} 
       GROUP BY item_title, platform 
       ORDER BY total_revenue DESC 
       LIMIT 10`,
      params
    );

    // Recent activity
    const recentActivity = await dbHelper.all(
      `SELECT platform, COUNT(*) as new_sales, SUM(price * quantity) as new_revenue 
       FROM sales ${whereClause} 
       AND sale_date >= date('now', '-7 days') 
       GROUP BY platform`,
      params
    );

    res.json({
      summary: {
        totalRevenue: revenueResult.total_revenue || 0,
        totalSales: revenueResult.total_sales || 0,
        averageOrderValue: revenueResult.total_sales > 0 ? (revenueResult.total_revenue / revenueResult.total_sales) : 0
      },
      platformRevenue,
      monthlyRevenue,
      topItems,
      recentActivity
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get sales by platform
router.get('/platform/:platform', verifyToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const sales = await dbHelper.all(
      `SELECT * FROM sales 
       WHERE user_id = ? AND platform = ? 
       ORDER BY sale_date DESC 
       LIMIT ? OFFSET ?`,
      [req.user.userId, platform, parseInt(limit), parseInt(offset)]
    );

    const countResult = await dbHelper.get(
      'SELECT COUNT(*) as total FROM sales WHERE user_id = ? AND platform = ?',
      [req.user.userId, platform]
    );

    res.json({
      sales,
      count: sales.length,
      total: countResult.total,
      platform
    });

  } catch (error) {
    console.error('Platform sales error:', error);
    res.status(500).json({ error: 'Failed to fetch platform sales' });
  }
});

// Export sales data
router.get('/export', verifyToken, async (req, res) => {
  try {
    const { format = 'json', platform, start_date, end_date } = req.query;

    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.userId];

    if (platform) {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    if (start_date) {
      whereClause += ' AND sale_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sale_date <= ?';
      params.push(end_date);
    }

    const sales = await dbHelper.all(
      `SELECT * FROM sales ${whereClause} ORDER BY sale_date DESC`,
      params
    );

    if (format === 'csv') {
      const csvHeader = 'Platform,Order ID,Item Title,Item ID,Quantity,Price,Currency,Buyer Name,Buyer Email,Sale Date,Status,Shipping Address,Tracking Number\n';
      const csvData = sales.map(sale => 
        `"${sale.platform}","${sale.order_id}","${sale.item_title}","${sale.item_id}",${sale.quantity},${sale.price},"${sale.currency}","${sale.buyer_name}","${sale.buyer_email}","${sale.sale_date}","${sale.status}","${sale.shipping_address}","${sale.tracking_number}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-export.csv');
      res.send(csvHeader + csvData);
    } else {
      res.json({ sales, count: sales.length });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export sales data' });
  }
});

// Get sync history
router.get('/sync-history', verifyToken, async (req, res) => {
  try {
    const { platform, limit = 20 } = req.query;

    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.userId];

    if (platform) {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    const history = await dbHelper.all(
      `SELECT * FROM sync_history ${whereClause} 
       ORDER BY sync_date DESC 
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    res.json({ history });

  } catch (error) {
    console.error('Sync history error:', error);
    res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

// Delete sales data
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbHelper.run(
      'DELETE FROM sales WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json({ message: 'Sale deleted successfully' });

  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ error: 'Failed to delete sale' });
  }
});

module.exports = router; 