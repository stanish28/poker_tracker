const express = require('express');

const app = express();

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Simple auth endpoint
app.post('/api/auth/login', (req, res) => {
  res.json({ 
    token: 'test-token',
    user: { id: '1', username: 'test' }
  });
});

// Simple verify endpoint
app.get('/api/auth/verify', (req, res) => {
  res.json({ 
    valid: true,
    user: { id: '1', username: 'test' }
  });
});

module.exports = app;
