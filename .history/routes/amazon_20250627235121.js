const express = require('express');
const axios = require('axios');
const { dbHelper } = require('../config/database');
const { verifyToken } = require('./auth');

const router = express.Router();

// Amazon API configuration
const AMAZON_API_BASE = 'https://sellingpartnerapi-na.amazon.com';
const AMAZON_CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const AMAZON_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const AMAZON_REFRESH_TOKEN = process.env.AMAZON_REFRESH_TOKEN;
const AMAZON_MARKETPLACE_ID = process.env.AMAZON_MARKETPLACE_ID || 'ATVPDKIKX0DER'; // US marketplace

// Get Amazon authorization URL
router.get('/auth-url', verifyToken, (req, res) => {
  const state = Math.random().toString(36).substring(7);
  const authUrl = `https://sellercentral.amazon.com/apps/authorize/consent?application_id=${AMAZON_CLIENT_ID}&state=${state}`;
  
  res.json({ authUrl, state });
});

// Handle Amazon OAuth callback
router.post('/callback', verifyToken, async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'https://localhost:3000/connect/amazon/callback',
      client_id: AMAZON_CLIENT_ID,
      client_secret: AMAZON_CLIENT_SECRET
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get seller information
    const sellerResponse = await axios.get(`${AMAZON_API_BASE}/sellers/v1/marketplaceParticipations`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'x-amz-access-token': access_token
      }
    });

    const seller = sellerResponse.data.payload[0];

    // Store credentials in database
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    
    await dbHelper.run(
      `INSERT OR REPLACE INTO api_credentials 
       (user_id, platform, access_token, refresh_token, expires_at, store_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, 'amazon', access_token, refresh_token, expiresAt, seller.sellerId, 1]
    );

    res.json({ 
      message: 'Amazon connected successfully',
      seller: {
        id: seller.sellerId,
        name: seller.sellerBusinessName
      }
    });

  } catch (error) {
    console.error('Amazon callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect Amazon account' });
  }
});

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

// Fetch sold items from Amazon
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    const accessToken = await getAmazonToken(req.user.userId);
    
    // Get seller ID
    const credentials = await dbHelper.get(
      'SELECT store_id FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [req.user.userId, 'amazon']
    );

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days_back));

    // Fetch orders from Amazon
    const ordersResponse = await axios.get(`${AMAZON_API_BASE}/orders/v0/orders`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken
      },
      params: {
        MarketplaceIds: AMAZON_MARKETPLACE_ID,
        CreatedAfter: startDate.toISOString(),
        CreatedBefore: endDate.toISOString(),
        OrderStatuses: 'Shipped',
        MaxResults: Math.min(limit, 100),
        NextToken: offset > 0 ? offset.toString() : undefined
      }
    });

    const orders = ordersResponse.data.Orders || [];
    const sales = [];

    // Process each order
    for (const order of orders) {
      // Get order items
      const itemsResponse = await axios.get(`${AMAZON_API_BASE}/orders/v0/orders/${order.AmazonOrderId}/orderItems`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-amz-access-token': accessToken
        }
      });

      const items = itemsResponse.data.OrderItems || [];

      for (const item of items) {
        const sale = {
          platform: 'amazon',
          order_id: order.AmazonOrderId,
          item_title: item.Title,
          item_id: item.ASIN,
          quantity: item.QuantityOrdered,
          price: parseFloat(item.ItemPrice?.Amount || 0),
          currency: item.ItemPrice?.CurrencyCode || 'USD',
          buyer_name: order.BuyerInfo?.BuyerName || 'Unknown',
          buyer_email: order.BuyerInfo?.BuyerEmail || null,
          sale_date: new Date(order.PurchaseDate),
          status: order.OrderStatus,
          shipping_address: order.ShippingAddress ? 
            `${order.ShippingAddress.AddressLine1}, ${order.ShippingAddress.City}, ${order.ShippingAddress.StateOrRegion} ${order.ShippingAddress.PostalCode}` : null,
          tracking_number: null // Amazon doesn't provide tracking in this API
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

    res.json({
      sales,
      count: sales.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        nextToken: ordersResponse.data.NextToken
      }
    });

  } catch (error) {
    console.error('Amazon sales fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch Amazon sales' });
  }
});

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

// Get Amazon connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const credentials = await dbHelper.get(
      'SELECT store_id, is_active, updated_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'amazon']
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