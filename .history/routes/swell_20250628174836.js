const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Swell API configuration
const SWELL_API_URL = 'https://api.swell.store';

// Connect to Swell
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { storeId, publicKey, secretKey } = req.body;
    
    if (!storeId || !publicKey || !secretKey) {
      return res.status(400).json({ error: 'Missing required Swell credentials' });
    }

    // Test the connection by making a simple API call
    // Swell uses the public key as the API key in Authorization header
    const testResponse = await fetch(`${SWELL_API_URL}/stores/${storeId}/products`, {
      headers: {
        'Authorization': publicKey,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      console.error('Swell API test failed:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        url: `${SWELL_API_URL}/stores/${storeId}/products`
      });
      
      // Try alternative endpoint
      const altResponse = await fetch(`${SWELL_API_URL}/stores/${storeId}`, {
        headers: {
          'Authorization': publicKey,
          'Content-Type': 'application/json'
        }
      });

      if (!altResponse.ok) {
        return res.status(400).json({ 
          error: 'Invalid Swell credentials. Please check your Store ID and Public Key.',
          details: `API test failed with status ${testResponse.status}`
        });
      }
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