const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// eBay API configuration
const EBAY_API_BASE = 'https://api.ebay.com';
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI || 'http://localhost:3004/connect/ebay/callback';

// Get eBay authorization URL
router.get('/auth-url', verifyToken, (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const authUrl = `${EBAY_API_BASE}/authorize?client_id=${EBAY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(EBAY_REDIRECT_URI)}&scope=https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope/sell.account https://api.ebay.com/oauth/api_scope/sell.fulfillment&state=${state}`;
  
  res.json({ authUrl, state });
});

// Handle eBay OAuth callback
router.post('/callback', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(`${EBAY_API_BASE}/identity/v1/oauth2/token`, 
      `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(EBAY_REDIRECT_URI)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user information
    const userResponse = await axios.get(`${EBAY_API_BASE}/commerce/identity/v1/user/`, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const user = userResponse.data;

    // Store credentials in database
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    await dbHelper.run(
      `INSERT OR REPLACE INTO api_credentials 
       (user_id, platform, access_token, refresh_token, expires_at, store_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, 'ebay', access_token, refresh_token, expiresAt, user.username, 1]
    );

    res.json({ 
      message: 'eBay connected successfully',
      user: {
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('eBay callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect eBay account' });
  }
});

// Refresh eBay access token
async function refreshEbayToken(userId) {
  try {
    const credentials = await dbHelper.get(
      'SELECT * FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [userId, 'ebay']
    );

    if (!credentials || !credentials.refresh_token) {
      throw new Error('No valid eBay credentials found');
    }

    const tokenResponse = await axios.post(`${EBAY_API_BASE}/identity/v1/oauth2/token`,
      `grant_type=refresh_token&refresh_token=${credentials.refresh_token}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await dbHelper.run(
      `UPDATE api_credentials 
       SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND platform = ?`,
      [access_token, refresh_token, expiresAt, userId, 'ebay']
    );

    return access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// Get eBay access token
async function getEbayToken(userId) {
  const credentials = await dbHelper.get(
    'SELECT * FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
    [userId, 'ebay']
  );

  if (!credentials) {
    throw new Error('eBay not connected');
  }

  // Check if token is expired
  if (new Date(credentials.expires_at) <= new Date()) {
    return await refreshEbayToken(userId);
  }

  return credentials.access_token;
}

// Fetch sold items from eBay
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    const accessToken = await getEbayToken(req.user.userId);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days_back));

    // Fetch orders from eBay
    const ordersResponse = await axios.get(`${EBAY_API_BASE}/sell/fulfillment/v1/order`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        limit: Math.min(limit, 100),
        offset,
        filter: `creationdate:[${startDate.toISOString()}..${endDate.toISOString()}]`,
        orderStatus: 'PAID_AND_SHIPPED'
      }
    });

    const orders = ordersResponse.data.orders || [];
    const sales = [];

    // Process each order
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
          status: order.orderStatus,
          shipping_address: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.addressLine1 + ', ' + 
                          order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.city + ', ' +
                          order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.stateOrProvince + ' ' +
                          order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo?.contactAddress?.postalCode,
          tracking_number: order.fulfillmentStartInstructions?.[0]?.shippingStep?.shipToTrackingNumber || null
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
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: ordersResponse.data.total || 0
      }
    });

  } catch (error) {
    console.error('eBay sales fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch eBay sales' });
  }
});

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

// Get eBay connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const credentials = await dbHelper.get(
      'SELECT store_id, is_active, updated_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'ebay']
    );

    res.json({
      connected: credentials && credentials.is_active,
      lastSync: credentials?.updated_at || null
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

module.exports = router; 