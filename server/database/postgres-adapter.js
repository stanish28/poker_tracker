const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database adapter that uses PostgreSQL for production, SQLite for local
class DatabaseAdapter {
  constructor() {
    this.isPostgres = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (this.isPostgres) {
      // PostgreSQL for production
      try {
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        });
        console.log('📊 Connected to PostgreSQL database');
      } catch (error) {
        console.error('PostgreSQL connection error:', error);
        throw error;
      }
    } else {
      // SQLite for local development
      const dbPath = path.join(__dirname, 'poker_tracker.db');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
        } else {
          console.log('📊 Connected to SQLite database');
        }
      });
    }
    
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return Promise.resolve();
    }

    if (this.isPostgres) {
      // PostgreSQL initialization
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        
        // Users table
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Players table
        await client.query(`
          CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            net_profit DECIMAL DEFAULT 0,
            total_games INTEGER DEFAULT 0,
            total_buyins DECIMAL DEFAULT 0,
            total_cashouts DECIMAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Games table
        await client.query(`
          CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            total_buyins DECIMAL DEFAULT 0,
            total_cashouts DECIMAL DEFAULT 0,
            discrepancy DECIMAL DEFAULT 0,
            is_completed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Game players junction table
        await client.query(`
          CREATE TABLE IF NOT EXISTS game_players (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            player_id TEXT NOT NULL,
            buyin DECIMAL DEFAULT 0,
            cashout DECIMAL DEFAULT 0,
            profit DECIMAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games (id) ON DELETE CASCADE,
            FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE,
            UNIQUE(game_id, player_id)
          )
        `);

        // Settlements table
        await client.query(`
          CREATE TABLE IF NOT EXISTS settlements (
            id TEXT PRIMARY KEY,
            from_player_id TEXT NOT NULL,
            to_player_id TEXT NOT NULL,
            from_player_name TEXT NOT NULL,
            to_player_name TEXT NOT NULL,
            amount DECIMAL NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (from_player_id) REFERENCES players (id) ON DELETE CASCADE,
            FOREIGN KEY (to_player_id) REFERENCES players (id) ON DELETE CASCADE
          )
        `);

        await client.query('COMMIT');
        console.log('✅ PostgreSQL tables initialized successfully');
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // SQLite initialization (existing code)
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
              console.log('✅ SQLite tables initialized successfully');
              resolve();
            }
          });
        });
      });
    }
    
    this.isInitialized = true;
  }

  async runQuery(sql, params = []) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        // Convert SQLite syntax to PostgreSQL
        let paramCount = 0;
        let pgSql = sql.replace(/\?/g, () => {
          paramCount++;
          return `$${paramCount}`;
        });
        
        const result = await client.query(pgSql, params);
        return { id: result.rows[0]?.id, changes: result.rowCount };
      } finally {
        client.release();
      }
    } else {
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
  }

  async getQuery(sql, params = []) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        // Convert SQLite syntax to PostgreSQL
        let paramCount = 0;
        let pgSql = sql.replace(/\?/g, () => {
          paramCount++;
          return `$${paramCount}`;
        });
        
        const result = await client.query(pgSql, params);
        return result.rows[0] || null;
      } finally {
        client.release();
      }
    } else {
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
  }

  async allQuery(sql, params = []) {
    if (this.isPostgres) {
      const client = await this.pool.connect();
      try {
        // Convert SQLite syntax to PostgreSQL
        let paramCount = 0;
        let pgSql = sql.replace(/\?/g, () => {
          paramCount++;
          return `$${paramCount}`;
        });
        
        const result = await client.query(pgSql, params);
        return result.rows;
      } finally {
        client.release();
      }
    } else {
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
}

// Create singleton instance
const dbAdapter = new DatabaseAdapter();

module.exports = {
  initializeDatabase: () => dbAdapter.initialize(),
  runQuery: (sql, params) => dbAdapter.runQuery(sql, params),
  getQuery: (sql, params) => dbAdapter.getQuery(sql, params),
  allQuery: (sql, params) => dbAdapter.allQuery(sql, params)
};
