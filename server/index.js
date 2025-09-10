const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const gameRoutes = require('./routes/games');
const settlementRoutes = require('./routes/settlements');
const { initializeDatabase } = require('./database/init');

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

// Middleware to ensure database is initialized for each request (Vercel serverless)
app.use(async (req, res, next) => {
  if (process.env.VERCEL) {
    try {
      await initializeDatabase();
    } catch (error) {
      console.error('Database initialization error:', error);
      return res.status(500).json({ error: 'Database initialization failed' });
    }
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/settlements', settlementRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
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
