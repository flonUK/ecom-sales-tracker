const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database setup
const dbPath = path.join(__dirname, '../data/sales.db');
const db = new sqlite3.Database(dbPath);

// Swell API configuration
const SWELL_API_URL = 'https://api.swell.store';

// Connect to Swell
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { storeId, publicKey, secretKey } = req.body;
    
    if (!storeId || !publicKey || !secretKey) {
      return res.status(400).json({ error: 'Missing required Swell credentials' });
    }

    // Store connection in database
    const query = `
      INSERT OR REPLACE INTO api_credentials 
      (user_id, platform, store_id, store_name, public_key, secret_key, is_active, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [
      req.user.userId, 
      'swell', 
      storeId, 
      `Swell Store: ${storeId}`, 
      publicKey, 
      secretKey, 
      1
    ], function(err) {
      if (err) {
        console.error('Database error saving Swell credentials:', err);
        return res.status(500).json({ 
          error: 'Failed to save Swell credentials',
          details: err.message 
        });
      }
      
      console.log('Swell credentials saved successfully for user:', req.user.userId);
      res.json({ 
        success: true, 
        message: 'Swell connected successfully',
        storeId,
        note: 'Credentials will be tested when fetching data'
      });
    });
  } catch (error) {
    console.error('Error saving Swell credentials:', error);
    res.status(500).json({ 
      error: 'Failed to save Swell credentials',
      details: error.message 
    });
  }
});

// Get connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT store_id, store_name, is_active, created_at, updated_at 
      FROM api_credentials 
      WHERE user_id = ? AND platform = ? AND is_active = 1
    `;
    
    db.get(query, [req.user.userId, 'swell'], (err, row) => {
      if (err) {
        console.error('Database error checking Swell status:', err);
        return res.status(500).json({ error: 'Failed to check Swell status' });
      }
      
      if (row) {
        res.json({ 
          connected: true,
          message: 'Swell connected',
          storeId: row.store_id,
          storeName: row.store_name,
          lastSync: row.updated_at
        });
      } else {
        res.json({ 
          connected: false,
          message: 'Swell not connected'
        });
      }
    });
  } catch (error) {
    console.error('Error checking Swell status:', error);
    res.status(500).json({ error: 'Failed to check Swell status' });
  }
});

// Disconnect from Swell
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    const query = `
      UPDATE api_credentials 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND platform = ?
    `;
    
    db.run(query, [req.user.userId, 'swell'], function(err) {
      if (err) {
        console.error('Database error disconnecting Swell:', err);
        return res.status(500).json({ error: 'Failed to disconnect from Swell' });
      }
      
      console.log('Swell disconnected successfully for user:', req.user.userId);
      res.json({ 
        success: true, 
        message: 'Swell disconnected successfully' 
      });
    });
  } catch (error) {
    console.error('Error disconnecting from Swell:', error);
    res.status(500).json({ error: 'Failed to disconnect from Swell' });
  }
});

// Get Swell sales data
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Swell credentials from database
    const query = `
      SELECT store_id, public_key, secret_key 
      FROM api_credentials 
      WHERE user_id = ? AND platform = ? AND is_active = 1
    `;
    
    db.get(query, [req.user.userId, 'swell'], async (err, credentials) => {
      if (err) {
        console.error('Database error fetching Swell credentials:', err);
        return res.status(500).json({ error: 'Failed to fetch Swell credentials' });
      }
      
      if (!credentials) {
        return res.status(404).json({ error: 'Swell not connected' });
      }

      try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days_back));

        // Fetch orders from Swell API
        const ordersResponse = await fetch(`${SWELL_API_URL}/stores/${credentials.store_id}/orders`, {
          headers: {
            'Authorization': credentials.public_key,
            'Content-Type': 'application/json'
          }
        });

        if (!ordersResponse.ok) {
          console.error('Swell API error:', ordersResponse.status, ordersResponse.statusText);
          return res.status(ordersResponse.status).json({ 
            error: 'Failed to fetch Swell orders',
            details: `API returned ${ordersResponse.status}`
          });
        }

        const ordersData = await ordersResponse.json();
        const orders = ordersData.results || ordersData || [];

        // Process orders into sales format
        const sales = [];
        for (const order of orders) {
          // Check if order is within date range
          const orderDate = new Date(order.date_created || order.created_at);
          if (orderDate >= startDate && orderDate <= endDate) {
            // Process each item in the order
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items) {
                const sale = {
                  date: orderDate.toISOString().split('T')[0],
                  platform: 'swell',
                  item: item.product_name || item.name || 'Unknown Product',
                  orderId: order.id || order.number,
                  revenue: parseFloat(item.price_total || item.price || 0),
                  status: order.status || 'completed',
                  sku: item.sku || null
                };
                sales.push(sale);

                // Store in database
                const insertQuery = `
                  INSERT OR IGNORE INTO sales 
                  (user_id, platform, order_id, item_title, price, sale_date, status, sku) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `;
                db.run(insertQuery, [
                  req.user.userId,
                  sale.platform,
                  sale.orderId,
                  sale.item,
                  sale.revenue,
                  sale.date,
                  sale.status,
                  sale.sku
                ]);
              }
            }
          }
        }

        res.json(sales);
      } catch (apiError) {
        console.error('Error fetching Swell sales:', apiError);
        res.status(500).json({ 
          error: 'Failed to fetch Swell sales',
          details: apiError.message 
        });
      }
    });
  } catch (error) {
    console.error('Error in Swell sales endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch Swell sales' });
  }
});

// Get Swell statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Swell credentials from database
    const query = `
      SELECT store_id, public_key, secret_key 
      FROM api_credentials 
      WHERE user_id = ? AND platform = ? AND is_active = 1
    `;
    
    db.get(query, [req.user.userId, 'swell'], async (err, credentials) => {
      if (err) {
        console.error('Database error fetching Swell credentials:', err);
        return res.status(500).json({ error: 'Failed to fetch Swell credentials' });
      }
      
      if (!credentials) {
        return res.status(404).json({ error: 'Swell not connected' });
      }

      try {
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days_back));

        // Fetch orders from Swell API
        const ordersResponse = await fetch(`${SWELL_API_URL}/stores/${credentials.store_id}/orders`, {
          headers: {
            'Authorization': credentials.public_key,
            'Content-Type': 'application/json'
          }
        });

        if (!ordersResponse.ok) {
          console.error('Swell API error:', ordersResponse.status, ordersResponse.statusText);
          return res.status(ordersResponse.status).json({ 
            error: 'Failed to fetch Swell orders',
            details: `API returned ${ordersResponse.status}`
          });
        }

        const ordersData = await ordersResponse.json();
        const orders = ordersData.results || ordersData || [];

        // Calculate statistics
        let totalRevenue = 0;
        let totalSales = 0;
        let totalItems = 0;
        const topProducts = {};
        const recentActivity = [];

        for (const order of orders) {
          const orderDate = new Date(order.date_created || order.created_at);
          if (orderDate >= startDate && orderDate <= endDate) {
            totalSales++;
            
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items) {
                const itemRevenue = parseFloat(item.price_total || item.price || 0);
                totalRevenue += itemRevenue;
                totalItems++;

                // Track top products
                const productName = item.product_name || item.name || 'Unknown Product';
                if (!topProducts[productName]) {
                  topProducts[productName] = { revenue: 0, sales: 0 };
                }
                topProducts[productName].revenue += itemRevenue;
                topProducts[productName].sales++;

                // Add to recent activity
                recentActivity.push({
                  platform: 'swell',
                  item: productName,
                  revenue: itemRevenue,
                  time: orderDate.toLocaleDateString()
                });
              }
            }
          }
        }

        // Sort top products by revenue
        const topProductsArray = Object.entries(topProducts)
          .map(([name, data]) => ({
            name,
            revenue: data.revenue,
            sales: data.sales,
            platform: 'swell'
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        // Sort recent activity by date
        recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5);

        const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

        res.json({
          totalRevenue,
          totalSales,
          totalItems,
          avgOrderValue,
          profitMargin: 25.0, // Default margin
          adSpend: 0, // Would need separate tracking
          roas: 0, // Would need ad spend data
          topProducts: topProductsArray,
          platformBreakdown: [{
            platform: 'Swell',
            revenue: totalRevenue,
            sales: totalSales,
            margin: 25.0
          }],
          recentActivity: recentActivity.slice(0, 5)
        });
      } catch (apiError) {
        console.error('Error fetching Swell stats:', apiError);
        res.status(500).json({ 
          error: 'Failed to fetch Swell stats',
          details: apiError.message 
        });
      }
    });
  } catch (error) {
    console.error('Error in Swell stats endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch Swell stats' });
  }
});

module.exports = router; 