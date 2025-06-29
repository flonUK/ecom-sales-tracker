const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// Etsy API configuration - using public API
const ETSY_API_BASE = 'https://openapi.etsy.com/v3';
const ETSY_API_KEY = process.env.ETSY_API_KEY || 'your-etsy-api-key';

// Connect Etsy shop using shop URL (no OAuth required)
router.post('/connect', verifyToken, async (req, res) => {
  try {
    const { shopUrl } = req.body;

    if (!shopUrl) {
      return res.status(400).json({ error: 'Shop URL is required' });
    }

    // Extract shop name from URL (e.g., "myshop" from "https://www.etsy.com/shop/myshop")
    const shopNameMatch = shopUrl.match(/etsy\.com\/shop\/([^\/\?]+)/);
    if (!shopNameMatch) {
      return res.status(400).json({ error: 'Invalid Etsy shop URL. Please use format: https://www.etsy.com/shop/your-shop-name' });
    }

    const shopName = shopNameMatch[1];

    // Get shop information using public API
    const shopResponse = await axios.get(`${ETSY_API_BASE}/application/shops/${shopName}`, {
      headers: {
        'x-api-key': ETSY_API_KEY
      }
    });

    const shop = shopResponse.data.results[0];

    // Store shop connection in database
    await dbHelper.run(
      `INSERT OR REPLACE INTO api_credentials 
       (user_id, platform, store_id, store_name, store_url, is_active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [req.user.userId, 'etsy', shop.shop_id, shop.shop_name, shopUrl, 1]
    );

    res.json({ 
      message: 'Etsy shop connected successfully',
      shop: {
        id: shop.shop_id,
        name: shop.shop_name,
        url: shopUrl
      }
    });

  } catch (error) {
    console.error('Etsy connection error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Shop not found. Please check the shop URL and make sure the shop exists.' });
    }
    
    res.status(500).json({ error: 'Failed to connect Etsy shop' });
  }
});

// Get connected Etsy shops
router.get('/shops', verifyToken, async (req, res) => {
  try {
    const shops = await dbHelper.all(
      'SELECT store_id, store_name, store_url, is_active, created_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'etsy']
    );

    res.json({ shops });
  } catch (error) {
    console.error('Error fetching Etsy shops:', error);
    res.status(500).json({ error: 'Failed to fetch connected shops' });
  }
});

// Fetch sold items from Etsy (using public API)
router.get('/sales', verifyToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, days_back = 30 } = req.query;
    
    // Get connected shops
    const shops = await dbHelper.all(
      'SELECT store_id, store_name FROM api_credentials WHERE user_id = ? AND platform = ? AND is_active = 1',
      [req.user.userId, 'etsy']
    );

    if (shops.length === 0) {
      return res.status(404).json({ error: 'No Etsy shops connected. Please connect a shop first.' });
    }

    const allSales = [];

    // Fetch sales from each connected shop
    for (const shop of shops) {
      try {
        // Get shop's active listings (public data)
        const listingsResponse = await axios.get(`${ETSY_API_BASE}/application/shops/${shop.store_id}/listings/active`, {
          headers: {
            'x-api-key': ETSY_API_KEY
          },
          params: {
            limit: Math.min(limit, 100),
            offset
          }
        });

        const listings = listingsResponse.data.results;

        // For each listing, create a mock sale record (since we can't access private sales data)
        // In a real implementation, you'd need OAuth for actual sales data
        for (const listing of listings) {
          const sale = {
            platform: 'etsy',
            order_id: `listing-${listing.listing_id}`,
            item_title: listing.title,
            item_id: listing.listing_id.toString(),
            quantity: 1,
            price: parseFloat(listing.price.amount),
            currency: listing.price.currency_code,
            buyer_name: 'Public Listing',
            buyer_email: null,
            sale_date: new Date(listing.created_timestamp * 1000),
            status: 'active',
            shipping_address: null,
            tracking_number: null,
            shop_name: shop.store_name
          };

          allSales.push(sale);
        }
      } catch (shopError) {
        console.error(`Error fetching data for shop ${shop.store_name}:`, shopError);
        // Continue with other shops
      }
    }

    res.json({ 
      sales: allSales,
      total: allSales.length,
      message: 'Note: This shows active listings. For actual sales data, OAuth authentication is required.'
    });

  } catch (error) {
    console.error('Error fetching Etsy sales:', error);
    res.status(500).json({ error: 'Failed to fetch Etsy sales data' });
  }
});

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