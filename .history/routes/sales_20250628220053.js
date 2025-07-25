const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

// Get sales with filtering
router.get('/', verifyToken, async (req, res) => {
  try {
    const { platform, days_back = '30d', status = 'all', page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.userId;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    // Add platform filter
    if (platform && platform !== 'all') {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    // Add status filter
    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Add date filter
    if (days_back && days_back !== 'all') {
      const days = parseInt(days_back.replace('d', ''));
      whereClause += ` AND sale_date >= date('now', '-${days} days')`;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM sales ${whereClause}`;
    const countResult = await dbHelper.get(countQuery, params);
    const total = countResult.total;

    // Get sales data
    const salesQuery = `
      SELECT 
        id,
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
        created_at
      FROM sales 
      ${whereClause} 
      ORDER BY sale_date DESC 
      LIMIT ? OFFSET ?
    `;
    
    const sales = await dbHelper.all(salesQuery, [...params, limit, offset]);

    res.json({
      sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get sales statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = '30d', platform = 'all' } = req.query;
    const userId = req.user.userId;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    // Add platform filter
    if (platform && platform !== 'all') {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    // Add date filter
    if (days_back && days_back !== 'all') {
      const days = parseInt(days_back.replace('d', ''));
      whereClause += ` AND sale_date >= date('now', '-${days} days')`;
    }

    // Get total revenue and sales count
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(price * quantity) as total_revenue,
        AVG(price * quantity) as avg_order_value
      FROM sales 
      ${whereClause}
    `;
    
    const stats = await dbHelper.get(statsQuery, params);

    // Get daily revenue for chart
    const dailyQuery = `
      SELECT 
        date(sale_date) as date,
        SUM(price * quantity) as revenue,
        COUNT(*) as sales
      FROM sales 
      ${whereClause}
      GROUP BY date(sale_date) 
      ORDER BY date(sale_date)
    `;
    
    const dailyData = await dbHelper.all(dailyQuery, params);

    // Get platform breakdown
    const platformQuery = `
      SELECT 
        platform,
        COUNT(*) as sales,
        SUM(price * quantity) as revenue
      FROM sales 
      ${whereClause}
      GROUP BY platform
      ORDER BY revenue DESC
    `;
    
    const platformData = await dbHelper.all(platformQuery, params);

    res.json({
      stats: {
        total_sales: stats.total_sales || 0,
        total_revenue: stats.total_revenue || 0,
        avg_order_value: stats.avg_order_value || 0
      },
      daily_data: dailyData,
      platform_data: platformData
    });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

// Sync data from all platforms
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get all active platform connections
    const connectionsQuery = `
      SELECT platform, store_id, public_key, secret_key, store_name, store_url 
      FROM api_credentials 
      WHERE user_id = ? AND is_active = 1
    `;
    
    const connections = await dbHelper.all(connectionsQuery, [userId]);
    
    if (connections.length === 0) {
      return res.json({ message: 'No active platform connections found' });
    }

    let totalSynced = 0;
    const results = [];

    for (const connection of connections) {
      try {
        console.log(`Syncing ${connection.platform} for user ${userId}`);
        
        if (connection.platform === 'swell') {
          // Call Swell sync directly
          const { syncSwellData } = require('./swell');
          const swellResult = await syncSwellData(userId, connection);
          results.push({ platform: 'swell', success: true, data: swellResult });
          totalSynced += swellResult.salesCount || 0;
        }
        // Add other platforms here as needed
      } catch (error) {
        console.error(`Error syncing ${connection.platform}:`, error);
        results.push({ platform: connection.platform, success: false, error: error.message });
      }
    }

    res.json({ 
      message: `Sync completed. Total sales synced: ${totalSynced}`,
      results 
    });
  } catch (error) {
    console.error('Error during sync:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

module.exports = router; 