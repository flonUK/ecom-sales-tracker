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
const AMAZON_API_URL = 'https://sellingpartnerapi-na.amazon.com';

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

// Connect to Amazon
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { accessKeyId, secretAccessKey, sellerId, marketplaceId } = req.body;
    
    if (!accessKeyId || !secretAccessKey || !sellerId || !marketplaceId) {
      return res.status(400).json({ error: 'Missing required Amazon credentials' });
    }

    // Test the connection by making a simple API call
    const testResponse = await fetch(`${AMAZON_API_URL}/orders/v0/orders`, {
      headers: {
        'x-amz-access-token': accessKeyId,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      return res.status(400).json({ error: 'Invalid Amazon credentials' });
    }

    // Store connection in database (you'll need to implement this)
    // For now, we'll just return success
    res.json({ 
      success: true, 
      message: 'Amazon connected successfully',
      sellerId 
    });
  } catch (error) {
    console.error('Error connecting to Amazon:', error);
    res.status(500).json({ error: 'Failed to connect to Amazon' });
  }
});

// Get connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    // Check if Amazon is connected (you'll need to implement this)
    // For now, return not connected
    res.json({ 
      connected: false,
      message: 'Amazon not connected'
    });
  } catch (error) {
    console.error('Error checking Amazon status:', error);
    res.status(500).json({ error: 'Failed to check Amazon status' });
  }
});

// Disconnect from Amazon
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    // Remove Amazon connection from database (you'll need to implement this)
    res.json({ 
      success: true, 
      message: 'Amazon disconnected successfully' 
    });
  } catch (error) {
    console.error('Error disconnecting from Amazon:', error);
    res.status(500).json({ error: 'Failed to disconnect from Amazon' });
  }
});

// Get Amazon sales data
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Amazon credentials from database (you'll need to implement this)
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Error fetching Amazon sales:', error);
    res.status(500).json({ error: 'Failed to fetch Amazon sales' });
  }
});

// Get Amazon statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Amazon credentials from database (you'll need to implement this)
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
    console.error('Error fetching Amazon stats:', error);
    res.status(500).json({ error: 'Failed to fetch Amazon stats' });
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

module.exports = router; 