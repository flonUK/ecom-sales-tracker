const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// Amazon API configuration
const AMAZON_CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const AMAZON_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const AMAZON_REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const AMAZON_MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID || 'ATVPDKIKX0DER';

// Check if real API is configured
const isRealApiConfigured = () => {
  return AMAZON_CLIENT_ID && AMAZON_CLIENT_SECRET && 
         AMAZON_CLIENT_ID !== 'your-amazon-client-id' && 
         AMAZON_CLIENT_SECRET !== 'your-amazon-client-secret';
};

// Get Amazon authorization URL
router.get('/auth-url', verifyToken, (req, res) => {
  if (!isRealApiConfigured()) {
    return res.json({ 
      demoMode: true,
      message: 'Using sample data. Configure AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET for real data.'
    });
  }

  const state = Math.random().toString(36).substring(7);
  const authUrl = `https://sellercentral.amazon.com/apps/authorize/consent?application_id=${AMAZON_CLIENT_ID}&state=${state}`;
  
  res.json({ authUrl, state });
});

// Connect Amazon account (works with both sample and real data)
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { sellerId } = req.body;

    if (isRealApiConfigured()) {
      // Real API mode - redirect to OAuth flow
      return res.json({ 
        message: 'OAuth required for real data',
        requiresOAuth: true
      });
    } else {
      // Sample data mode - create mock Amazon account
      const mockSeller = {
        sellerId: sellerId || 'sample-amazon-seller',
        name: sellerId || 'Sample Amazon Seller'
      };

      // Store connection in database
      await dbHelper.run(
        `INSERT OR REPLACE INTO api_credentials 
         (user_id, platform, store_id, store_name, is_active, created_at) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.user.userId, 'amazon', mockSeller.sellerId, mockSeller.name, 1]
      );

      res.json({ 
        message: 'Amazon account connected successfully (Sample Data Mode)',
        seller: {
          id: mockSeller.sellerId,
          name: mockSeller.name
        },
        demoMode: true,
        note: 'Using sample data. Add real API credentials to .env for real data.'
      });
    }

  } catch (error) {
    console.error('Amazon connection error:', error);
    res.status(500).json({ error: 'Failed to connect Amazon account' });
  }
});

// Get Amazon connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const credentials = await dbHelper.get(
      'SELECT store_id, store_name, is_active, access_token, updated_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'amazon']
    );

    res.json({
      connected: credentials && credentials.is_active,
      lastSync: credentials?.updated_at || null,
      demoMode: !isRealApiConfigured(),
      note: isRealApiConfigured() ? 'Real API configured' : 'Using sample data'
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

// Fetch sold items from Amazon (sample data by default, real data when configured)
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    // Get connected Amazon account
    const credentials = await dbHelper.get(
      'SELECT store_id, store_name, access_token FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [req.user.userId, 'amazon']
    );

    if (!credentials) {
      return res.status(404).json({ error: 'Amazon not connected. Please connect an account first.' });
    }

    let sales = [];
    let usingSampleData = false;

    if (isRealApiConfigured() && credentials.access_token) {
      try {
        // Real API mode - get actual data
        const accessToken = await getAmazonToken(req.user.userId);
        
        // Get orders from Amazon API
        const ordersResponse = await axios.get('https://sellingpartnerapi-na.amazon.com/orders/v0/orders', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-amz-access-token': accessToken
          },
          params: {
            MarketplaceIds: AMAZON_MARKETPLACE_ID,
            MaxResultsPerPage: Math.min(limit, 100),
            OrderStatuses: 'Shipped'
          }
        });

        const orders = ordersResponse.data.payload.Orders || [];

        for (const order of orders) {
          // Get order items
          const itemsResponse = await axios.get(`https://sellingpartnerapi-na.amazon.com/orders/v0/orders/${order.AmazonOrderId}/orderItems`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'x-amz-access-token': accessToken
            }
          });

          const items = itemsResponse.data.payload.OrderItems || [];

          for (const item of items) {
            const sale = {
              platform: 'amazon',
              order_id: order.AmazonOrderId,
              item_title: item.Title,
              item_id: item.ASIN,
              quantity: item.QuantityOrdered,
              price: parseFloat(item.ItemPrice.Amount),
              currency: item.ItemPrice.CurrencyCode,
              buyer_name: order.BuyerInfo?.BuyerName || 'Unknown',
              buyer_email: order.BuyerInfo?.BuyerEmail || null,
              sale_date: new Date(order.PurchaseDate),
              status: order.OrderStatus,
              shipping_address: `${order.ShippingAddress?.AddressLine1 || ''}, ${order.ShippingAddress?.City || ''}, ${order.ShippingAddress?.StateOrRegion || ''}`,
              tracking_number: order.ShipmentServiceLevelCategory || null,
              shop_name: credentials.store_name,
              data_source: 'real'
            };

            sales.push(sale);

            // Store in database
            await dbHelper.run(
              `INSERT OR IGNORE INTO sales 
               (user_id, platform, order_id, item_title, item_id, quantity, price, currency, buyer_name, buyer_email, sale_date, status, shipping_address, tracking_number) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [req.user.userId, sale.platform, sale.order_id, sale.item_title, sale.item_id, sale.quantity, sale.price, sale.currency, sale.buyer_name, sale.buyer_email, sale.sale_date, sale.status, sale.shipping_address, sale.tracking_number]
            );
          }
        }

        // Log sync history
        await dbHelper.run(
          'INSERT INTO sync_history (user_id, platform, items_synced) VALUES (?, ?, ?)',
          [req.user.userId, 'amazon', sales.length]
        );

      } catch (apiError) {
        console.error('Amazon API error:', apiError.response?.data || apiError.message);
        // Fall back to sample data if API fails
        usingSampleData = true;
        sales = generateSampleAmazonSales(credentials, limit);
      }
    } else {
      // Sample data mode - generate realistic mock data
      usingSampleData = true;
      sales = generateSampleAmazonSales(credentials, limit);
    }

    res.json({ 
      sales,
      total: sales.length,
      demoMode: usingSampleData || !isRealApiConfigured(),
      message: usingSampleData ? 
        'Sample data mode: Add AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET to .env for real data' :
        'Real sales data from Amazon API'
    });

  } catch (error) {
    console.error('Error fetching Amazon sales:', error);
    res.status(500).json({ error: 'Failed to fetch Amazon sales data' });
  }
});

// Generate realistic sample Amazon sales data
function generateSampleAmazonSales(credentials, limit = 10) {
  const sampleItems = [
    'Kindle Paperwhite',
    'Echo Dot 4th Gen',
    'Fire TV Stick 4K',
    'Ring Video Doorbell',
    'Amazon Basics Microwave',
    'Echo Show 8',
    'Fire HD 10 Tablet',
    'Ring Smart Lighting',
    'Amazon Smart Plug',
    'Echo Buds 2nd Gen',
    'Amazon Basics Blender',
    'Ring Floodlight Camera',
    'Fire TV Cube',
    'Amazon Basics Coffee Maker',
    'Echo Flex'
  ];

  const sampleBuyers = [
    'Alex Johnson',
    'Taylor Smith',
    'Jordan Davis',
    'Casey Wilson',
    'Morgan Brown',
    'Riley Miller',
    'Quinn Taylor',
    'Avery Anderson',
    'Parker Garcia',
    'Drew Martinez',
    'Sam Thompson',
    'Jamie Lee',
    'Blake White',
    'Cameron Rodriguez',
    'Dakota Clark'
  ];

  const sales = [];
  const numSales = Math.min(limit, 15);

  for (let i = 0; i < numSales; i++) {
    const randomItem = sampleItems[Math.floor(Math.random() * sampleItems.length)];
    const randomBuyer = sampleBuyers[Math.floor(Math.random() * sampleBuyers.length)];
    const randomPrice = (Math.random() * 300 + 30).toFixed(2);
    const randomDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);

    sales.push({
      platform: 'amazon',
      order_id: `sample-amazon-${i + 1}`,
      item_title: randomItem,
      item_id: `sample-item-${i + 1}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: parseFloat(randomPrice),
      currency: 'USD',
      buyer_name: randomBuyer,
      buyer_email: `${randomBuyer.toLowerCase().replace(' ', '.')}@example.com`,
      sale_date: randomDate,
      status: 'Shipped',
      shipping_address: `${Math.floor(Math.random() * 9999)} Sample Blvd, Sample City, SC ${Math.floor(Math.random() * 90000) + 10000}`,
      tracking_number: `SAMPLE${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      shop_name: credentials.store_name,
      data_source: 'sample'
    });
  }

  return sales;
}

// Refresh Amazon access token
async function refreshAmazonToken(userId) {
  try {
    const credentials = await dbHelper.get(
      'SELECT * FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [userId, 'amazon']
    );

    if (!credentials || !credentials.refresh_token) {
      throw new Error('No valid Amazon credentials found');
    }

    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: credentials.refresh_token,
      client_id: AMAZON_CLIENT_ID,
      client_secret: AMAZON_CLIENT_SECRET
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await dbHelper.run(
      `UPDATE api_credentials 
       SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND platform = ?`,
      [access_token, refresh_token, expiresAt, userId, 'amazon']
    );

    return access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// Get Amazon access token
async function getAmazonToken(userId) {
  const credentials = await dbHelper.get(
    'SELECT * FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
    [userId, 'amazon']
  );

  if (!credentials) {
    throw new Error('Amazon not connected');
  }

  // Check if token is expired
  if (new Date(credentials.expires_at) <= new Date()) {
    return await refreshAmazonToken(userId);
  }

  return credentials.access_token;
}

// Disconnect Amazon account
router.delete('/disconnect', verifyToken, async (req, res) => {
  try {
    await dbHelper.run(
      'UPDATE api_credentials SET is_active = 0 WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'amazon']
    );

    res.json({ message: 'Amazon account disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Amazon account' });
  }
});

module.exports = router; 