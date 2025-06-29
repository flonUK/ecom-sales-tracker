const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// Get all sales data
router.get('/', verifyToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0, platform, search, days_back = 30 } = req.query;
    
    let query = `
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
      WHERE user_id = ?
    `;
    
    const params = [req.user.userId];
    
    // Add platform filter
    if (platform && platform !== 'all') {
      query += ' AND platform = ?';
      params.push(platform);
    }
    
    // Add date filter
    if (days_back) {
      query += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    // Add search filter
    if (search) {
      query += ' AND (item_title LIKE ? OR buyer_name LIKE ? OR order_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    // Add ordering and pagination
    query += ' ORDER BY sale_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const sales = await dbHelper.all(query, params);
    
    res.json({
      sales: sales || [],
      total: sales.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales data' });
  }
});

// Get sales statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { platform, days_back = 30 } = req.query;
    
    let query = `
      SELECT 
        platform,
        COUNT(*) as total_sales,
        SUM(quantity) as total_items,
        SUM(price * quantity) as total_revenue,
        AVG(price * quantity) as avg_order_value
      FROM sales 
      WHERE user_id = ?
    `;
    
    const params = [req.user.userId];
    
    // Add platform filter
    if (platform && platform !== 'all') {
      query += ' AND platform = ?';
      params.push(platform);
    }
    
    // Add date filter
    if (days_back) {
      query += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    query += ' GROUP BY platform ORDER BY total_revenue DESC';
    
    const stats = await dbHelper.all(query, params);
    
    // Calculate overall totals
    const totals = {
      total_sales: 0,
      total_items: 0,
      total_revenue: 0,
      avg_order_value: 0,
      platforms: {}
    };
    
    stats.forEach(stat => {
      totals.total_sales += stat.total_sales;
      totals.total_items += stat.total_items;
      totals.total_revenue += stat.total_revenue;
      
      if (!totals.platforms[stat.platform]) {
        totals.platforms[stat.platform] = {
          sales: 0,
          items: 0,
          revenue: 0
        };
      }
      
      totals.platforms[stat.platform].sales += stat.total_sales;
      totals.platforms[stat.platform].items += stat.total_items;
      totals.platforms[stat.platform].revenue += stat.total_revenue;
    });
    
    totals.avg_order_value = totals.total_sales > 0 ? totals.total_revenue / totals.total_sales : 0;
    
    // Get top products
    let productsQuery = `
      SELECT 
        item_title as name,
        platform,
        COUNT(*) as sales,
        SUM(price * quantity) as revenue
      FROM sales 
      WHERE user_id = ?
    `;
    
    const productParams = [req.user.userId];
    
    if (platform && platform !== 'all') {
      productsQuery += ' AND platform = ?';
      productParams.push(platform);
    }
    
    if (days_back) {
      productsQuery += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    productsQuery += ' GROUP BY item_title ORDER BY revenue DESC LIMIT 5';
    
    const products = await dbHelper.all(productsQuery, productParams);
    
    // Get recent activity
    let activityQuery = `
      SELECT 
        item_title as item,
        platform,
        price * quantity as revenue,
        sale_date as date
      FROM sales 
      WHERE user_id = ?
    `;
    
    const activityParams = [req.user.userId];
    
    if (platform && platform !== 'all') {
      activityQuery += ' AND platform = ?';
      activityParams.push(platform);
    }
    
    if (days_back) {
      activityQuery += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    activityQuery += ' ORDER BY sale_date DESC LIMIT 5';
    
    const activities = await dbHelper.all(activityQuery, activityParams);
    
    const response = {
      totalRevenue: totals.total_revenue || 0,
      totalSales: totals.total_sales || 0,
      totalItems: totals.total_items || 0,
      avgOrderValue: totals.avg_order_value || 0,
      profitMargin: 0, // Will be calculated when we have cost data
      adSpend: 0, // Would need separate tracking
      roas: 0, // Would need ad spend data
      topProducts: products.map(p => ({
        name: p.name,
        sales: p.sales,
        revenue: p.revenue,
        platform: p.platform
      })),
      platformBreakdown: stats.map(p => ({
        platform: p.platform,
        revenue: p.total_revenue,
        sales: p.total_sales,
        margin: 0 // Will be calculated when we have cost data
      })),
      recentActivity: activities.map(a => ({
        platform: a.platform,
        item: a.item,
        revenue: a.revenue,
        time: new Date(a.date).toLocaleDateString()
      }))
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales statistics' });
  }
});

// Get analytics data
router.get('/analytics', verifyToken, async (req, res) => {
  try {
    const { days_back = 30, platform } = req.query;
    
    // Get revenue trend
    let trendQuery = `
      SELECT 
        date(sale_date) as date,
        SUM(price * quantity) as revenue,
        COUNT(*) as sales
      FROM sales 
      WHERE user_id = ?
    `;
    
    const params = [req.user.userId];
    
    if (platform && platform !== 'all') {
      trendQuery += ' AND platform = ?';
      params.push(platform);
    }
    
    if (days_back) {
      trendQuery += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    trendQuery += ' GROUP BY date(sale_date) ORDER BY date(sale_date)';
    
    const trends = await dbHelper.all(trendQuery, params);
    
    // Get platform breakdown
    let platformQuery = `
      SELECT 
        platform,
        COUNT(*) as sales,
        SUM(price * quantity) as revenue
      FROM sales 
      WHERE user_id = ?
    `;
    
    const platformParams = [req.user.userId];
    
    if (platform && platform !== 'all') {
      platformQuery += ' AND platform = ?';
      platformParams.push(platform);
    }
    
    if (days_back) {
      platformQuery += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    platformQuery += ' GROUP BY platform ORDER BY revenue DESC';
    
    const platforms = await dbHelper.all(platformQuery, platformParams);
    
    // Get top products
    let productsQuery = `
      SELECT 
        item_title as name,
        platform,
        COUNT(*) as sales,
        SUM(price * quantity) as revenue
      FROM sales 
      WHERE user_id = ?
    `;
    
    const productParams = [req.user.userId];
    
    if (platform && platform !== 'all') {
      productsQuery += ' AND platform = ?';
      productParams.push(platform);
    }
    
    if (days_back) {
      productsQuery += ' AND sale_date >= date("now", "-' + days_back + ' days")';
    }
    
    productsQuery += ' GROUP BY item_title ORDER BY revenue DESC LIMIT 10';
    
    const products = await dbHelper.all(productsQuery, productParams);
    
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
    
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

module.exports = router; 