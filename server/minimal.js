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

// Players endpoints (mock data)
app.get('/api/players', (req, res) => {
  res.json([
    {
      id: '1',
      name: 'Player 1',
      net_profit: '100.00',
      total_games: 5,
      total_buyins: '500.00',
      total_cashouts: '600.00',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Player 2',
      net_profit: '-50.00',
      total_games: 3,
      total_buyins: '300.00',
      total_cashouts: '250.00',
      created_at: new Date().toISOString()
    }
  ]);
});

app.get('/api/players/net-profit/bulk', (req, res) => {
  res.json([
    {
      player_id: '1',
      game_net_profit: 100.00,
      settlement_impact: 0,
      true_net_profit: 100.00,
      settlements_count: 0
    },
    {
      player_id: '2',
      game_net_profit: -50.00,
      settlement_impact: 0,
      true_net_profit: -50.00,
      settlements_count: 0
    }
  ]);
});

// Games endpoints (mock data)
app.get('/api/games', (req, res) => {
  res.json([
    {
      id: '1',
      date: new Date().toISOString(),
      total_buyins: '800.00',
      total_cashouts: '800.00',
      player_count: 4,
      is_completed: true
    }
  ]);
});

app.get('/api/games/stats/overview', (req, res) => {
  res.json({
    total_games: 1,
    total_buyins: '800.00'
  });
});

// Settlements endpoints (mock data)
app.get('/api/settlements', (req, res) => {
  res.json([]);
});

app.get('/api/settlements/stats/overview', (req, res) => {
  res.json({
    total_settlements: 0,
    total_amount: '0.00'
  });
});

module.exports = app;
