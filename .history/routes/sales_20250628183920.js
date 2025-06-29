const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();

// Database setup
const dbPath = path.join(__dirname, '../data/sales.db');
const db = new sqlite3.Database(dbPath);

// Get all sales data (combines from all platforms)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, platform, search } = req.query;
    
    let query = `
      SELECT 
        s.*,
        CASE 
          WHEN s.order_id LIKE 'sample-%' THEN 'sample'
          ELSE 'real'
        END as data_source
      FROM sales s 
      WHERE s.user_id = ?
    `;
    
    const params = [req.user.userId];
    
    // Add platform filter
    if (platform && platform !== 'all') {
      query += ' AND s.platform = ?';
      params.push(platform);
    }
    
    // Add search filter
    if (search) {
      query += ' AND (s.item_title LIKE ? OR s.buyer_name LIKE ? OR s.order_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const sales = await dbHelper.all(query, params);
    
    // Check if any sales are using sample data
    const hasSampleData = sales.some(sale => sale.data_source === 'sample');
    const hasRealData = sales.some(sale => sale.data_source === 'real');
    
    // Determine overall demo mode status
    const demoMode = hasSampleData || (!hasRealData && sales.length > 0);
    
    res.json({
      sales,
      total: sales.length,
      demoMode,
      message: demoMode ? 
        'Sample data mode: Add API credentials to .env for real data' :
        'Real sales data from connected platforms'
    });
    
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Get sales statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { platform, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        platform,
        COUNT(*) as total_sales,
        SUM(quantity) as total_items,
        SUM(price * quantity) as total_revenue,
        AVG(price) as avg_price,
        COUNT(DISTINCT DATE(sale_date)) as active_days,
        CASE 
          WHEN order_id LIKE 'sample-%' THEN 'sample'
          ELSE 'real'
        END as data_source
      FROM sales 
      WHERE user_id = ?
    `;
    
    const params = [req.user.userId];
    
    // Add platform filter
    if (platform && platform !== 'all') {
      query += ' AND platform = ?';
      params.push(platform);
    }
    
    // Add date filters
    if (start_date) {
      query += ' AND sale_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND sale_date <= ?';
      params.push(end_date);
    }
    
    query += ' GROUP BY platform, data_source ORDER BY total_revenue DESC';
    
    const stats = await dbHelper.all(query, params);
    
    // Calculate overall totals
    const totals = {
      total_sales: 0,
      total_items: 0,
      total_revenue: 0,
      platforms: {},
      demoMode: false
    };
    
    let hasSampleData = false;
    let hasRealData = false;
    
    stats.forEach(stat => {
      totals.total_sales += stat.total_sales;
      totals.total_items += stat.total_items;
      totals.total_revenue += stat.total_revenue;
      
      if (stat.data_source === 'sample') hasSampleData = true;
      if (stat.data_source === 'real') hasRealData = true;
      
      if (!totals.platforms[stat.platform]) {
        totals.platforms[stat.platform] = {
          sales: 0,
          items: 0,
          revenue: 0,
          data_source: stat.data_source
        };
      }
      
      totals.platforms[stat.platform].sales += stat.total_sales;
      totals.platforms[stat.platform].items += stat.total_items;
      totals.platforms[stat.platform].revenue += stat.total_revenue;
    });
    
    totals.demoMode = hasSampleData || (!hasRealData && totals.total_sales > 0);
    
    res.json({
      stats,
      totals,
      demoMode: totals.demoMode,
      message: totals.demoMode ? 
        'Sample data mode: Add API credentials to .env for real data' :
        'Real sales data from connected platforms'
    });
    
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

// Export sales data
router.get('/export', verifyToken, async (req, res) => {
  try {
    const { format = 'csv', platform, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        platform,
        order_id,
        item_title,
        item_id,
        quantity,
        price,
        currency,
        buyer_name,
        buyer_email,
        sale_date,
        status,
        shipping_address,
        tracking_number,
        CASE 
          WHEN order_id LIKE 'sample-%' THEN 'sample'
          ELSE 'real'
        END as data_source
      FROM sales 
      WHERE user_id = ?
    `;
    
    const params = [req.user.userId];
    
    // Add platform filter
    if (platform && platform !== 'all') {
      query += ' AND platform = ?';
      params.push(platform);
    }
    
    // Add date filters
    if (start_date) {
      query += ' AND sale_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND sale_date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY sale_date DESC';
    
    const sales = await dbHelper.all(query, params);
    
    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Platform', 'Order ID', 'Item Title', 'Item ID', 'Quantity', 
        'Price', 'Currency', 'Buyer Name', 'Buyer Email', 'Sale Date', 
        'Status', 'Shipping Address', 'Tracking Number', 'Data Source'
      ];
      
      const csvRows = [headers];
      
      sales.forEach(sale => {
        csvRows.push([
          sale.platform,
          sale.order_id,
          sale.item_title,
          sale.item_id,
          sale.quantity,
          sale.price,
          sale.currency,
          sale.buyer_name,
          sale.buyer_email || '',
          new Date(sale.sale_date).toISOString().split('T')[0],
          sale.status,
          sale.shipping_address || '',
          sale.tracking_number || '',
          sale.data_source
        ]);
      });
      
      const csvContent = csvRows.map(row => 
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sales-export-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
      
    } else {
      // Return JSON
      const hasSampleData = sales.some(sale => sale.data_source === 'sample');
      const hasRealData = sales.some(sale => sale.data_source === 'real');
      const demoMode = hasSampleData || (!hasRealData && sales.length > 0);
      
      res.json({
        sales,
        total: sales.length,
        demoMode,
        exportDate: new Date().toISOString(),
        message: demoMode ? 
          'Sample data mode: Add API credentials to .env for real data' :
          'Real sales data from connected platforms'
      });
    }
    
  } catch (error) {
    console.error('Error exporting sales:', error);
    res.status(500).json({ error: 'Failed to export sales data' });
  }
});

// Get recent sales (last 10)
router.get('/recent', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.*,
        CASE 
          WHEN s.order_id LIKE 'sample-%' THEN 'sample'
          ELSE 'real'
        END as data_source
      FROM sales s 
      WHERE s.user_id = ? 
      ORDER BY s.sale_date DESC 
      LIMIT 10
    `;
    
    const sales = await dbHelper.all(query, [req.user.userId]);
    
    const hasSampleData = sales.some(sale => sale.data_source === 'sample');
    const hasRealData = sales.some(sale => sale.data_source === 'real');
    const demoMode = hasSampleData || (!hasRealData && sales.length > 0);
    
    res.json({
      sales,
      demoMode,
      message: demoMode ? 
        'Sample data mode: Add API credentials to .env for real data' :
        'Real sales data from connected platforms'
    });
    
  } catch (error) {
    console.error('Error fetching recent sales:', error);
    res.status(500).json({ error: 'Failed to fetch recent sales' });
  }
});

// Get sales data
router.get('/data', async (req, res) => {
  try {
    const { platform, days_back = 30, status } = req.query;
    
    let query = `
      SELECT 
        s.*,
        p.name as platform_name
      FROM sales s
      LEFT JOIN platforms p ON s.platform_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (platform && platform !== 'all') {
      query += ` AND p.name = ?`;
      params.push(platform);
    }
    
    if (days_back) {
      query += ` AND s.sale_date >= date('now', '-${days_back} days')`;
    }
    
    if (status && status !== 'all') {
      query += ` AND s.status = ?`;
      params.push(status);
    }
    
    query += ` ORDER BY s.sale_date DESC`;
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Transform data to match frontend expectations
      const sales = rows.map(row => ({
        date: row.sale_date,
        platform: row.platform_name || row.platform,
        item: row.item_title,
        orderId: row.order_id,
        revenue: row.price * row.quantity,
        status: row.status,
        sku: row.sku
      }));
      
      res.json(sales);
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales statistics
router.get('/stats', async (req, res) => {
  try {
    const { days_back = 30, platform } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(price * quantity) as total_revenue,
        AVG(price * quantity) as avg_order_value,
        COUNT(DISTINCT platform_id) as platforms_count
      FROM sales s
      LEFT JOIN platforms p ON s.platform_id = p.id
      WHERE s.sale_date >= date('now', '-${days_back} days')
    `;
    
    const params = [];
    
    if (platform && platform !== 'all') {
      query += ` AND p.name = ?`;
      params.push(platform);
    }
    
    db.get(query, params, (err, stats) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get platform breakdown
      let platformQuery = `
        SELECT 
          p.name as platform,
          COUNT(*) as sales,
          SUM(s.price * s.quantity) as revenue,
          AVG(s.price * s.quantity) as avg_order
        FROM sales s
        LEFT JOIN platforms p ON s.platform_id = p.id
        WHERE s.sale_date >= date('now', '-${days_back} days')
      `;
      
      if (platform && platform !== 'all') {
        platformQuery += ` AND p.name = ?`;
      }
      
      platformQuery += ` GROUP BY p.name ORDER BY revenue DESC`;
      
      db.all(platformQuery, platform && platform !== 'all' ? [platform] : [], (err, platforms) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Get top products
        let productsQuery = `
          SELECT 
            s.item_title as name,
            p.name as platform,
            COUNT(*) as sales,
            SUM(s.price * s.quantity) as revenue
          FROM sales s
          LEFT JOIN platforms p ON s.platform_id = p.id
          WHERE s.sale_date >= date('now', '-${days_back} days')
        `;
        
        if (platform && platform !== 'all') {
          productsQuery += ` AND p.name = ?`;
        }
        
        productsQuery += ` GROUP BY s.item_title ORDER BY revenue DESC LIMIT 5`;
        
        db.all(productsQuery, platform && platform !== 'all' ? [platform] : [], (err, products) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Get recent activity
          let activityQuery = `
            SELECT 
              s.item_title as item,
              p.name as platform,
              s.price * s.quantity as revenue,
              s.sale_date as date
            FROM sales s
            LEFT JOIN platforms p ON s.platform_id = p.id
            WHERE s.sale_date >= date('now', '-${days_back} days')
          `;
          
          if (platform && platform !== 'all') {
            activityQuery += ` AND p.name = ?`;
          }
          
          activityQuery += ` ORDER BY s.sale_date DESC LIMIT 5`;
          
          db.all(activityQuery, platform && platform !== 'all' ? [platform] : [], (err, activities) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            const response = {
              totalRevenue: stats.total_revenue || 0,
              totalSales: stats.total_sales || 0,
              totalItems: stats.total_sales || 0,
              avgOrderValue: stats.avg_order_value || 0,
              profitMargin: 25.0, // Default margin
              adSpend: 0, // Would need separate tracking
              roas: 0, // Would need ad spend data
              topProducts: products.map(p => ({
                name: p.name,
                sales: p.sales,
                revenue: p.revenue,
                platform: p.platform
              })),
              platformBreakdown: platforms.map(p => ({
                platform: p.platform,
                revenue: p.revenue,
                sales: p.sales,
                margin: 25.0 // Default margin
              })),
              recentActivity: activities.map(a => ({
                platform: a.platform,
                item: a.item,
                revenue: a.revenue,
                time: new Date(a.date).toLocaleDateString()
              }))
            };
            
            res.json(response);
          });
        });
      });
    });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analytics data
router.get('/analytics', async (req, res) => {
  try {
    const { days_back = 30, platform } = req.query;
    
    // Get revenue trend (daily for last 7 days, weekly for longer periods)
    let trendQuery = `
      SELECT 
        date(sale_date) as date,
        SUM(price * quantity) as revenue,
        COUNT(*) as sales
      FROM sales s
      LEFT JOIN platforms p ON s.platform_id = p.id
      WHERE s.sale_date >= date('now', '-${days_back} days')
    `;
    
    const params = [];
    
    if (platform && platform !== 'all') {
      trendQuery += ` AND p.name = ?`;
      params.push(platform);
    }
    
    trendQuery += ` GROUP BY date(sale_date) ORDER BY date(sale_date)`;
    
    db.all(trendQuery, params, (err, trends) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get platform breakdown
      let platformQuery = `
        SELECT 
          p.name as platform,
          COUNT(*) as sales,
          SUM(s.price * s.quantity) as revenue
        FROM sales s
        LEFT JOIN platforms p ON s.platform_id = p.id
        WHERE s.sale_date >= date('now', '-${days_back} days')
      `;
      
      if (platform && platform !== 'all') {
        platformQuery += ` AND p.name = ?`;
      }
      
      platformQuery += ` GROUP BY p.name ORDER BY revenue DESC`;
      
      db.all(platformQuery, platform && platform !== 'all' ? [platform] : [], (err, platforms) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Get top products
        let productsQuery = `
          SELECT 
            s.item_title as name,
            p.name as platform,
            COUNT(*) as sales,
            SUM(s.price * s.quantity) as revenue
          FROM sales s
          LEFT JOIN platforms p ON s.platform_id = p.id
          WHERE s.sale_date >= date('now', '-${days_back} days')
        `;
        
        if (platform && platform !== 'all') {
          productsQuery += ` AND p.name = ?`;
        }
        
        productsQuery += ` GROUP BY s.item_title ORDER BY revenue DESC LIMIT 10`;
        
        db.all(productsQuery, platform && platform !== 'all' ? [platform] : [], (err, products) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          const response = {
            revenueTrend: trends.map(t => ({
              date: t.date,
              value: t.revenue
            })),
            salesTrend: trends.map(t => ({
              date: t.date,
              value: t.sales
            })),
            platformBreakdown: platforms.map(p => ({
              platform: p.platform,
              revenue: p.revenue,
              sales: p.sales
            })),
            topProducts: products.map(p => ({
              name: p.name,
              platform: p.platform,
              revenue: p.revenue,
              sales: p.sales
            })),
            categoryBreakdown: [], // Would need category data
            customerMetrics: {
              newCustomers: 0, // Would need customer tracking
              returningCustomers: 0,
              avgCustomerValue: 0
            }
          };
          
          res.json(response);
        });
      });
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 