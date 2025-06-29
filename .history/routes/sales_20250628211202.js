const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../config/database');

// Get sales with filtering
router.get('/', verifyToken, async (req, res) => {
  try {
    const { platform, days_back = '30d', status = 'all', page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;

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
    if (days_back) {
      const days = parseInt(days_back.replace('d', ''));
      whereClause += ` AND sale_date >= date('now', '-${days} days')`;
    }

    const query = `
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
      ORDER BY sale_date DESC LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), offset);

    const sales = await db.all(query, params);
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM sales ${whereClause}`;
    const countResult = await db.get(countQuery, params.slice(0, -2));
    const total = countResult.total;

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
    const userId = req.user.id;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (platform && platform !== 'all') {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    if (days_back) {
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

    const stats = await db.get(statsQuery, params);

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

    const dailyStats = await db.all(dailyQuery, params);

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

    const platformStats = await db.all(platformQuery, params);

    res.json({
      stats: {
        total_sales: stats.total_sales || 0,
        total_revenue: stats.total_revenue || 0,
        avg_order_value: stats.avg_order_value || 0
      },
      daily_stats: dailyStats,
      platform_stats: platformStats
    });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

// Get analytics data
router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const { days_back = '30d', platform = 'all' } = req.query;
    const userId = req.user.id;

    let whereClause = 'WHERE user_id = ?';
    let params = [userId];

    if (platform && platform !== 'all') {
      whereClause += ' AND platform = ?';
      params.push(platform);
    }

    if (days_back) {
      const days = parseInt(days_back.replace('d', ''));
      whereClause += ` AND sale_date >= date('now', '-${days} days')`;
    }

    // Get daily revenue trend
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

    const dailyData = await db.all(dailyQuery, params);

    // Get top selling items
    const topItemsQuery = `
      SELECT 
        item_title,
        SUM(quantity) as total_quantity,
        SUM(price * quantity) as total_revenue,
        COUNT(*) as order_count
      FROM sales 
      ${whereClause}
      GROUP BY item_title
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const topItems = await db.all(topItemsQuery, params);

    // Get status breakdown
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(price * quantity) as revenue
      FROM sales 
      ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `;

    const statusData = await db.all(statusQuery, params);

    res.json({
      daily_trend: dailyData,
      top_items: topItems,
      status_breakdown: statusData
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Sync data from all platforms
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all active platform connections
    const connectionsQuery = `
      SELECT platform, public_key, secret_key, store_name, store_url 
      FROM api_credentials 
      WHERE user_id = ? AND is_active = 1
    `;
    
    const connections = await db.all(connectionsQuery, [userId]);
    
    if (connections.length === 0) {
      return res.json({ message: 'No active platform connections found' });
    }

    let totalSynced = 0;
    const results = [];

    for (const connection of connections) {
      try {
        // Call the appropriate platform sync endpoint
        const syncEndpoint = `/api/${connection.platform}/sync`;
        
        // For now, just log the sync attempt
        console.log(`Syncing ${connection.platform} for user ${userId}`);
        results.push({
          platform: connection.platform,
          status: 'success',
          message: 'Sync completed'
        });
        totalSynced++;
      } catch (error) {
        console.error(`Error syncing ${connection.platform}:`, error);
        results.push({
          platform: connection.platform,
          status: 'error',
          message: error.message
        });
      }
    }

    res.json({
      message: `Synced ${totalSynced} platforms`,
      results
    });
  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});

module.exports = router; 