const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// Etsy API configuration
const ETSY_API_BASE = 'https://openapi.etsy.com/v3';
const ETSY_CLIENT_ID = process.env.ETSY_CLIENT_ID;
const ETSY_CLIENT_SECRET = process.env.ETSY_CLIENT_SECRET;
const ETSY_REDIRECT_URI = process.env.ETSY_REDIRECT_URI || 'http://localhost:3004/connect/etsy/callback';

// Get Etsy authorization URL
router.get('/auth-url', verifyToken, (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const authUrl = `https://www.etsy.com/oauth/connect?response_type=code&redirect_uri=${encodeURIComponent(ETSY_REDIRECT_URI)}&scope=transactions_r%20listings_r&client_id=${ETSY_CLIENT_ID}&state=${state}`;
  
  res.json({ authUrl, state });
});

// Handle Etsy OAuth callback
router.post('/callback', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'authorization_code',
      client_id: ETSY_CLIENT_ID,
      redirect_uri: ETSY_REDIRECT_URI,
      code: code,
      code_verifier: 'challenge'
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get shop information
    const shopResponse = await axios.get(`${ETSY_API_BASE}/application/shops`, {
      headers: {
        'x-api-key': ETSY_CLIENT_ID,
        'Authorization': `Bearer ${access_token}`
      }
    });

    const shop = shopResponse.data.results[0];

    // Store credentials in database
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    await dbHelper.run(
      `INSERT OR REPLACE INTO api_credentials 
       (user_id, platform, access_token, refresh_token, expires_at, store_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, 'etsy', access_token, refresh_token, expiresAt, shop.shop_id, 1]
    );

    res.json({ 
      message: 'Etsy connected successfully',
      shop: {
        id: shop.shop_id,
        name: shop.shop_name
      }
    });

  } catch (error) {
    console.error('Etsy callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect Etsy account' });
  }
});

// Refresh Etsy access token
async function refreshEtsyToken(userId) {
  try {
    const credentials = await dbHelper.get(
      'SELECT * FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [userId, 'etsy']
    );

    if (!credentials || !credentials.refresh_token) {
      throw new Error('No valid Etsy credentials found');
    }

    const tokenResponse = await axios.post('https://api.etsy.com/v3/public/oauth/token', {
      grant_type: 'refresh_token',
      client_id: ETSY_CLIENT_ID,
      refresh_token: credentials.refresh_token
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
      [access_token, refresh_token, expiresAt, userId, 'etsy']
    );

    return access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// Get Etsy access token
async function getEtsyToken(userId) {
  const credentials = await dbHelper.get(
    'SELECT * FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
    [userId, 'etsy']
  );

  if (!credentials) {
    throw new Error('Etsy not connected');
  }

  // Check if token is expired
  if (new Date(credentials.expires_at) <= new Date()) {
    return await refreshEtsyToken(userId);
  }

  return credentials.access_token;
}

// Fetch sold items from Etsy
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    const accessToken = await getEtsyToken(req.user.userId);
    
    // Get shop ID
    const credentials = await dbHelper.get(
      'SELECT store_id FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [req.user.userId, 'etsy']
    );

    // Fetch receipts (orders) from Etsy
    const receiptsResponse = await axios.get(`${ETSY_API_BASE}/application/shops/${credentials.store_id}/receipts`, {
      headers: {
        'x-api-key': ETSY_CLIENT_ID,
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        limit: Math.min(limit, 100),
        offset,
        was_paid: true,
        was_shipped: true
      }
    });

    const receipts = receiptsResponse.data.results;
    const sales = [];

    // Process each receipt
    for (const receipt of receipts) {
      // Get transaction details for each receipt
      const transactionsResponse = await axios.get(`${ETSY_API_BASE}/application/shops/${credentials.store_id}/receipts/${receipt.receipt_id}/transactions`, {
        headers: {
          'x-api-key': ETSY_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const transactions = transactionsResponse.data.results;

      for (const transaction of transactions) {
        const sale = {
          platform: 'etsy',
          order_id: receipt.receipt_id.toString(),
          item_title: transaction.title,
          item_id: transaction.listing_id.toString(),
          quantity: transaction.quantity,
          price: parseFloat(transaction.price.amount),
          currency: transaction.price.currency_code,
          buyer_name: receipt.name,
          buyer_email: receipt.buyer_email,
          sale_date: new Date(receipt.created_timestamp * 1000),
          status: receipt.status,
          shipping_address: receipt.first_line + ', ' + receipt.second_line + ', ' + receipt.city + ', ' + receipt.state + ' ' + receipt.zip,
          tracking_number: receipt.tracking_code || null
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
      [req.user.userId, 'etsy', sales.length]
    );

    res.json({
      sales,
      count: sales.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: receiptsResponse.data.count
      }
    });

  } catch (error) {
    console.error('Etsy sales fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Etsy sales' });
  }
});

// Disconnect Etsy account
router.delete('/disconnect', verifyToken, async (req, res) => {
  try {
    await dbHelper.run(
      'UPDATE api_credentials SET is_active = 0 WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'etsy']
    );

    res.json({ message: 'Etsy account disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Etsy account' });
  }
});

// Get Etsy connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const credentials = await dbHelper.get(
      'SELECT store_id, is_active, updated_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'etsy']
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