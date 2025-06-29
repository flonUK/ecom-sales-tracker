const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

// Normalize status for filtering and display
const normalizeStatus = (status) => {
  if (!status) return 'unknown';
  const lowerStatus = status.toLowerCase();
  
  // Map Swell statuses to standard statuses
  if (lowerStatus === 'complete') return 'completed';
  if (lowerStatus === 'delivery_pending') return 'pending';
  
  return lowerStatus;
};

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

    // Add status filter with normalization
    if (status && status !== 'all') {
      // Handle normalized status filtering
      if (status === 'completed') {
        whereClause += ' AND (status = ? OR status = ?)';
        params.push('completed', 'complete');
      } else if (status === 'pending') {
        whereClause += ' AND (status = ? OR status = ?)';
        params.push('pending', 'delivery_pending');
      } else {
        whereClause += ' AND status = ?';
        params.push(status);
      }
    }

    // Add date filter - fix to handle mixed date formats properly
    if (days_back && days_back !== 'all') {
      const days = parseInt(days_back.replace('d', ''));
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Use proper date comparison for ISO timestamps
      whereClause += ` AND sale_date >= ?`;
      params.push(cutoffDate.toISOString());
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

    // Normalize statuses in the response
    const normalizedSales = sales.map(sale => ({
      ...sale,
      normalized_status: normalizeStatus(sale.status)
    }));

    res.json({
      sales: normalizedSales,
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

    // Add date filter - fix to handle mixed date formats properly
    if (days_back && days_back !== 'all') {
      const days = parseInt(days_back.replace('d', ''));
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Use proper date comparison for ISO timestamps
      whereClause += ` AND sale_date >= ?`;
      params.push(cutoffDate.toISOString());
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

    // Get daily revenue for chart - fix date grouping for ISO timestamps
    const dailyQuery = `
      SELECT 
        strftime('%Y-%m-%d', sale_date) as date,
        SUM(price * quantity) as revenue,
        COUNT(*) as sales
      FROM sales 
      ${whereClause}
      GROUP BY strftime('%Y-%m-%d', sale_date) 
      ORDER BY strftime('%Y-%m-%d', sale_date)
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
    const { days_back = 30 } = req.body;
    
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
          const swellResult = await syncSwellData(userId, connection, days_back);
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

// Get analytics data
router.get('/analytics', verifyToken, async (req, res) => {
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

    // Add date filter - fix to handle mixed date formats properly
    if (days_back && days_back !== 'all') {
      const days = parseInt(days_back.replace('d', ''));
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Use proper date comparison for ISO timestamps
      whereClause += ` AND sale_date >= ?`;
      params.push(cutoffDate.toISOString());
    }

    // Get revenue trend (daily)
    const revenueTrendQuery = `
      SELECT 
        strftime('%Y-%m-%d', sale_date) as date,
        SUM(price * quantity) as revenue
      FROM sales 
      ${whereClause}
      GROUP BY strftime('%Y-%m-%d', sale_date) 
      ORDER BY strftime('%Y-%m-%d', sale_date)
    `;
    
    const revenueTrend = await dbHelper.all(revenueTrendQuery, params);

    // Get sales trend (daily)
    const salesTrendQuery = `
      SELECT 
        strftime('%Y-%m-%d', sale_date) as date,
        COUNT(*) as sales
      FROM sales 
      ${whereClause}
      GROUP BY strftime('%Y-%m-%d', sale_date) 
      ORDER BY strftime('%Y-%m-%d', sale_date)
    `;
    
    const salesTrend = await dbHelper.all(salesTrendQuery, params);

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
    
    const platformBreakdown = await dbHelper.all(platformQuery, params);

    // Get top products
    const topProductsQuery = `
      SELECT 
        item_title as name,
        platform,
        COUNT(*) as sales,
        SUM(price * quantity) as revenue
      FROM sales 
      ${whereClause}
      GROUP BY item_title, platform
      ORDER BY revenue DESC
      LIMIT 10
    `;
    
    const topProducts = await dbHelper.all(topProductsQuery, params);

    // Calculate customer metrics
    const customerMetricsQuery = `
      SELECT 
        buyer_email,
        buyer_name,
        COUNT(DISTINCT order_id) as order_count,
        SUM(price * quantity) as total_spent,
        MIN(sale_date) as first_order,
        MAX(sale_date) as last_order
      FROM sales 
      ${whereClause}
      AND (buyer_name IS NOT NULL AND buyer_name != '')
      GROUP BY buyer_email, buyer_name
      ORDER BY total_spent DESC
    `;
    
    const customerData = await dbHelper.all(customerMetricsQuery, params);
    
    // Calculate customer metrics
    const totalCustomers = customerData.length;
    
    // Calculate new customers (customers who made their first order in the selected period)
    const newCustomers = customerData.filter(customer => {
      if (!customer.first_order) return false;
      const firstOrderDate = new Date(customer.first_order);
      const cutoffDate = new Date();
      
      if (days_back && days_back !== 'all') {
        const days = parseInt(days_back.replace('d', ''));
        cutoffDate.setDate(cutoffDate.getDate() - days);
      } else {
        // For "all time", consider customers as "new" if they ordered in the last 30 days
        cutoffDate.setDate(cutoffDate.getDate() - 30);
      }
      
      return firstOrderDate >= cutoffDate;
    }).length;
    
    // Calculate returning customers (customers with multiple orders)
    const returningCustomers = customerData.filter(customer => customer.order_count > 1).length;
    
    // Calculate average customer value
    const avgCustomerValue = totalCustomers > 0 ? 
      customerData.reduce((sum, c) => sum + c.total_spent, 0) / totalCustomers : 0;
    
    // Calculate repeat rate percentage
    const repeatRate = totalCustomers > 0 ? 
      Math.round((returningCustomers / totalCustomers) * 100) : 0;

    // Transform data for frontend
    const analyticsData = {
      revenueTrend: revenueTrend.map(item => ({
        date: item.date,
        value: item.revenue
      })),
      salesTrend: salesTrend.map(item => ({
        date: item.date,
        value: item.sales
      })),
      platformBreakdown: platformBreakdown.map(item => ({
        platform: item.platform.charAt(0).toUpperCase() + item.platform.slice(1),
        sales: item.sales,
        revenue: item.revenue,
        margin: 25 // Default estimated margin
      })),
      topProducts: topProducts.map(item => ({
        name: item.name,
        platform: item.platform,
        sales: item.sales,
        revenue: item.revenue
      })),
      categoryBreakdown: [], // Not implemented yet
      customerMetrics: {
        newCustomers: newCustomers,
        returningCustomers: returningCustomers,
        avgCustomerValue: avgCustomerValue,
        totalCustomers: totalCustomers,
        repeatRate: repeatRate
      },
      customerData: customerData.map(customer => ({
        email: customer.buyer_email,
        name: customer.buyer_name,
        orderCount: customer.order_count,
        totalSpent: customer.total_spent,
        firstOrder: customer.first_order,
        lastOrder: customer.last_order,
        avgOrderValue: customer.total_spent / customer.order_count
      }))
    };

    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Get customer analytics (frequent buyers and LTV)
router.get('/customers', verifyToken, async (req, res) => {
  try {
    const { days_back = '30d', platform = 'all', limit = 50 } = req.query;
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
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      whereClause += ` AND sale_date >= ?`;
      params.push(cutoffDate.toISOString());
    }

    // Get customer data with LTV calculations
    const customerQuery = `
      SELECT 
        buyer_email,
        buyer_name,
        COUNT(DISTINCT order_id) as order_count,
        SUM(price * quantity) as total_spent,
        MIN(sale_date) as first_order,
        MAX(sale_date) as last_order,
        AVG(price * quantity) as avg_order_value,
        COUNT(*) as total_items
      FROM sales 
      ${whereClause}
      AND (buyer_name IS NOT NULL AND buyer_name != '')
      GROUP BY buyer_email, buyer_name
      ORDER BY total_spent DESC
      LIMIT ?
    `;
    
    const customers = await dbHelper.all(customerQuery, [...params, parseInt(limit)]);

    // Calculate summary metrics
    const totalCustomers = customers.length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0);
    const avgLTV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
    
    // Frequent buyers: customers with 2+ orders (not 3+)
    const frequentBuyers = customers.filter(c => c.order_count >= 2).length;
    
    // High value customers: customers spending £30+ (not £100+)
    const highValueCustomers = customers.filter(c => c.total_spent >= 30).length;
    
    // Calculate repeat rate
    const repeatRate = totalCustomers > 0 ? Math.round((frequentBuyers / totalCustomers) * 100) : 0;

    res.json({
      customers: customers.map(customer => ({
        email: customer.buyer_email,
        name: customer.buyer_name,
        orderCount: customer.order_count,
        totalSpent: customer.total_spent,
        avgOrderValue: customer.avg_order_value,
        totalItems: customer.total_items,
        firstOrder: customer.first_order,
        lastOrder: customer.last_order,
        customerType: customer.order_count >= 2 ? 'Frequent Buyer' : 
                     customer.total_spent >= 30 ? 'High Value' : 'Regular'
      })),
      summary: {
        totalCustomers,
        totalRevenue,
        avgLTV,
        frequentBuyers,
        highValueCustomers
      }
    });
  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ error: 'Failed to fetch customer analytics' });
  }
});

module.exports = router; 