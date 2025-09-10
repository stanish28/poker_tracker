const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database adapter that works with both SQLite (local) and handles Vercel better
class DatabaseAdapter {
  constructor() {
    // Use a more persistent path for Vercel
    const dbPath = process.env.VERCEL 
      ? '/tmp/poker_tracker_persistent.db'
      : path.join(__dirname, 'poker_tracker.db');
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('📊 Connected to SQLite database');
        // Enable WAL mode for better concurrency
        this.db.run('PRAGMA journal_mode=WAL');
        this.db.run('PRAGMA synchronous=NORMAL');
        this.db.run('PRAGMA cache_size=1000');
        this.db.run('PRAGMA temp_store=memory');
      }
    });
    
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Users table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

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
const dbAdapter = new DatabaseAdapter();

module.exports = {
  initializeDatabase: () => dbAdapter.initialize(),
  runQuery: (sql, params) => dbAdapter.runQuery(sql, params),
  getQuery: (sql, params) => dbAdapter.getQuery(sql, params),
  allQuery: (sql, params) => dbAdapter.allQuery(sql, params),
  db: dbAdapter.db
};
