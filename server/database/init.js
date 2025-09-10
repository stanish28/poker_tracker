const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Use in-memory database for Vercel serverless functions, file-based for local development
const DB_PATH = process.env.VERCEL ? ':memory:' : path.join(__dirname, 'poker_tracker.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('📊 Connected to SQLite database');
  }
});

let isInitialized = false;

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    // For in-memory database, always reinitialize
    if (isInitialized && !process.env.VERCEL) {
      resolve();
      return;
    }
    
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Players table (GLOBAL - shared across all users)
      db.run(`
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

      // Games table (GLOBAL - shared across all users)
      db.run(`
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
      db.run(`
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
      db.run(`
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
          
          // For Vercel deployment, create demo users and data since database doesn't persist
          if (process.env.VERCEL) {
            const bcrypt = require('bcryptjs');
            
            // Create multiple demo users with fixed IDs for consistency
            const demoUsers = [
              { id: 'demo-user-1', username: 'demo', email: 'demo@example.com', password: 'demo123' },
              { id: 'demo-user-2', username: 'player1', email: 'player1@example.com', password: 'player123' },
              { id: 'demo-user-3', username: 'player2', email: 'player2@example.com', password: 'player123' }
            ];
            
            demoUsers.forEach(user => {
              const passwordHash = bcrypt.hashSync(user.password, 12);
              db.run(
                'INSERT OR REPLACE INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)',
                [user.id, user.username, user.email, passwordHash],
                (err) => {
                  if (err) {
                    console.log(`Error creating user ${user.username}:`, err.message);
                  } else {
                    console.log(`✅ Demo user ${user.username} created`);
                  }
                }
              );
            });
            
            // Create some demo players
            const demoPlayers = [
              { id: 'player-1', name: 'Alice' },
              { id: 'player-2', name: 'Bob' },
              { id: 'player-3', name: 'Charlie' },
              { id: 'player-4', name: 'Diana' }
            ];
            
            demoPlayers.forEach(player => {
              db.run(
                'INSERT OR REPLACE INTO players (id, name, net_profit, total_games, total_buyins, total_cashouts) VALUES (?, ?, ?, ?, ?, ?)',
                [player.id, player.name, 0, 0, 0, 0],
                (err) => {
                  if (!err) {
                    console.log(`✅ Demo player ${player.name} created`);
                  }
                }
              );
            });
          }
          
          isInitialized = true;
          resolve();
        }
      });
    });
  });
};

// Helper function to run queries with promises
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const getQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

module.exports = {
  db,
  initializeDatabase,
  runQuery,
  getQuery,
  allQuery
};
