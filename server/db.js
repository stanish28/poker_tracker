const { Pool } = require('pg');

/**
 * Postgres access for the API.
 *
 * The pool is created lazily and cached on the module, so that a warm Vercel
 * serverless invocation reuses the existing connections instead of opening a
 * new pool per request.
 */
let dbPool = null;

async function getDbPool() {
  if (!dbPool) {
    try {
      dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      // Initialize database tables if they don't exist
      await initializeDatabase();
    } catch (error) {
      console.error('❌ Failed to create database pool:', error);
    }
  }
  return dbPool;
}

async function initializeDatabase() {
  try {
    
    // Create users table if it doesn't exist
    await queryDatabase(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    try {
      await queryDatabase(`ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT`);
    } catch (e) {
      console.warn('⚠️ players.email migration skipped:', e?.message || e);
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
  }
}

async function queryDatabase(sql, params = []) {
  try {
    const pool = await getDbPool();
    if (!pool) return null;
    
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      const sqlLower = sql.trim().toLowerCase();
      
      // For UPDATE/INSERT/DELETE with RETURNING, return rows but preserve rowCount
      if (sqlLower.includes('returning') && (sqlLower.startsWith('update') || sqlLower.startsWith('insert') || sqlLower.startsWith('delete'))) {
        return {
          rows: result.rows,
          rowCount: result.rowCount,
          ...result
        };
      }
      // For SELECT queries, return the rows
      else if (sqlLower.startsWith('select')) {
        return result.rows;
      } 
      // For INSERT/UPDATE/DELETE queries without RETURNING, return the result object
      else {
        return result;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Database query failed:', error);
    console.error('❌ SQL:', sql);
    console.error('❌ Params:', params);
    // Return error info for UPDATE/INSERT/DELETE queries
    if (sql.trim().toLowerCase().match(/^(update|insert|delete)/)) {
      return {
        error: true,
        message: error.message,
        code: error.code,
        detail: error.detail,
        rowCount: 0
      };
    }
    return null;
  }
}

/** Whether the pool has been created yet; surfaced by the health endpoint. */
function isPoolReady() {
  return !!dbPool;
}

module.exports = { getDbPool, initializeDatabase, queryDatabase, isPoolReady };
