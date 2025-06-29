const express = require('express');
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const { dbHelper } = require('../config/database');

const router = express.Router();

// Etsy API configuration - using public API
const ETSY_API_BASE = 'https://openapi.etsy.com/v3';
const ETSY_API_KEY = process.env.ETSY_API_KEY;

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

    // For testing without API key, create mock shop data
    if (!ETSY_API_KEY || ETSY_API_KEY === 'your-etsy-api-key') {
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

      return res.json({ 
        message: 'Etsy shop connected successfully (Demo Mode)',
        shop: {
          id: mockShop.shop_id,
          name: mockShop.shop_name,
          url: shopUrl
        }
      });
    }

    // Real API call if API key is available
    try {
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
    } catch (apiError) {
      console.error('Etsy API error:', apiError.response?.data || apiError.message);
      return res.status(500).json({ error: 'Failed to connect Etsy shop. Please check the shop URL or try again later.' });
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
      'SELECT store_id, store_name, store_url, is_active, created_at FROM api_credentials WHERE user_id = ? AND platform = ?',
      [req.user.userId, 'etsy']
    );

    res.json({ shops });
  } catch (error) {
    console.error('Error fetching Etsy shops:', error);
    res.status(500).json({ error: 'Failed to fetch connected shops' });
  }
});

// Fetch sold items from Etsy (using public API or mock data)
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
        // If no API key, generate mock data
        if (!ETSY_API_KEY || ETSY_API_KEY === 'your-etsy-api-key') {
          const mockSales = generateMockEtsySales(shop, limit);
          allSales.push(...mockSales);
          continue;
        }

        // Real API call if API key is available
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
      message: ETSY_API_KEY && ETSY_API_KEY !== 'your-etsy-api-key' ? 
        'Note: This shows active listings. For actual sales data, OAuth authentication is required.' :
        'Demo mode: Showing mock sales data. Connect with real API key for actual data.'
    });

  } catch (error) {
    console.error('Error fetching Etsy sales:', error);
    res.status(500).json({ error: 'Failed to fetch Etsy sales data' });
  }
});

// Generate mock Etsy sales data for testing
function generateMockEtsySales(shop, limit = 10) {
  const mockItems = [
    'Handmade Ceramic Mug',
    'Vintage Jewelry Box',
    'Custom T-Shirt',
    'Wooden Cutting Board',
    'Handmade Soap',
    'Crochet Blanket',
    'Metal Wall Art',
    'Leather Wallet',
    'Glass Vase',
    'Fabric Tote Bag'
  ];

  const mockBuyers = [
    'Sarah Johnson',
    'Mike Chen',
    'Emily Davis',
    'David Wilson',
    'Lisa Brown',
    'James Miller',
    'Amanda Taylor',
    'Robert Anderson',
    'Jennifer Garcia',
    'Christopher Martinez'
  ];

  const sales = [];
  const numSales = Math.min(limit, 10);

  for (let i = 0; i < numSales; i++) {
    const randomItem = mockItems[Math.floor(Math.random() * mockItems.length)];
    const randomBuyer = mockBuyers[Math.floor(Math.random() * mockBuyers.length)];
    const randomPrice = (Math.random() * 50 + 10).toFixed(2);
    const randomDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    sales.push({
      platform: 'etsy',
      order_id: `demo-${shop.store_id}-${i + 1}`,
      item_title: randomItem,
      item_id: `demo-item-${i + 1}`,
      quantity: Math.floor(Math.random() * 3) + 1,
      price: parseFloat(randomPrice),
      currency: 'USD',
      buyer_name: randomBuyer,
      buyer_email: `${randomBuyer.toLowerCase().replace(' ', '.')}@example.com`,
      sale_date: randomDate,
      status: 'completed',
      shipping_address: 'Demo Address, Demo City, DC 12345',
      tracking_number: `DEMO${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      shop_name: shop.store_name
    });
  }

  return sales;
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