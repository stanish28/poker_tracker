// Vercel injects environment variables; locally they come from server/.env.
if (!process.env.VERCEL) {
  require('dotenv').config();
}

const express = require('express');

const { authGate } = require('./middleware/auth');
const { isPoolReady } = require('./db');

const app = express();

app.use(express.json());

// The gate is registered before the routers so that req.path is still the full
// request path, which is what PUBLIC_PATHS is written against.
app.use(authGate);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database_pool: isPoolReady(),
    version: '1.0.3'
  });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/players', require('./routes/players'));
app.use('/api/games', require('./routes/games'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/discrepancy', require('./routes/discrepancy'));
app.use('/api/bulk-game', require('./routes/bulkGame'));
app.use('/api/export', require('./routes/export'));

// Vercel imports the app; running this file directly serves it locally.
if (require.main === module) {
  const port = process.env.PORT || 5001;
  app.listen(port, () => console.log(`API listening on ${port}`));
}

module.exports = app;
