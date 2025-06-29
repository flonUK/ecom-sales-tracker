const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/sales.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create sales table
      db.run(`
        CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          order_id TEXT NOT NULL,
          item_title TEXT NOT NULL,
          item_id TEXT,
          quantity INTEGER DEFAULT 1,
          price REAL NOT NULL,
          currency TEXT DEFAULT 'USD',
          buyer_name TEXT,
          buyer_email TEXT,
          sale_date DATETIME NOT NULL,
          status TEXT DEFAULT 'completed',
          shipping_address TEXT,
          tracking_number TEXT,
          sku TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(user_id, platform, order_id, item_id)
        )
      `);

      // Create platforms table
      db.run(`
        CREATE TABLE IF NOT EXISTS platforms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create api_credentials table for storing platform connections
      db.run(`
        CREATE TABLE IF NOT EXISTS api_credentials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          store_id TEXT,
          store_name TEXT,
          store_url TEXT,
          public_key TEXT,
          secret_key TEXT,
          access_token TEXT,
          refresh_token TEXT,
          expires_at DATETIME,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Create sync_history table
      db.run(`
        CREATE TABLE IF NOT EXISTS sync_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          platform TEXT NOT NULL,
          items_synced INTEGER DEFAULT 0,
          sync_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'completed',
          error_message TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // Insert default platforms if they don't exist
      const platforms = [
        { name: 'etsy', display_name: 'Etsy' },
        { name: 'ebay', display_name: 'eBay' },
        { name: 'amazon', display_name: 'Amazon' },
        { name: 'swell', display_name: 'Swell' }
      ];

      platforms.forEach(platform => {
        db.run(`
          INSERT OR IGNORE INTO platforms (name, display_name) 
          VALUES (?, ?)
        `, [platform.name, platform.display_name]);
      });

      // Migration: Add missing columns to existing api_credentials table
      const migrations = [
        'ALTER TABLE api_credentials ADD COLUMN public_key TEXT',
        'ALTER TABLE api_credentials ADD COLUMN secret_key TEXT',
        'ALTER TABLE api_credentials ADD COLUMN store_name TEXT',
        'ALTER TABLE api_credentials ADD COLUMN store_url TEXT',
        'ALTER TABLE api_credentials ADD COLUMN is_active INTEGER DEFAULT 1',
        'ALTER TABLE api_credentials ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP'
      ];

      migrations.forEach((migration, index) => {
        db.run(migration, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.log(`Migration ${index + 1} completed or column already exists`);
          }
        });
      });

      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Error enabling foreign keys:', err);
          reject(err);
        } else {
          console.log('Database initialized successfully');
          resolve();
        }
      });
    });
  });
};

// Database helper functions
const dbHelper = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  },

  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
};

module.exports = { db, dbHelper, initDatabase }; 