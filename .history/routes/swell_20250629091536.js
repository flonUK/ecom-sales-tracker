const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database setup
const dbPath = path.join(__dirname, '../data/sales.db');
const db = new sqlite3.Database(dbPath);

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
    // First, set is_active to 0
    const updateQuery = `
      UPDATE api_credentials 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND platform = ?
    `;
    
    db.run(updateQuery, [req.user.userId, 'swell'], function(err) {
      if (err) {
        console.error('Database error disconnecting Swell:', err);
        return res.status(500).json({ error: 'Failed to disconnect from Swell' });
      }
      
      // Then, optionally delete the credentials completely
      const deleteQuery = `
        DELETE FROM api_credentials 
        WHERE user_id = ? AND platform = ?
      `;
      
      db.run(deleteQuery, [req.user.userId, 'swell'], function(deleteErr) {
        if (deleteErr) {
          console.error('Database error deleting Swell credentials:', deleteErr);
        }
        
        console.log('Swell disconnected successfully for user:', req.user.userId);
        res.json({ 
          success: true, 
          message: 'Swell disconnected successfully' 
        });
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
        // Initialize Swell SDK properly
        const { swell } = require('swell-node');
        swell.init(credentials.store_id, credentials.secret_key);
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days_back || 30));

        console.log(`Fetching Swell orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Fetch orders from Swell API using SDK
        const ordersResponse = await swell.get('/orders', {
          where: {
            date_created: {
              $gte: startDate.toISOString(),
              $lte: endDate.toISOString()
            }
          },
          limit: 100,
          page: 1,
          expand: 'items'
        });

        console.log(`Found ${ordersResponse.count || 0} Swell orders`);

        const orders = ordersResponse.results || [];

        // Process orders into sales format
        const sales = [];
        for (const order of orders) {
          // Process each item in the order
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              const sale = {
                date: new Date(order.date_created).toISOString().split('T')[0],
                platform: 'swell',
                item: item.product_name || item.name || 'Unknown Product',
                orderId: order.number || order.id,
                revenue: parseFloat(item.price_total || item.price || 0),
                status: order.status || 'completed'
              };
              sales.push(sale);

              // Store in database (removed sku column)
              const insertQuery = `
                INSERT OR IGNORE INTO sales 
                (user_id, platform, order_id, item_title, price, quantity, sale_date, status) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `;
              
              const price = parseFloat(item.price || 0);
              const quantity = parseInt(item.quantity || 1);
              
              db.run(insertQuery, [
                req.user.userId,
                'swell',
                order.number || order.id,
                item.product_name || item.name || 'Unknown Product',
                price,
                quantity,
                new Date(order.date_created).toISOString(),
                order.status || 'completed'
              ], function(err) {
                if (err) {
                  console.error('Error inserting sale:', err);
                }
              });
            }
          }
        }

        console.log(`Processed ${sales.length} sales from Swell`);
        
        res.json({
          success: true,
          message: `Successfully synced ${sales.length} sales from Swell`,
          sales: sales,
          totalOrders: orders.length,
          totalSales: sales.length
        });
        
      } catch (apiError) {
        console.error('Swell API error:', apiError);
        res.status(500).json({ 
          error: 'Failed to fetch Swell orders',
          details: apiError.message 
        });
      }
    });
    
  } catch (error) {
    console.error('Error fetching Swell sales:', error);
    res.status(500).json({ error: 'Failed to fetch Swell sales data' });
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
        // Initialize Swell SDK properly
        const { swell } = require('swell-node');
        swell.init(credentials.store_id, credentials.secret_key);
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days_back || 30));

        // Fetch orders from Swell API using SDK
        const ordersResponse = await swell.get('/orders', {
          where: {
            date_created: {
              $gte: startDate.toISOString(),
              $lte: endDate.toISOString()
            }
          },
          limit: 1000,
          page: 1
        });

        const orders = ordersResponse.results || [];
        
        // Calculate statistics
        const stats = {
          totalOrders: orders.length,
          totalRevenue: 0,
          totalItems: 0,
          avgOrderValue: 0,
          statusBreakdown: {}
        };

        orders.forEach(order => {
          stats.totalRevenue += parseFloat(order.grand_total || 0);
          stats.totalItems += parseInt(order.item_quantity || 0);
          
          const status = order.status || 'unknown';
          stats.statusBreakdown[status] = (stats.statusBreakdown[status] || 0) + 1;
        });

        stats.avgOrderValue = stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;
        
        res.json({
          success: true,
          stats: stats,
          period: `${days_back} days`
        });
        
      } catch (apiError) {
        console.error('Swell API error:', apiError);
        res.status(500).json({ 
          error: 'Failed to fetch Swell statistics',
          details: apiError.message 
        });
      }
    });
    
  } catch (error) {
    console.error('Error fetching Swell stats:', error);
    res.status(500).json({ error: 'Failed to fetch Swell statistics' });
  }
});

// Manual sync endpoint
router.post('/sync', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.body;
    
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
        // Initialize Swell SDK properly
        const { swell } = require('swell-node');
        swell.init(credentials.store_id, credentials.secret_key);
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days_back || 30));

        console.log(`Manual sync: Fetching Swell orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Fetch orders from Swell API using SDK
        const ordersResponse = await swell.get('/orders', {
          where: {
            date_created: {
              $gte: startDate.toISOString(),
              $lte: endDate.toISOString()
            }
          },
          limit: 1000,
          page: 1,
          expand: 'items'
        });

        console.log(`Manual sync: Found ${ordersResponse.count || 0} Swell orders`);

        const orders = ordersResponse.results || [];

        // Process orders into sales format
        const sales = [];
        for (const order of orders) {
          // Calculate shipping cost per item (distribute evenly)
          const shippingCost = parseFloat(order.shipping_total || 0);
          const totalItems = order.items ? order.items.reduce((sum, item) => sum + parseInt(item.quantity || 1), 0) : 1;
          const shippingPerItem = totalItems > 0 ? shippingCost / totalItems : 0;
          
          // Process each item in the order
          if (order.items && Array.isArray(order.items)) {
            for (const item of order.items) {
              const quantity = parseInt(item.quantity || 1);
              const itemPrice = parseFloat(item.price || 0);
              const itemTotal = parseFloat(item.price_total || (itemPrice * quantity));
              
              // Add shipping cost to this item's total
              const itemShippingCost = shippingPerItem * quantity;
              const totalWithShipping = itemTotal + itemShippingCost;
              
              const sale = {
                date: new Date(order.date_created).toISOString().split('T')[0],
                platform: 'swell',
                item: item.product_name || item.name || 'Unknown Product',
                orderId: order.number || order.id,
                revenue: totalWithShipping, // Use total with shipping
                status: order.status || 'completed'
              };
              sales.push(sale);

              // Store in database with unique constraint
              const insertQuery = `
                INSERT OR REPLACE INTO sales 
                (user_id, platform, order_id, item_title, item_id, price, quantity, currency, buyer_name, buyer_email, sale_date, status, shipping_address) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `;
              
              db.run(insertQuery, [
                req.user.userId,
                'swell',
                order.number || order.id,
                item.product_name || item.name || 'Unknown Product',
                item.product_id || item.id || '',
                totalWithShipping, // Use total with shipping
                quantity,
                order.currency || 'USD',
                order.account?.name || order.billing?.name || 'Unknown',
                order.account?.email || order.billing?.email || '',
                new Date(order.date_created).toISOString(),
                order.status || 'completed',
                JSON.stringify(order.shipping || {})
              ], function(err) {
                if (err) {
                  console.error('Error inserting sale:', err);
                }
              });
            }
          }
        }

        console.log(`Manual sync: Processed ${sales.length} sales from Swell`);
        
        res.json({
          success: true,
          message: `Successfully synced ${sales.length} sales from Swell`,
          sales: sales,
          totalOrders: orders.length,
          totalSales: sales.length
        });
        
      } catch (apiError) {
        console.error('Swell API error during manual sync:', apiError);
        res.status(500).json({ 
          error: 'Failed to fetch Swell orders',
          details: apiError.message 
        });
      }
    });
    
  } catch (error) {
    console.error('Error during manual Swell sync:', error);
    res.status(500).json({ error: 'Failed to sync Swell data' });
  }
});

// Function to sync Swell data (can be called from other routes)
async function syncSwellData(userId, credentials, days_back = 30) {
  try {
    // Initialize Swell SDK properly
    const { swell } = require('swell-node');
    swell.init(credentials.store_id, credentials.secret_key);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days_back));

    console.log(`Fetching Swell orders from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch orders from Swell API using SDK
    const ordersResponse = await swell.get('/orders', {
      where: {
        date_created: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString()
        }
      },
      limit: 1000,
      page: 1,
      expand: 'items'
    });

    console.log(`Found ${ordersResponse.count || 0} Swell orders`);

    const orders = ordersResponse.results || [];
    let salesCount = 0;

    // Process orders into sales format
    for (const order of orders) {
      // Calculate shipping cost per item (distribute evenly)
      const shippingCost = parseFloat(order.shipping_total || 0);
      const totalItems = order.items ? order.items.reduce((sum, item) => sum + parseInt(item.quantity || 1), 0) : 1;
      const shippingPerItem = totalItems > 0 ? shippingCost / totalItems : 0;
      
      // Process each item in the order
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const quantity = parseInt(item.quantity || 1);
          const itemPrice = parseFloat(item.price || 0);
          const itemTotal = parseFloat(item.price_total || (itemPrice * quantity));
          
          // Add shipping cost to this item's total
          const itemShippingCost = shippingPerItem * quantity;
          const totalWithShipping = itemTotal + itemShippingCost;
          
          // Store in database with unique constraint on order_id + item_id
          const insertQuery = `
            INSERT OR REPLACE INTO sales 
            (user_id, platform, order_id, item_title, item_id, price, quantity, currency, buyer_name, buyer_email, sale_date, status, shipping_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          await new Promise((resolve, reject) => {
            db.run(insertQuery, [
              userId,
              'swell',
              order.number || order.id,
              item.product_name || item.name || 'Unknown Product',
              item.product_id || item.id || '',
              totalWithShipping, // Use total with shipping
              quantity,
              order.currency || 'USD',
              order.account?.name || order.billing?.name || 'Unknown',
              order.account?.email || order.billing?.email || '',
              new Date(order.date_created).toISOString(),
              order.status || 'completed',
              JSON.stringify(order.shipping || {})
            ], function(err) {
              if (err) {
                console.error('Error inserting sale:', err);
                reject(err);
              } else {
                if (this.changes > 0) {
                  salesCount++;
                }
                resolve();
              }
            });
          });
        }
      }
    }

    console.log(`Processed ${salesCount} sales from Swell`);
    
    return {
      success: true,
      salesCount: salesCount,
      totalOrders: orders.length,
      message: `Successfully synced ${salesCount} sales from Swell`
    };
    
  } catch (error) {
    console.error('Error syncing Swell data:', error);
    throw error;
  }
}

module.exports = { router, syncSwellData }; 