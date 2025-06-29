const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

// Swell API configuration
const SWELL_API_BASE = 'https://api.swell.store';

// Helper function to make Swell API calls
async function makeSwellRequest(endpoint, options = {}) {
  const url = `${SWELL_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`Swell API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// Test connection and get store info
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { storeId, publicKey, secretKey, environment } = req.body;
    
    if (!storeId || !publicKey || !secretKey) {
      return res.status(400).json({ error: 'Missing required credentials' });
    }

    // Test the connection by fetching store info
    const storeInfo = await makeSwellRequest(`/stores/${storeId}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`
      }
    });

    // Store connection info in database (you'll need to implement this)
    // For now, we'll just return success
    
    res.json({
      message: 'Swell store connected successfully!',
      storeInfo: {
        name: storeInfo.name,
        environment: environment,
        connected: true,
        lastSync: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Swell connection error:', error);
    res.status(500).json({ error: 'Failed to connect to Swell store' });
  }
});

// Get connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    // In a real implementation, you'd check the database for stored credentials
    // For now, return a mock status
    res.json({
      connected: false,
      message: 'Swell not connected'
    });
  } catch (error) {
    console.error('Swell status error:', error);
    res.status(500).json({ error: 'Failed to get Swell status' });
  }
});

// Disconnect Swell
router.delete('/disconnect', verifyToken, async (req, res) => {
  try {
    // In a real implementation, you'd remove stored credentials from database
    res.json({ message: 'Swell disconnected successfully' });
  } catch (error) {
    console.error('Swell disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Swell' });
  }
});

// Get sales data from Swell
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { start_date, end_date, limit = 100 } = req.query;
    
    // In a real implementation, you'd use stored credentials
    // For now, return mock data
    const mockSales = [
      {
        id: 'swell_1',
        order_number: 'SW-001',
        customer_name: 'John Doe',
        total: 299.99,
        status: 'completed',
        created_at: new Date().toISOString(),
        platform: 'swell'
      },
      {
        id: 'swell_2',
        order_number: 'SW-002',
        customer_name: 'Jane Smith',
        total: 149.50,
        status: 'completed',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        platform: 'swell'
      }
    ];

    res.json({
      sales: mockSales,
      total: mockSales.length,
      platform: 'swell'
    });
  } catch (error) {
    console.error('Swell sales error:', error);
    res.status(500).json({ error: 'Failed to fetch Swell sales' });
  }
});

// Get Swell store statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    // In a real implementation, you'd calculate real stats
    const mockStats = {
      total_revenue: 15480.50,
      total_orders: 45,
      average_order_value: 344.01,
      top_products: [
        { name: 'Premium Widget', sales: 12, revenue: 2400 },
        { name: 'Standard Widget', sales: 18, revenue: 1800 },
        { name: 'Basic Widget', sales: 15, revenue: 900 }
      ],
      platform: 'swell'
    };

    res.json(mockStats);
  } catch (error) {
    console.error('Swell stats error:', error);
    res.status(500).json({ error: 'Failed to fetch Swell statistics' });
  }
});

module.exports = router; 