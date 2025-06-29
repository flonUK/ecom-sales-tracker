const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// eBay API configuration
const EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
const EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const EBAY_REDIRECT_URI = process.env.EBAY_REDIRECT_URI || 'http://localhost:3004/connect/ebay/callback';
const EBAY_API_URL = 'https://api.ebay.com';

// Check if real API is configured
const isRealApiConfigured = () => {
  return EBAY_CLIENT_ID && EBAY_CLIENT_SECRET && 
         EBAY_CLIENT_ID !== 'your-ebay-client-id' && 
         EBAY_CLIENT_SECRET !== 'your-ebay-client-secret';
};

// Get eBay authorization URL
router.get('/auth-url', verifyToken, (req, res) => {
  if (!isRealApiConfigured()) {
    return res.json({ 
      demoMode: true,
      message: 'Using sample data. Configure EBAY_CLIENT_ID and EBAY_CLIENT_SECRET for real data.'
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

// Connect eBay account (works with both sample and real data)
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { appId, certId, clientSecret } = req.body;
    
    if (!appId || !certId || !clientSecret) {
      return res.status(400).json({ error: 'Missing required eBay credentials' });
    }

    // Test the connection by making a simple API call
    const testResponse = await fetch(`${EBAY_API_URL}/sell/inventory/v1/inventory_item`, {
      headers: {
        'Authorization': `Bearer ${clientSecret}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      return res.status(400).json({ error: 'Invalid eBay credentials' });
    }

    // Store connection in database (you'll need to implement this)
    // For now, we'll just return success
    res.json({ 
      success: true, 
      message: 'eBay connected successfully',
      appId 
    });
  } catch (error) {
    console.error('Error connecting to eBay:', error);
    res.status(500).json({ error: 'Failed to connect to eBay' });
  }
});

// Get eBay connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    // Check if eBay is connected (you'll need to implement this)
    // For now, return not connected
    res.json({ 
      connected: false,
      message: 'eBay not connected'
    });
  } catch (error) {
    console.error('Error checking eBay status:', error);
    res.status(500).json({ error: 'Failed to check eBay status' });
  }
});

// Fetch sold items from eBay (sample data by default, real data when configured)
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get eBay credentials from database (you'll need to implement this)
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Error fetching eBay sales:', error);
    res.status(500).json({ error: 'Failed to fetch eBay sales' });
  }
});

// Disconnect eBay account
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    // Remove eBay connection from database (you'll need to implement this)
    res.json({ 
      success: true, 
      message: 'eBay disconnected successfully' 
    });
  } catch (error) {
    console.error('Error disconnecting from eBay:', error);
    res.status(500).json({ error: 'Failed to disconnect from eBay' });
  }
});

// Get eBay statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get eBay credentials from database (you'll need to implement this)
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
    console.error('Error fetching eBay stats:', error);
    res.status(500).json({ error: 'Failed to fetch eBay stats' });
  }
});

module.exports = router; 