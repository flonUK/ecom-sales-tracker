const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// eBay API configuration
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI || 'http://localhost:3004/connect/ebay/callback';

// Get eBay authorization URL
router.get('/auth-url', verifyToken, (req, res) => {
  if (!EBAY_CLIENT_ID) {
    return res.status(400).json({ 
      error: 'eBay OAuth not configured. Please set EBAY_CLIENT_ID in environment variables.',
      demoMode: true
    });
  }

  const state = Math.random().toString(36).substring(7);
  const authUrl = `https://auth.ebay.com/oauth2/authorize?client_id=${EBAY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(EBAY_REDIRECT_URI)}&scope=https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.marketing https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment&state=${state}`;
  
  res.json({ authUrl, state });
});

// Handle eBay OAuth callback
router.post('/callback', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
      return res.status(500).json({ error: 'eBay OAuth not configured' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.ebay.com/identity/v1/oauth2/token', {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: EBAY_REDIRECT_URI
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64')}`
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user information
    const userResponse = await axios.get('https://api.ebay.com/identity/v1/oauth2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const user = userResponse.data;

    // Store credentials in database
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    await dbHelper.run(
      `INSERT OR REPLACE INTO api_credentials 
       (user_id, platform, access_token, refresh_token, expires_at, store_id, store_name, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, 'ebay', access_token, refresh_token, expiresAt, user.userId, `eBay User: ${user.username}`, 1]
    );

    res.json({ 
      message: 'eBay connected successfully with OAuth',
      user: {
        id: user.userId,
        name: user.username
      }
    });

  } catch (error) {
    console.error('eBay OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect eBay account via OAuth' });
  }
});

// Connect eBay account (demo mode fallback)
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { username } = req.body;

    // If OAuth is configured, redirect to OAuth flow
    if (EBAY_CLIENT_ID) {
      return res.json({ 
        message: 'OAuth required for real data',
        requiresOAuth: true
      });
    }

    // Demo mode - create mock eBay account
    const mockUser = {
      userId: username || 'demo-ebay-user',
      username: username || 'Demo eBay Seller'
    };

    // Store connection in database
    await dbHelper.run(
      `INSERT OR REPLACE INTO api_credentials 
       (user_id, platform, store_id, store_name, is_active, created_at) 
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.userId, 'ebay', mockUser.userId, mockUser.username, 1]
    );

    res.json({ 
      message: 'eBay account connected successfully (Demo Mode)',
      user: {
        id: mockUser.userId,
        name: mockUser.username
      },
      demoMode: true
    });

  } catch (error) {
    console.error('eBay connection error:', error);
    res.status(500).json({ error: 'Failed to connect eBay account' });
  }
});

// Get eBay connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const credentials = await dbHelper.get(
      'SELECT store_id, store_name, is_active, access_token, updated_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'ebay']
    );

    res.json({
      connected: credentials && credentials.is_active,
      lastSync: credentials?.updated_at || null,
      demoMode: !credentials?.access_token
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

// Fetch sold items from eBay
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    // Get connected eBay account
    const credentials = await dbHelper.get(
      'SELECT store_id, store_name, access_token FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [req.user.userId, 'ebay']
    );

    if (!credentials) {
      return res.status(404).json({ error: 'eBay not connected. Please connect an account first.' });
    }

    // If account has OAuth token, get real sales data
    if (credentials.access_token) {
      try {
        // Get orders from eBay API
        const ordersResponse = await axios.get('https://api.ebay.com/sell/fulfillment/v1/order', {
          headers: {
            'Authorization': `Bearer ${credentials.access_token}`,
            'Content-Type': 'application/json'
          },
          params: {
            limit: Math.min(limit, 100),
            offset
          }
        });

        const orders = ordersResponse.data.orders || [];
        const sales = [];

        for (const order of orders) {
          for (const lineItem of order.lineItems) {
            const sale = {
              platform: 'ebay',
              order_id: order.orderId,
              item_title: lineItem.title,
              item_id: lineItem.itemId,
              quantity: lineItem.quantity,
              price: parseFloat(lineItem.total.value),
              currency: lineItem.total.currency,
              buyer_name: order.buyer.username,
              buyer_email: order.buyer.email,
              sale_date: new Date(order.creationDate),
              status: order.orderFulfillmentStatus,
              shipping_address: `${order.fulfillmentStartInstructions[0]?.shippingStep?.shipTo?.contactAddress?.addressLine1 || ''}, ${order.fulfillmentStartInstructions[0]?.shippingStep?.shipTo?.contactAddress?.cityOrTown || ''}`,
              tracking_number: order.fulfillmentStartInstructions[0]?.shippingStep?.carrierCode || null
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
          [req.user.userId, 'ebay', sales.length]
        );

        res.json({ 
          sales,
          count: sales.length,
          message: 'Real sales data from eBay OAuth'
        });

      } catch (apiError) {
        console.error('eBay API error:', apiError.response?.data || apiError.message);
        // Fall back to demo data if API fails
        const mockSales = generateMockEbaySales(credentials, limit);
        res.json({ 
          sales: mockSales,
          total: mockSales.length,
          message: 'API error - showing demo data'
        });
      }
    } else {
      // Demo mode - generate mock data
      const mockSales = generateMockEbaySales(credentials, limit);
      res.json({ 
        sales: mockSales,
        total: mockSales.length,
        message: 'Demo mode: Showing mock sales data. Connect with OAuth for real data.'
      });
    }

  } catch (error) {
    console.error('Error fetching eBay sales:', error);
    res.status(500).json({ error: 'Failed to fetch eBay sales data' });
  }
});

// Generate mock eBay sales data
function generateMockEbaySales(credentials, limit = 10) {
  const mockItems = [
    'iPhone 13 Pro',
    'Samsung Galaxy S21',
    'MacBook Pro 14"',
    'Nike Air Max 270',
    'Sony WH-1000XM4 Headphones',
    'iPad Air 4th Gen',
    'Adidas Ultraboost 21',
    'Canon EOS R6',
    'Apple Watch Series 7',
    'PlayStation 5'
  ];

  const mockBuyers = [
    'John Smith',
    'Maria Garcia',
    'David Johnson',
    'Sarah Wilson',
    'Michael Brown',
    'Lisa Davis',
    'Robert Miller',
    'Jennifer Taylor',
    'William Anderson',
    'Amanda Thomas'
  ];

  const sales = [];
  const numSales = Math.min(limit, 10);

  for (let i = 0; i < numSales; i++) {
    const randomItem = mockItems[Math.floor(Math.random() * mockItems.length)];
    const randomBuyer = mockBuyers[Math.floor(Math.random() * mockBuyers.length)];
    const randomPrice = (Math.random() * 500 + 50).toFixed(2);
    const randomDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    sales.push({
      platform: 'ebay',
      order_id: `demo-ebay-${i + 1}`,
      item_title: randomItem,
      item_id: `demo-item-${i + 1}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: parseFloat(randomPrice),
      currency: 'USD',
      buyer_name: randomBuyer,
      buyer_email: `${randomBuyer.toLowerCase().replace(' ', '.')}@example.com`,
      sale_date: randomDate,
      status: 'FULFILLED',
      shipping_address: 'Demo Address, Demo City, DC 12345',
      tracking_number: `DEMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      shop_name: credentials.store_name
    });
  }

  return sales;
}

// Disconnect eBay account
router.delete('/disconnect', verifyToken, async (req, res) => {
  try {
    await dbHelper.run(
      'UPDATE api_credentials SET is_active = 0 WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'ebay']
    );

    res.json({ message: 'eBay account disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect eBay account' });
  }
});

module.exports = router; 