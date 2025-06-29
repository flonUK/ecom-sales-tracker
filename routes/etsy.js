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
    const { apiKey, shopId } = req.body;
    
    if (!apiKey || !shopId) {
      return res.status(400).json({ error: 'Missing required Etsy credentials' });
    }

    // Test the connection by making a simple API call
    const testResponse = await fetch(`${ETSY_API_BASE}/application/shops/${shopId}`, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      return res.status(400).json({ error: 'Invalid Etsy credentials' });
    }

    // Store connection in database (you'll need to implement this)
    // For now, we'll just return success
    res.json({ 
      success: true, 
      message: 'Etsy connected successfully',
      shopId 
    });
  } catch (error) {
    console.error('Error connecting to Etsy:', error);
    res.status(500).json({ error: 'Failed to connect to Etsy' });
  }
});

// Get connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    // Check if Etsy is connected (you'll need to implement this)
    // For now, return not connected
    res.json({ 
      connected: false,
      message: 'Etsy not connected'
    });
  } catch (error) {
    console.error('Error checking Etsy status:', error);
    res.status(500).json({ error: 'Failed to check Etsy status' });
  }
});

// Disconnect from Etsy
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    // Remove Etsy connection from database (you'll need to implement this)
    res.json({ 
      success: true, 
      message: 'Etsy disconnected successfully' 
    });
  } catch (error) {
    console.error('Error disconnecting from Etsy:', error);
    res.status(500).json({ error: 'Failed to disconnect from Etsy' });
  }
});

// Get Etsy sales data
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Etsy credentials from database (you'll need to implement this)
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Error fetching Etsy sales:', error);
    res.status(500).json({ error: 'Failed to fetch Etsy sales' });
  }
});

// Get Etsy statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Etsy credentials from database (you'll need to implement this)
    // For now, return empty stats
    res.json({
      totalRevenue: 0,
      totalSales: 0,
      totalItems: 0,
      avgOrderValue: 0,
      profitMargin: 0,
      adSpend: 0,
      roas: 0,
      topProducts: [],
      platformBreakdown: [],
      recentActivity: []
    });
  } catch (error) {
    console.error('Error fetching Etsy stats:', error);
    res.status(500).json({ error: 'Failed to fetch Etsy stats' });
  }
});

module.exports = router; 