// Simple test to check database connection
const { Pool } = require('pg');

console.log('🔄 Testing database connection...');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL:', process.env.VERCEL);

if (process.env.DATABASE_URL) {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    pool.query('SELECT NOW()', (err, result) => {
      if (err) {
        console.error('❌ Database connection failed:', err);
        process.exit(1);
      } else {
        console.log('✅ Database connection successful:', result.rows[0]);
        process.exit(0);
      }
    });
  } catch (error) {
    console.error('❌ Database pool creation failed:', error);
    process.exit(1);
  }
} else {
  console.error('❌ DATABASE_URL environment variable not found');
  process.exit(1);
}
