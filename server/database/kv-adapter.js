const { kv } = require('@vercel/kv');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Hybrid adapter: KV for users (persistent), SQLite for other data (session-based)
class HybridDatabaseAdapter {
  constructor() {
    // SQLite for non-user data (players, games, settlements)
    const dbPath = process.env.VERCEL 
      ? '/tmp/poker_data.db'
      : path.join(__dirname, 'poker_tracker.db');
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('📊 Connected to SQLite database for data');
        // Enable optimizations
        this.db.run('PRAGMA journal_mode=WAL');
        this.db.run('PRAGMA synchronous=NORMAL');
      }
    });
    
    this.isInitialized = false;
    this.useKV = process.env.VERCEL && process.env.KV_REST_API_URL;
  }

  async initialize() {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Only create non-user tables in SQLite
        // Users will be stored in KV for persistence
        
        // Players table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            net_profit REAL DEFAULT 0,
            total_games INTEGER DEFAULT 0,
            total_buyins REAL DEFAULT 0,
            total_cashouts REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Games table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            total_buyins REAL DEFAULT 0,
            total_cashouts REAL DEFAULT 0,
            discrepancy REAL DEFAULT 0,
            is_completed BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Game players junction table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS game_players (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            buyin REAL DEFAULT 0,
            cashout REAL DEFAULT 0,
            profit REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
            FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
            UNIQUE(game_id, player_id)
          )
        `);

        // Settlements table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS settlements (
            id TEXT PRIMARY KEY,
            from_player_id TEXT NOT NULL,
            to_player_id TEXT NOT NULL,
            from_player_name TEXT NOT NULL,
            to_player_name TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_player_id) REFERENCES players (id) ON DELETE CASCADE,
            FOREIGN KEY (to_player_id) REFERENCES players (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error creating tables:', err.message);
            reject(err);
          } else {
            console.log('✅ Database tables initialized successfully');
            this.isInitialized = true;
            resolve();
          }
        });
      });
    });
  }

  // User methods - use KV for persistence in production, SQLite for local
  async createUser(userData) {
    if (this.useKV) {
      // Store in KV with username and email as keys for lookup
      await kv.set(`user:${userData.id}`, userData);
      await kv.set(`user:username:${userData.username}`, userData.id);
      await kv.set(`user:email:${userData.email}`, userData.id);
      return { id: userData.id, changes: 1 };
    } else {
      // Use SQLite for local development
      return this.runQuery(
        'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
        [userData.id, userData.username, userData.email, userData.password_hash]
      );
    }
  }

  async getUserByCredential(credential) {
    if (this.useKV) {
      // Try to find user by username or email
      let userId = await kv.get(`user:username:${credential}`);
      if (!userId) {
        userId = await kv.get(`user:email:${credential}`);
      }
      if (userId) {
        return await kv.get(`user:${userId}`);
      }
      return null;
    } else {
      // Use SQLite for local development
      return this.getQuery(
        'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
        [credential, credential]
      );
    }
  }

  async getUserById(userId) {
    if (this.useKV) {
      return await kv.get(`user:${userId}`);
    } else {
      return this.getQuery('SELECT id, username, email FROM users WHERE id = ?', [userId]);
    }
  }

  // Regular SQLite methods for other data
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

// Create singleton instance
const dbAdapter = new HybridDatabaseAdapter();

module.exports = {
  initializeDatabase: () => dbAdapter.initialize(),
  createUser: (userData) => dbAdapter.createUser(userData),
  getUserByCredential: (credential) => dbAdapter.getUserByCredential(credential),
  getUserById: (userId) => dbAdapter.getUserById(userId),
  runQuery: (sql, params) => dbAdapter.runQuery(sql, params),
  getQuery: (sql, params) => dbAdapter.getQuery(sql, params),
  allQuery: (sql, params) => dbAdapter.allQuery(sql, params),
  db: dbAdapter.db
};
