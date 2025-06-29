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

// Check if real API is configured
const isRealApiConfigured = () => {
  return ETSY_CLIENT_ID && ETSY_CLIENT_SECRET && 
         ETSY_CLIENT_ID !== 'your-etsy-client-id' && 
         ETSY_CLIENT_SECRET !== 'your-etsy-client-secret';
};

// Get Etsy authorization URL for OAuth
router.get('/auth-url', verifyToken, (req, res) => {
  if (!isRealApiConfigured()) {
    return res.json({ 
      demoMode: true,
      message: 'Using sample data. Configure ETSY_CLIENT_ID and ETSY_CLIENT_SECRET for real data.'
    });
  }

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

    if (!ETSY_CLIENT_ID || !ETSY_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Etsy OAuth not configured' });
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
       (user_id, platform, access_token, refresh_token, expires_at, store_id, store_name, store_url, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, 'etsy', access_token, refresh_token, expiresAt, shop.shop_id, shop.shop_name, `https://www.etsy.com/shop/${shop.shop_name}`, 1]
    );

    res.json({ 
      message: 'Etsy connected successfully with OAuth',
      shop: {
        id: shop.shop_id,
        name: shop.shop_name,
        url: `https://www.etsy.com/shop/${shop.shop_name}`
      }
    });

  } catch (error) {
    console.error('Etsy OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to connect Etsy account via OAuth' });
  }
});

// Connect Etsy shop (works with both sample and real data)
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { shopUrl } = req.body;

    if (!shopUrl) {
      return res.status(400).json({ error: 'Shop URL is required' });
    }

    // Extract shop name from URL
    const shopNameMatch = shopUrl.match(/etsy\.com\/shop\/([^\/\?]+)/);
    if (!shopNameMatch) {
      return res.status(400).json({ error: 'Invalid Etsy shop URL. Please use format: https://www.etsy.com/shop/your-shop-name' });
    }

    const shopName = shopNameMatch[1];

    if (isRealApiConfigured()) {
      // Real API mode - start OAuth flow
      return res.json({ 
        message: 'OAuth required for real data',
        requiresOAuth: true,
        shopUrl: shopUrl
      });
    } else {
      // Sample data mode - create mock shop
      const mockShop = {
        shop_id: shopName,
        shop_name: shopName.charAt(0).toUpperCase() + shopName.slice(1) + ' Shop'
      };

      // Store shop connection in database
      await dbHelper.run(
        `INSERT OR REPLACE INTO api_credentials 
         (user_id, platform, store_id, store_name, store_url, is_active, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [req.user.userId, 'etsy', mockShop.shop_id, mockShop.shop_name, shopUrl, 1]
      );

      res.json({ 
        message: 'Etsy shop connected successfully (Sample Data Mode)',
        shop: {
          id: mockShop.shop_id,
          name: mockShop.shop_name,
          url: shopUrl
        },
        demoMode: true,
        note: 'Using sample data. Add real API credentials to .env for real data.'
      });
    }

  } catch (error) {
    console.error('Etsy connection error:', error);
    res.status(500).json({ error: 'Failed to connect Etsy shop' });
  }
});

// Get connected Etsy shops
router.get('/shops', verifyToken, async (req, res) => {
  try {
    const shops = await dbHelper.all(
      'SELECT store_id, store_name, store_url, is_active, created_at, access_token FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'etsy']
    );

    res.json({ 
      shops,
      demoMode: !isRealApiConfigured(),
      note: isRealApiConfigured() ? 'Real API configured' : 'Using sample data'
    });
  } catch (error) {
    console.error('Error fetching Etsy shops:', error);
    res.status(500).json({ error: 'Failed to fetch connected shops' });
  }
});

// Fetch sold items from Etsy (sample data by default, real data when configured)
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    // Get connected shops
    const shops = await dbHelper.all(
      'SELECT store_id, store_name, access_token FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [req.user.userId, 'etsy']
    );

    if (shops.length === 0) {
      return res.status(404).json({ error: 'No Etsy shops connected. Please connect a shop first.' });
    }

    const allSales = [];
    let usingSampleData = false;

    // Fetch sales from each connected shop
    for (const shop of shops) {
      try {
        if (isRealApiConfigured() && shop.access_token) {
          // Real API mode - get actual data
          const accessToken = await getEtsyToken(req.user.userId);
          
          // Get real receipts (orders) from Etsy
          const receiptsResponse = await axios.get(`${ETSY_API_BASE}/application/shops/${shop.store_id}/receipts`, {
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

          // Process each receipt
          for (const receipt of receipts) {
            // Get transaction details for each receipt
            const transactionsResponse = await axios.get(`${ETSY_API_BASE}/application/shops/${shop.store_id}/receipts/${receipt.receipt_id}/transactions`, {
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
                tracking_number: receipt.tracking_code || null,
                shop_name: shop.store_name,
                data_source: 'real'
              };

              allSales.push(sale);

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
            [req.user.userId, 'etsy', receipts.length]
          );

        } else {
          // Sample data mode - generate realistic mock data
          usingSampleData = true;
          const mockSales = generateSampleEtsySales(shop, limit);
          allSales.push(...mockSales);
        }
      } catch (shopError) {
        console.error(`Error fetching data for shop ${shop.store_name}:`, shopError);
        // Fall back to sample data if API fails
        usingSampleData = true;
        const mockSales = generateSampleEtsySales(shop, limit);
        allSales.push(...mockSales);
      }
    }

    res.json({ 
      sales: allSales,
      total: allSales.length,
      demoMode: usingSampleData || !isRealApiConfigured(),
      message: usingSampleData ? 
        'Sample data mode: Add ETSY_CLIENT_ID and ETSY_CLIENT_SECRET to .env for real data' :
        'Real sales data from Etsy API'
    });

  } catch (error) {
    console.error('Error fetching Etsy sales:', error);
    res.status(500).json({ error: 'Failed to fetch Etsy sales data' });
  }
});

// Generate realistic sample Etsy sales data
function generateSampleEtsySales(shop, limit = 10) {
  const sampleItems = [
    'Handmade Ceramic Mug',
    'Vintage Jewelry Box',
    'Custom T-Shirt',
    'Wooden Cutting Board',
    'Handmade Soap',
    'Crochet Blanket',
    'Metal Wall Art',
    'Leather Wallet',
    'Glass Vase',
    'Fabric Tote Bag',
    'Handmade Candles',
    'Vintage Book',
    'Custom Phone Case',
    'Handmade Jewelry',
    'Art Print'
  ];

  const sampleBuyers = [
    'Sarah Johnson',
    'Mike Chen',
    'Emily Davis',
    'David Wilson',
    'Lisa Brown',
    'James Miller',
    'Amanda Taylor',
    'Robert Anderson',
    'Jennifer Garcia',
    'Christopher Martinez',
    'Jessica Lee',
    'Michael Thompson',
    'Ashley White',
    'Daniel Rodriguez',
    'Nicole Clark'
  ];

  const sales = [];
  const numSales = Math.min(limit, 15);

  for (let i = 0; i < numSales; i++) {
    const randomItem = sampleItems[Math.floor(Math.random() * sampleItems.length)];
    const randomBuyer = sampleBuyers[Math.floor(Math.random() * sampleBuyers.length)];
    const randomPrice = (Math.random() * 80 + 10).toFixed(2);
    const randomDate = new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000);

    sales.push({
      platform: 'etsy',
      order_id: `sample-etsy-${shop.store_id}-${i + 1}`,
      item_title: randomItem,
      item_id: `sample-item-${i + 1}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: parseFloat(randomPrice),
      currency: 'USD',
      buyer_name: randomBuyer,
      buyer_email: `${randomBuyer.toLowerCase().replace(' ', '.')}@example.com`,
      sale_date: randomDate,
      status: 'completed',
      shipping_address: `${Math.floor(Math.random() * 9999)} Sample St, Sample City, SC ${Math.floor(Math.random() * 90000) + 10000}`,
      tracking_number: `SAMPLE${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      shop_name: shop.store_name,
      data_source: 'sample'
    });
  }

  return sales;
}

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

// Disconnect Etsy shop
router.delete('/disconnect/:shopId', verifyToken, async (req, res) => {
  try {
    const { shopId } = req.params;

    await dbHelper.run(
      'UPDATE api_credentials SET is_active = 0 WHERE user_id = ? AND platform = ? AND store_id = ?',
      [req.user.userId, 'etsy', shopId]
    );

    res.json({ message: 'Etsy shop disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Etsy shop:', error);
    res.status(500).json({ error: 'Failed to disconnect shop' });
  }
});

module.exports = router; 