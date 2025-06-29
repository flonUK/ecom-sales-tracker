const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database setup
const dbPath = path.join(__dirname, '../data/sales.db');
const db = new sqlite3.Database(dbPath);

// Connect to Swell
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { storeId, publicKey, secretKey } = req.body;
    
    if (!storeId || !publicKey || !secretKey) {
      return res.status(400).json({ error: 'Missing required Swell credentials' });
    }

    // Store connection in database
    const query = `
      INSERT OR REPLACE INTO api_credentials 
      (user_id, platform, store_id, store_name, public_key, secret_key, is_active, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    
    db.run(query, [
      req.user.userId, 
      'swell', 
      storeId, 
      `Swell Store: ${storeId}`, 
      publicKey, 
      secretKey, 
      1
    ], function(err) {
      if (err) {
        console.error('Database error saving Swell credentials:', err);
        return res.status(500).json({ 
          error: 'Failed to save Swell credentials',
          details: err.message 
        });
      }
      
      console.log('Swell credentials saved successfully for user:', req.user.userId);
      res.json({ 
        success: true, 
        message: 'Swell connected successfully',
        storeId,
        note: 'Credentials will be tested when fetching data'
      });
    });
  } catch (error) {
    console.error('Error saving Swell credentials:', error);
    res.status(500).json({ 
      error: 'Failed to save Swell credentials',
      details: error.message 
    });
  }
});

// Get connection status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT store_id, store_name, is_active, created_at, updated_at 
      FROM api_credentials 
      WHERE user_id = ? AND platform = ? AND is_active = 1
    `;
    
    db.get(query, [req.user.userId, 'swell'], (err, row) => {
      if (err) {
        console.error('Database error checking Swell status:', err);
        return res.status(500).json({ error: 'Failed to check Swell status' });
      }
      
      if (row) {
        res.json({ 
          connected: true,
          message: 'Swell connected',
          storeId: row.store_id,
          storeName: row.store_name,
          lastSync: row.updated_at
        });
      } else {
        res.json({ 
          connected: false,
          message: 'Swell not connected'
        });
      }
    });
  } catch (error) {
    console.error('Error checking Swell status:', error);
    res.status(500).json({ error: 'Failed to check Swell status' });
  }
});

// Disconnect from Swell
router.post('/disconnect', verifyToken, async (req, res) => {
  try {
    const query = `
      UPDATE api_credentials 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ? AND platform = ?
    `;
    
    db.run(query, [req.user.userId, 'swell'], function(err) {
      if (err) {
        console.error('Database error disconnecting Swell:', err);
        return res.status(500).json({ error: 'Failed to disconnect from Swell' });
      }
      
      console.log('Swell disconnected successfully for user:', req.user.userId);
      res.json({ 
        success: true, 
        message: 'Swell disconnected successfully' 
      });
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
    
    // Get Swell credentials from database
    const query = `
      SELECT store_id, public_key, secret_key 
      FROM api_credentials 
      WHERE user_id = ? AND platform = ? AND is_active = 1
    `;
    
    db.get(query, [req.user.userId, 'swell'], (err, credentials) => {
      if (err) {
        console.error('Database error fetching Swell credentials:', err);
        return res.status(500).json({ error: 'Failed to fetch Swell credentials' });
      }
      
      if (!credentials) {
        return res.status(404).json({ error: 'Swell not connected' });
      }
      
      // For now, return empty array (we'll implement actual API calls later)
      res.json([]);
    });
  } catch (error) {
    console.error('Error fetching Swell sales:', error);
    res.status(500).json({ error: 'Failed to fetch Swell sales' });
  }
});

// Get Swell statistics
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const { days_back = 30 } = req.query;
    
    // Get Swell credentials from database
    const query = `
      SELECT store_id, public_key, secret_key 
      FROM api_credentials 
      WHERE user_id = ? AND platform = ? AND is_active = 1
    `;
    
    db.get(query, [req.user.userId, 'swell'], (err, credentials) => {
      if (err) {
        console.error('Database error fetching Swell credentials:', err);
        return res.status(500).json({ error: 'Failed to fetch Swell credentials' });
      }
      
      if (!credentials) {
        return res.status(404).json({ error: 'Swell not connected' });
      }
      
      // For now, return empty stats (we'll implement actual API calls later)
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
    });
  } catch (error) {
    console.error('Error fetching Swell stats:', error);
    res.status(500).json({ error: 'Failed to fetch Swell stats' });
  }
});

module.exports = router; 