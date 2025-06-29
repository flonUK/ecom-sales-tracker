const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Swell API configuration - try different possible base URLs
const SWELL_API_URLS = [
  'https://api.swell.store',
  'https://api.swell.is',
  'https://swell.store/api',
  'https://swell.is/api'
];

// Connect to Swell
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { storeId, publicKey, secretKey } = req.body;
    
    if (!storeId || !publicKey || !secretKey) {
      return res.status(400).json({ error: 'Missing required Swell credentials' });
    }

    // Test the connection by trying different API URLs and endpoints
    const endpoints = [
      `/stores/${storeId}`,
      `/stores/${storeId}/products`,
      `/stores/${storeId}/orders`,
      `/api/stores/${storeId}`,
      `/api/products`,
      `/api/orders`
    ];

    let connectionSuccessful = false;
    let lastError = null;

    for (const baseUrl of SWELL_API_URLS) {
      for (const endpoint of endpoints) {
        try {
          console.log(`Testing Swell API: ${baseUrl}${endpoint}`);
          
          const testResponse = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': publicKey,
              'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
          });

          if (testResponse.ok) {
            console.log(`Swell API connection successful: ${baseUrl}${endpoint}`);
            connectionSuccessful = true;
            break;
          } else {
            lastError = {
              status: testResponse.status,
              statusText: testResponse.statusText,
              url: `${baseUrl}${endpoint}`
            };
            console.log(`Swell API test failed: ${baseUrl}${endpoint} - ${testResponse.status} ${testResponse.statusText}`);
          }
        } catch (error) {
          lastError = {
            error: error.message,
            url: `${baseUrl}${endpoint}`
          };
          console.log(`Swell API test error: ${baseUrl}${endpoint} - ${error.message}`);
        }
      }
      
      if (connectionSuccessful) break;
    }

    if (!connectionSuccessful) {
      console.error('Swell API test failed for all URLs and endpoints:', lastError);
      return res.status(400).json({ 
        error: 'Unable to connect to Swell API. Please check your credentials and try again.',
        details: lastError,
        note: 'Make sure your Store ID, Public Key, and Secret Key are correct from your Swell dashboard.'
      });
    }

    // Store connection in database (you'll need to implement this)
    // For now, we'll just return success
    res.json({ 
      success: true, 
      message: 'Swell connected successfully',
      storeId 
    });
  } catch (error) {
    console.error('Error connecting to Swell:', error);
    res.status(500).json({ 
      error: 'Failed to connect to Swell',
      details: error.message 
    });
  }
});

// Get connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    // Check if Swell is connected (you'll need to implement this)
    // For now, return not connected
    res.json({ 
      connected: false,
      message: 'Swell not connected'
    });
  } catch (error) {
    console.error('Error checking Swell status:', error);
    res.status(500).json({ error: 'Failed to check Swell status' });
  }
});

// Disconnect from Swell
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    // Remove Swell connection from database (you'll need to implement this)
    res.json({ 
      success: true, 
      message: 'Swell disconnected successfully' 
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
    
    // Get Swell credentials from database (you'll need to implement this)
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Error fetching Swell sales:', error);
    res.status(500).json({ error: 'Failed to fetch Swell sales' });
  }
});

// Get Swell statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Swell credentials from database (you'll need to implement this)
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
    console.error('Error fetching Swell stats:', error);
    res.status(500).json({ error: 'Failed to fetch Swell stats' });
  }
});

module.exports = router; 