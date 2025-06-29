const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

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

module.exports = router; 