const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Load environment variables (only if not on Vercel)
if (!process.env.VERCEL) {
  require('dotenv').config();
}

// Ensure JWT_SECRET is available
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_jwt_secret_key_here') {
  console.error('❌ JWT_SECRET environment variable is not properly configured');
  if (!process.env.VERCEL) {
    process.exit(1);
  }
}

const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const gameRoutes = require('./routes/games');
const settlementRoutes = require('./routes/settlements');
const { initializeDatabase } = require('./database/postgres-adapter');

const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // Allow all origins in production for Vercel deployment
    : ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database on startup (non-blocking)
let dbInitialized = false;
if (process.env.VERCEL) {
  initializeDatabase()
    .then(() => {
      console.log('✅ Database initialized successfully on startup');
      dbInitialized = true;
    })
    .catch((error) => {
      console.error('❌ Database initialization failed on startup:', error);
      // Don't exit, let the app continue with limited functionality
    });
}

// Middleware to check database status (non-blocking)
app.use(async (req, res, next) => {
  if (process.env.VERCEL && !dbInitialized) {
    try {
      console.log('🔄 Attempting database initialization...');
      await initializeDatabase();
      console.log('✅ Database initialization successful');
      dbInitialized = true;
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      // Continue without blocking the request
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database_initialized: dbInitialized,
    vercel: !!process.env.VERCEL
  });
});

// Database status endpoint
app.get('/api/db-status', async (req, res) => {
  try {
    const { getQuery } = require('./database/postgres-adapter');
    const result = await getQuery('SELECT COUNT(*) as count FROM users');
    res.json({ 
      status: 'OK', 
      database_connected: true,
      user_count: result?.count || 0
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      database_connected: false,
      error: error.message 
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/settlements', settlementRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  console.error('Stack trace:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    
    // Only start listening if not on Vercel (serverless)
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      });
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

// Initialize database on startup
startServer();

// For Vercel serverless functions, export the app
module.exports = app;
