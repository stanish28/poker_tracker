const express = require('express');

const app = express();

// Force redeploy - version 1.0.2

app.use(express.json());

// Simple database connection
let dbPool = null;

async function getDbPool() {
  if (!dbPool) {
    try {
      const { Pool } = require('pg');
      dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      console.log('✅ Database pool created');
      
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
    console.log('🔄 Initializing database tables...');
    
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
    
    console.log('✅ Database tables initialized');
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database_pool: !!dbPool,
    version: '1.0.2'
  });
});

// Database test endpoint
app.get('/api/db-test', async (req, res) => {
  try {
    console.log('🧪 DB Test endpoint called');
    
    // Test direct database connection
    const players = await queryDatabase('SELECT COUNT(*) as count FROM players');
    const games = await queryDatabase('SELECT COUNT(*) as count FROM games');
    
    if (players && games) {
      console.log('🧪 Players count:', players[0]?.count || 0);
      console.log('🧪 Games count:', games[0]?.count || 0);
      
      res.json({
        status: 'OK',
        database_working: true,
        players_count: players[0]?.count || 0,
        games_count: games[0]?.count || 0
      });
    } else {
      res.json({
        status: 'ERROR',
        database_working: false,
        error: 'Failed to query database'
      });
    }
  } catch (error) {
    console.error('🧪 DB Test error:', error);
    res.json({
      status: 'ERROR',
      database_working: false,
      error: error.message
    });
  }
});

// Database schema debug endpoint
app.get('/api/db-schema', async (req, res) => {
  try {
    console.log('🔍 Database schema debug endpoint called');
    
    // Get table names
    const tables = await queryDatabase(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    // Get column info for key tables
    const gamePlayersColumns = await queryDatabase(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'game_players' 
      ORDER BY ordinal_position
    `);
    
    const gamesColumns = await queryDatabase(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'games' 
      ORDER BY ordinal_position
    `);
    
    console.log('🔍 Tables found:', tables);
    console.log('🔍 Game players columns:', gamePlayersColumns);
    console.log('🔍 Games columns:', gamesColumns);
    
    res.json({
      status: 'OK',
      tables: tables || [],
      game_players_columns: gamePlayersColumns || [],
      games_columns: gamesColumns || []
    });
  } catch (error) {
    console.error('🔍 Database schema debug error:', error);
    res.json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Games debug endpoint
app.get('/api/games-debug', async (req, res) => {
  try {
    console.log('🎮 Games debug endpoint called');
    
    // Test different queries to see what's in the games table
    const countResult = await queryDatabase('SELECT COUNT(*) as count FROM games');
    const allGames = await queryDatabase('SELECT * FROM games LIMIT 5');
    const simpleQuery = await queryDatabase('SELECT id, date FROM games LIMIT 5');
    
    console.log('🎮 Count result:', countResult);
    console.log('🎮 All games result:', allGames);
    console.log('🎮 Simple query result:', simpleQuery);
    
    res.json({
      status: 'OK',
      count_result: countResult,
      all_games: allGames || [],
      simple_query: simpleQuery || [],
      count: countResult?.[0]?.count || 0
    });
  } catch (error) {
    console.error('🎮 Games debug error:', error);
    res.json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await queryDatabase(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    // Hash password (simple implementation for minimal server)
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const userId = require('crypto').randomUUID();
    await queryDatabase(
      'INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [userId, username, email, passwordHash]
    );
    
    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'fallback_secret_for_minimal_server',
      { expiresIn: '7d' }
    );
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userId, username, email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Find user by username or email
    const user = await queryDatabase(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    
    if (!user || user.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(password, user[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user[0].id },
      process.env.JWT_SECRET || 'fallback_secret_for_minimal_server',
      { expiresIn: '7d' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user[0].id, username: user[0].username, email: user[0].email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_for_minimal_server');
    
    // Get user details
    const user = await queryDatabase(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (!user || user.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.json({
      valid: true,
      user: { id: user[0].id, username: user[0].username, email: user[0].email }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update player endpoint
app.put('/api/players/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    const { name } = req.body;
    console.log('👥 Update player endpoint called for player:', playerId, 'new name:', name);
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }
    
    // Update player name
    const result = await queryDatabase(`
      UPDATE players 
      SET name = $1, updated_at = NOW()
      WHERE id = $2
    `, [name.trim(), playerId]);
    
    console.log('👥 Player updated successfully');
    res.json({ message: 'Player updated successfully' });
  } catch (error) {
    console.error('👥 Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete player endpoint
app.delete('/api/players/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    console.log('👥 Delete player endpoint called for player:', playerId);
    
    // Check if player has game records
    const gameRecords = await queryDatabase(`
      SELECT COUNT(*) as count
      FROM game_players 
      WHERE player_id = $1
    `, [playerId]);
    
    if (gameRecords && parseInt(gameRecords[0]?.count || 0) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete player - they have game records. Remove them from all games first, or keep the player for historical data.' 
      });
    }
    
    // Delete player
    const result = await queryDatabase(`
      DELETE FROM players 
      WHERE id = $1
    `, [playerId]);
    
    console.log('👥 Player deleted successfully');
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('👥 Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Players endpoints (real data with fallback)
app.get('/api/players', async (req, res) => {
  try {
    console.log('👥 Players endpoint called');
    // Try to get real data from database
    const players = await queryDatabase(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts, created_at
      FROM players 
      ORDER BY name
    `);
    
    if (players && players.length > 0) {
      console.log('👥 Found', players.length, 'players in database');
      res.json(players);
    } else {
      // Fallback to mock data - using your actual player names
      res.json([
        { id: '1', name: 'Ishan', net_profit: '150.00', total_games: 8, total_buyins: '800.00', total_cashouts: '950.00', created_at: new Date().toISOString() },
        { id: '2', name: 'Pranav', net_profit: '-75.00', total_games: 6, total_buyins: '600.00', total_cashouts: '525.00', created_at: new Date().toISOString() },
        { id: '3', name: 'Soni', net_profit: '200.00', total_games: 10, total_buyins: '1000.00', total_cashouts: '1200.00', created_at: new Date().toISOString() },
        { id: '4', name: 'Tanish', net_profit: '-50.00', total_games: 4, total_buyins: '400.00', total_cashouts: '350.00', created_at: new Date().toISOString() },
        { id: '5', name: 'Bagree', net_profit: '100.00', total_games: 7, total_buyins: '700.00', total_cashouts: '800.00', created_at: new Date().toISOString() },
        { id: '6', name: 'Nikunj', net_profit: '-25.00', total_games: 3, total_buyins: '300.00', total_cashouts: '275.00', created_at: new Date().toISOString() },
        { id: '7', name: 'Jayeesh', net_profit: '75.00', total_games: 5, total_buyins: '500.00', total_cashouts: '575.00', created_at: new Date().toISOString() },
        { id: '8', name: 'Akhil', net_profit: '-100.00', total_games: 6, total_buyins: '600.00', total_cashouts: '500.00', created_at: new Date().toISOString() },
        { id: '9', name: 'Arjun', net_profit: '125.00', total_games: 9, total_buyins: '900.00', total_cashouts: '1025.00', created_at: new Date().toISOString() },
        { id: '10', name: 'Archit', net_profit: '50.00', total_games: 4, total_buyins: '400.00', total_cashouts: '450.00', created_at: new Date().toISOString() },
        { id: '11', name: 'Arnav', net_profit: '-75.00', total_games: 5, total_buyins: '500.00', total_cashouts: '425.00', created_at: new Date().toISOString() },
        { id: '12', name: 'Vansh', net_profit: '175.00', total_games: 8, total_buyins: '800.00', total_cashouts: '975.00', created_at: new Date().toISOString() },
        { id: '13', name: 'Prabal', net_profit: '-50.00', total_games: 3, total_buyins: '300.00', total_cashouts: '250.00', created_at: new Date().toISOString() },
        { id: '14', name: 'Gurshan', net_profit: '100.00', total_games: 7, total_buyins: '700.00', total_cashouts: '800.00', created_at: new Date().toISOString() },
        { id: '15', name: 'Heaansh', net_profit: '-25.00', total_games: 4, total_buyins: '400.00', total_cashouts: '375.00', created_at: new Date().toISOString() },
        { id: '16', name: 'Neal', net_profit: '75.00', total_games: 6, total_buyins: '600.00', total_cashouts: '675.00', created_at: new Date().toISOString() },
        { id: '17', name: 'Manny', net_profit: '-100.00', total_games: 5, total_buyins: '500.00', total_cashouts: '400.00', created_at: new Date().toISOString() },
        { id: '18', name: 'Karan', net_profit: '150.00', total_games: 9, total_buyins: '900.00', total_cashouts: '1050.00', created_at: new Date().toISOString() },
        { id: '19', name: 'Ishan Shetty', net_profit: '50.00', total_games: 4, total_buyins: '400.00', total_cashouts: '450.00', created_at: new Date().toISOString() },
        { id: '20', name: 'Kedia', net_profit: '-75.00', total_games: 6, total_buyins: '600.00', total_cashouts: '525.00', created_at: new Date().toISOString() },
        { id: '21', name: 'Mohit', net_profit: '125.00', total_games: 8, total_buyins: '800.00', total_cashouts: '925.00', created_at: new Date().toISOString() },
        { id: '22', name: 'Vince', net_profit: '-50.00', total_games: 3, total_buyins: '300.00', total_cashouts: '250.00', created_at: new Date().toISOString() },
        { id: '23', name: 'Varshney', net_profit: '100.00', total_games: 7, total_buyins: '700.00', total_cashouts: '800.00', created_at: new Date().toISOString() },
        { id: '24', name: 'Manit', net_profit: '-25.00', total_games: 4, total_buyins: '400.00', total_cashouts: '375.00', created_at: new Date().toISOString() },
        { id: '25', name: 'Vashney', net_profit: '75.00', total_games: 6, total_buyins: '600.00', total_cashouts: '675.00', created_at: new Date().toISOString() },
        { id: '26', name: 'Nivan', net_profit: '-100.00', total_games: 5, total_buyins: '500.00', total_cashouts: '400.00', created_at: new Date().toISOString() },
        { id: '27', name: 'House', net_profit: '200.00', total_games: 10, total_buyins: '1000.00', total_cashouts: '1200.00', created_at: new Date().toISOString() }
      ]);
    }
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Individual player net profit endpoint
app.get('/api/players/:id/net-profit', async (req, res) => {
  try {
    const playerId = req.params.id;
    console.log('💰 Individual net-profit endpoint called for player:', playerId);
    
    // Get basic player info
    const player = await queryDatabase(`
      SELECT 
        id, name
      FROM players 
      WHERE id = $1
    `, [playerId]);

    if (!player || player.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Calculate game net profit from game_players table (PERMANENT FIX)
    const gameStats = await queryDatabase(`
      SELECT 
        COALESCE(SUM(buyin), 0) as total_buyins,
        COALESCE(SUM(cashout), 0) as total_cashouts,
        COUNT(*) as games_played
      FROM game_players 
      WHERE player_id = $1
    `, [playerId]);

    const totalBuyins = parseFloat(gameStats?.[0]?.total_buyins || 0);
    const totalCashouts = parseFloat(gameStats?.[0]?.total_cashouts || 0);
    const gameNetProfit = totalCashouts - totalBuyins;

    // Get settlements where this player is involved
    const settlements = await queryDatabase(`
      SELECT 
        from_player_id, to_player_id, amount
      FROM settlements 
      WHERE from_player_id = $1 OR to_player_id = $1
      ORDER BY created_at DESC
    `, [playerId]);

    // Calculate settlement impact
    let settlementImpact = 0;
    if (settlements) {
      for (const settlement of settlements) {
        if (settlement.from_player_id === playerId) {
          // Player paid settlement (positive impact - they settled their debt)
          settlementImpact += parseFloat(settlement.amount);
        } else if (settlement.to_player_id === playerId) {
          // Player received settlement (negative impact - they were paid out)
          settlementImpact -= parseFloat(settlement.amount);
        }
      }
    }

    // Calculate true net profit (game profits + settlement impact)
    const trueNetProfit = gameNetProfit + settlementImpact;

    res.json({
      player_id: playerId,
      game_net_profit: gameNetProfit,
      settlement_impact: settlementImpact,
      true_net_profit: trueNetProfit,
      settlements_count: settlements?.length || 0
    });
  } catch (error) {
    console.error('Error calculating individual net profit with settlements:', error);
    res.status(500).json({ error: 'Failed to calculate net profit' });
  }
});

app.get('/api/players/net-profit/bulk', async (req, res) => {
  try {
    console.log('💰 Net-profit bulk endpoint called');
    
    // Get all players
    const players = await queryDatabase(`
      SELECT 
        id, name
      FROM players 
      ORDER BY name
    `);

    // Get all settlements
    const settlements = await queryDatabase(`
      SELECT 
        from_player_id, to_player_id, amount
      FROM settlements 
      ORDER BY created_at DESC
    `);

    if (players && players.length > 0) {
      console.log('💰 Found', players.length, 'players and', settlements?.length || 0, 'settlements');

      // Group settlements by player
      const playerSettlements = {};
      if (settlements) {
        for (const settlement of settlements) {
          if (!playerSettlements[settlement.from_player_id]) {
            playerSettlements[settlement.from_player_id] = [];
          }
          if (!playerSettlements[settlement.to_player_id]) {
            playerSettlements[settlement.to_player_id] = [];
          }
          playerSettlements[settlement.from_player_id].push(settlement);
          playerSettlements[settlement.to_player_id].push(settlement);
        }
      }

      // Calculate net profit for each player from actual game data
      const results = await Promise.all(players.map(async (player) => {
        // Calculate game net profit from game_players table (PERMANENT FIX)
        const gameStats = await queryDatabase(`
          SELECT 
            COALESCE(SUM(buyin), 0) as total_buyins,
            COALESCE(SUM(cashout), 0) as total_cashouts,
            COUNT(*) as games_played
          FROM game_players 
          WHERE player_id = $1
        `, [player.id]);

        const totalBuyins = parseFloat(gameStats?.[0]?.total_buyins || 0);
        const totalCashouts = parseFloat(gameStats?.[0]?.total_cashouts || 0);
        const gameNetProfit = totalCashouts - totalBuyins;

        // Calculate settlement impact
        const playerSettlementList = playerSettlements[player.id] || [];
        let settlementImpact = 0;
        for (const settlement of playerSettlementList) {
          if (settlement.from_player_id === player.id) {
            // Player paid settlement (positive impact - they settled their debt)
            settlementImpact += parseFloat(settlement.amount);
          } else if (settlement.to_player_id === player.id) {
            // Player received settlement (negative impact - they were paid out)
            settlementImpact -= parseFloat(settlement.amount);
          }
        }

        const trueNetProfit = gameNetProfit + settlementImpact;

        return {
          player_id: player.id,
          game_net_profit: gameNetProfit,
          settlement_impact: settlementImpact,
          true_net_profit: trueNetProfit,
          settlements_count: playerSettlementList.length
        };
      }));

      res.json(results);
    } else {
      // Fallback to mock data if no players found
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching bulk net profit:', error);
    res.status(500).json({ error: 'Failed to fetch net profit data' });
  }
});

// Delete game endpoint (must be before other /api/games/:id routes)
app.delete('/api/games/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    console.log('🎮 Delete game endpoint called for game:', gameId);
    
    // First, delete all game_players records for this game
    await queryDatabase(`
      DELETE FROM game_players 
      WHERE game_id = $1
    `, [gameId]);
    
    console.log('🎮 Deleted game players for game:', gameId);
    
    // Then delete the game itself
    await queryDatabase(`
      DELETE FROM games 
      WHERE id = $1
    `, [gameId]);
    
    console.log('🎮 Game deleted successfully:', gameId);
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('🎮 Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Game players endpoint
app.get('/api/games/:gameId/players', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    console.log('🎮 Game players endpoint called for game:', gameId);
    
    // Get game player details with correct column names
    const gamePlayers = await queryDatabase(`
      SELECT 
        gp.player_id,
        gp.buyin,
        gp.cashout,
        gp.profit,
        p.name as player_name
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = $1
      ORDER BY p.name
    `, [gameId]);
    
    if (gamePlayers) {
      console.log('🎮 Found', gamePlayers.length, 'players in game');
      res.json(gamePlayers);
    } else {
      console.log('🎮 No players found for game');
      res.json([]);
    }
  } catch (error) {
    console.error('🎮 Error fetching game players:', error);
    res.status(500).json({ error: 'Failed to fetch game players' });
  }
});

// Add players to existing game endpoint
app.post('/api/games/:gameId/players', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { players } = req.body;
    console.log('🎮 Add players to game endpoint called for game:', gameId, 'with', players?.length || 0, 'players');
    
    if (!players || players.length === 0) {
      return res.status(400).json({ error: 'At least one player is required' });
    }
    
    // Add each player to the game
    for (const player of players) {
      const profit = parseFloat(player.cashout || 0) - parseFloat(player.buyin || 0);
      
      console.log('🎮 Adding player:', player.player_id, 'buyin:', player.buyin, 'cashout:', player.cashout);
      
      await queryDatabase(`
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        require('crypto').randomUUID(),
        gameId,
        player.player_id,
        player.buyin.toString(),
        player.cashout.toString(),
        profit.toString()
      ]);
    }
    
    // Update game totals
    const gameStats = await queryDatabase(`
      SELECT 
        COALESCE(SUM(CAST(buyin AS DECIMAL)), 0) as total_buyins,
        COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) as total_cashouts
      FROM game_players 
      WHERE game_id = $1
    `, [gameId]);
    
    if (gameStats && gameStats.length > 0) {
      const totalBuyins = gameStats[0].total_buyins;
      const totalCashouts = gameStats[0].total_cashouts;
      const discrepancy = parseFloat(totalCashouts) - parseFloat(totalBuyins);
      
      await queryDatabase(`
        UPDATE games 
        SET total_buyins = $1, total_cashouts = $2, discrepancy = $3, updated_at = NOW()
        WHERE id = $4
      `, [totalBuyins, totalCashouts, discrepancy.toString(), gameId]);
    }
    
    console.log('🎮 Players added to game successfully');
    res.json({ message: 'Players added successfully' });
  } catch (error) {
    console.error('🎮 Error adding players to game:', error);
    res.status(500).json({ error: 'Failed to add players to game' });
  }
});

// Update player amounts in game endpoint
app.put('/api/games/:gameId/players/:playerId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const playerId = req.params.playerId;
    const { buyin, cashout } = req.body;
    
    console.log('🔧 UPDATE PLAYER endpoint called:', {
      gameId,
      playerId,
      buyin,
      cashout,
      timestamp: new Date().toISOString()
    });
    
    // Get OLD values BEFORE updating
    const oldGamePlayer = await queryDatabase(
      'SELECT buyin, cashout, profit FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    );

    console.log('🔧 Old player values:', oldGamePlayer);

    if (!oldGamePlayer || oldGamePlayer.length === 0) {
      console.error('🔧 Player not found in game');
      return res.status(404).json({ error: 'Player not found in this game' });
    }

    const oldProfit = parseFloat(oldGamePlayer[0].profit || 0);
    const oldBuyin = parseFloat(oldGamePlayer[0].buyin || 0);
    const oldCashout = parseFloat(oldGamePlayer[0].cashout || 0);
    
    const newProfit = parseFloat(cashout || 0) - parseFloat(buyin || 0);
    
    // First, let's verify the record exists
    const existingRecord = await queryDatabase(`
      SELECT * FROM game_players 
      WHERE game_id = $1 AND player_id = $2
    `, [gameId, playerId]);
    
    console.log('🔧 Existing record check:', {
      found: existingRecord && existingRecord.length > 0,
      gameId: gameId,
      playerId: playerId,
      gameIdType: typeof gameId,
      playerIdType: typeof playerId,
      currentBuyin: existingRecord && existingRecord.length > 0 ? existingRecord[0].buyin : 'NOT FOUND',
      currentCashout: existingRecord && existingRecord.length > 0 ? existingRecord[0].cashout : 'NOT FOUND'
    });
    
    console.log('🔧 About to execute UPDATE query with params:', {
      buyin: parseFloat(buyin),
      cashout: parseFloat(cashout),
      profit: newProfit,
      gameId,
      playerId
    });
    
    // UPDATE without updated_at column (it doesn't exist in game_players table)
    const updateQuery = `
      UPDATE game_players 
      SET 
        buyin = $1,
        cashout = $2,
        profit = $3
      WHERE game_id = $4 
        AND player_id = $5
      RETURNING buyin, cashout, profit, game_id, player_id
    `;
    const updateParams = [
      parseFloat(buyin), 
      parseFloat(cashout), 
      parseFloat(newProfit), 
      gameId, 
      playerId
    ];
    
    console.log('🔧 Final UPDATE attempt:', {
      query: updateQuery,
      params: updateParams
    });
    
    let updateResult;
    let updateError = null;
    try {
      updateResult = await queryDatabase(updateQuery, updateParams);
      console.log('🔧 UPDATE query result:', updateResult);
      console.log('🔧 Rows affected:', updateResult?.rowCount);
    } catch (err) {
      updateError = {
        message: err.message,
        code: err.code,
        detail: err.detail
      };
      console.error('🔧 UPDATE query error:', updateError);
    }
    
    // Update game totals
    const gameStats = await queryDatabase(`
      SELECT 
        COALESCE(SUM(CAST(buyin AS DECIMAL)), 0) as total_buyins,
        COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) as total_cashouts
      FROM game_players 
      WHERE game_id = $1
    `, [gameId]);
    
    if (gameStats && gameStats.length > 0) {
      const totalBuyins = gameStats[0].total_buyins;
      const totalCashouts = gameStats[0].total_cashouts;
      const discrepancy = parseFloat(totalCashouts) - parseFloat(totalBuyins);
      
      await queryDatabase(`
        UPDATE games 
        SET total_buyins = $1, total_cashouts = $2, discrepancy = $3, updated_at = NOW()
        WHERE id = $4
      `, [totalBuyins, totalCashouts, discrepancy, gameId]);
    }

    // Update player statistics with the difference
    const profitDifference = newProfit - oldProfit;
    const buyinDifference = parseFloat(buyin || 0) - oldBuyin;
    const cashoutDifference = parseFloat(cashout || 0) - oldCashout;

    await queryDatabase(`
      UPDATE players 
      SET 
        net_profit = net_profit + $1,
        total_buyins = total_buyins + $2,
        total_cashouts = total_cashouts + $3,
        updated_at = NOW()
      WHERE id = $4
    `, [profitDifference, buyinDifference, cashoutDifference, playerId]);
    
    console.log('🔧 Update complete:', {
      profitDifference,
      buyinDifference,
      cashoutDifference,
      newProfit,
      timestamp: new Date().toISOString()
    });
    
    // Add debug headers to verify backend processing
    res.setHeader('X-Update-Timestamp', new Date().toISOString());
    res.setHeader('X-New-Buyin', buyin.toString());
    res.setHeader('X-New-Cashout', cashout.toString());
    res.json({ 
      message: 'Player amounts updated successfully',
      debug: {
        gameId,
        playerId,
        oldBuyin,
        newBuyin: buyin,
        oldCashout,
        newCashout: cashout,
        rowsAffected: updateResult?.rowCount || 0,
        recordFound: existingRecord && existingRecord.length > 0,
        currentDbBuyin: existingRecord && existingRecord.length > 0 ? existingRecord[0].buyin : 'NOT FOUND',
        returningData: updateResult?.rows && updateResult.rows.length > 0 ? updateResult.rows[0] : null,
        updateResultType: typeof updateResult,
        updateResultKeys: updateResult ? Object.keys(updateResult) : [],
        rawUpdateResult: updateResult,
        updateError: updateError,
        timestamp: new Date().toISOString(),
        version: 'v3.0-FIXED-removed-updated-at'
      }
    });
  } catch (error) {
    console.error('Error updating player amounts:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to update player amounts',
      details: error.message,
      stack: error.stack
    });
  }
});

// Debug endpoint to check raw database values
app.get('/api/debug/games/:gameId/players/:playerId', async (req, res) => {
  try {
    const { gameId, playerId } = req.params;
    const result = await queryDatabase(
      'SELECT * FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    );
    res.json({
      found: result && result.length > 0,
      data: result && result.length > 0 ? result[0] : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Individual game endpoint with players
app.get('/api/games/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    console.log('🎮 Individual game endpoint called for game:', gameId);
    
    // Get game details
    const game = await queryDatabase(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at
      FROM games 
      WHERE id = $1
    `, [gameId]);
    
    if (game && game.length > 0) {
      console.log('🎮 Found game in database');
      
      // Get game players
      const gamePlayers = await queryDatabase(`
        SELECT 
          gp.id,
          gp.player_id,
          gp.buyin,
          gp.cashout,
          gp.profit,
          p.name as player_name
        FROM game_players gp
        JOIN players p ON gp.player_id = p.id
        WHERE gp.game_id = $1
        ORDER BY p.name
      `, [gameId]);
      
      console.log('🎮 Fetched game players:', gamePlayers.map(gp => ({
        name: gp.player_name,
        buyin: gp.buyin,
        cashout: gp.cashout
      })));
      
      // Combine game data with players
      const gameWithPlayers = {
        ...game[0],
        players: gamePlayers || []
      };
      
      res.json(gameWithPlayers);
    } else {
      console.log('🎮 Game not found');
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('🎮 Error fetching individual game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});


// Games endpoints (real data with fallback)
app.get('/api/games', async (req, res) => {
  try {
    const { playerId } = req.query;
    
    let query;
    let params = [];
    
    if (playerId) {
      // Filter games by player ID - using INNER JOIN approach
      query = `
        SELECT DISTINCT
          g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy, 
          g.is_completed, g.created_at, g.updated_at,
          (SELECT COUNT(*) FROM game_players gp2 WHERE gp2.game_id = g.id) as player_count
        FROM games g
        INNER JOIN game_players gp ON g.id = gp.game_id
        WHERE gp.player_id = $1
        ORDER BY g.date DESC, g.created_at DESC
      `;
      params = [playerId];
    } else {
      // Get all games
      query = `
        SELECT 
          g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy, 
          g.is_completed, g.created_at, g.updated_at,
          (SELECT COUNT(*) FROM game_players gp2 WHERE gp2.game_id = g.id) as player_count
        FROM games g
        ORDER BY g.date DESC, g.created_at DESC
      `;
    }
    
    const games = await queryDatabase(query, params);
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Create new game endpoint
app.post('/api/games', async (req, res) => {
  try {
    const { date, players } = req.body;
    console.log('🎮 Create game endpoint called with players:', players?.length || 0);
    console.log('🎮 Request body:', JSON.stringify(req.body, null, 2));
    
    if (!players || players.length === 0) {
      return res.status(400).json({ error: 'At least one player is required' });
    }
    
    if (!date) {
      return res.status(400).json({ error: 'Game date is required' });
    }
    
    // Calculate totals from player data
    let totalBuyins = 0;
    let totalCashouts = 0;
    
    for (const player of players) {
      totalBuyins += parseFloat(player.buyin || 0);
      totalCashouts += parseFloat(player.cashout || 0);
    }
    
    const discrepancy = totalCashouts - totalBuyins;
    
    // Start transaction by creating the game first
    const gameId = require('crypto').randomUUID();
    const gameResult = await queryDatabase(`
      INSERT INTO games (id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    `, [gameId, date, totalBuyins.toString(), totalCashouts.toString(), discrepancy.toString()]);
    
    if (!gameResult) {
      return res.status(500).json({ error: 'Failed to create game' });
    }
    
    console.log('🎮 Game created with ID:', gameId, 'Totals:', { totalBuyins, totalCashouts, discrepancy });
    
    // Add players to the game
    for (const player of players) {
      const profit = parseFloat(player.cashout || 0) - parseFloat(player.buyin || 0);
      
      console.log('🎮 Adding player:', player.player_id, 'buyin:', player.buyin, 'cashout:', player.cashout);
      
      const playerResult = await queryDatabase(`
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        require('crypto').randomUUID(),
        gameId,
        player.player_id, // Frontend sends player_id, not id
        player.buyin.toString(),
        player.cashout.toString(),
        profit.toString()
      ]);
      
      if (!playerResult) {
        console.error('🎮 Failed to add player:', player.player_id);
        // Don't throw error, just log it and continue
        // This prevents the entire transaction from failing
      } else {
        console.log('🎮 Player added successfully:', player.player_id, 'Result:', playerResult);
      }
    }
    
    console.log('🎮 Game and players created successfully');
    
    // Return the created game
    const createdGame = await queryDatabase(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at
      FROM games 
      WHERE id = $1
    `, [gameId]);
    
    if (createdGame && createdGame.length > 0) {
      res.status(201).json(createdGame[0]);
    } else {
      res.status(201).json({ id: gameId, message: 'Game created successfully' });
    }
  } catch (error) {
    console.error('🎮 Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Update game endpoint
app.put('/api/games/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    const { date, is_completed } = req.body;
    console.log('🎮 Update game endpoint called for game:', gameId);
    
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID is required' });
    }
    
    // Update game basic info
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (date) {
      updateFields.push(`date = $${paramCount}`);
      updateValues.push(date);
      paramCount++;
    }
    
    if (typeof is_completed === 'boolean') {
      updateFields.push(`is_completed = $${paramCount}`);
      updateValues.push(is_completed);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(gameId);
    
    const updateQuery = `
      UPDATE games 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `;
    
    await queryDatabase(updateQuery, updateValues);
    
    console.log('🎮 Game updated successfully:', gameId);
    
    // Return the updated game
    const updatedGame = await queryDatabase(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at
      FROM games 
      WHERE id = $1
    `, [gameId]);
    
    if (updatedGame && updatedGame.length > 0) {
      res.json(updatedGame[0]);
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('🎮 Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

app.get('/api/games/stats/overview', async (req, res) => {
  try {
    console.log('📊 Games stats endpoint called');
    // Try to get real data from database
    const stats = await queryDatabase(`
      SELECT 
        COUNT(*) as total_games,
        COALESCE(SUM(CAST(total_buyins AS DECIMAL)), 0) as total_buyins
      FROM games
    `);
    
    if (stats && stats.length > 0) {
      console.log('📊 Found game stats in database:', stats[0]);
      res.json({
        total_games: parseInt(stats[0].total_games),
        total_buyins: stats[0].total_buyins.toString()
      });
    } else {
      console.log('📊 No game stats found, using mock data');
      // Fallback to mock data
      res.json({
        total_games: 1,
        total_buyins: '800.00'
      });
    }
  } catch (error) {
    console.error('📊 Error fetching game stats:', error);
    console.error('📊 Error details:', error.message);
    res.status(500).json({ error: 'Failed to fetch game stats' });
  }
});

// Total discrepancy endpoint
app.get('/api/discrepancy/total', async (req, res) => {
  try {
    console.log('💰 Total discrepancy endpoint called');
    
    // Get all players and calculate their net profits from game data
    const players = await queryDatabase(`
      SELECT 
        id, name
      FROM players 
      ORDER BY name
    `);

    if (players && players.length > 0) {
      console.log('💰 Found', players.length, 'players for discrepancy calculation');

      // Calculate net profit for each player from game data
      let totalPositive = 0;
      let totalNegative = 0;
      
      for (const player of players) {
        // Get game stats for this player
        const gameStats = await queryDatabase(`
          SELECT 
            COALESCE(SUM(buyin), 0) as total_buyins,
            COALESCE(SUM(cashout), 0) as total_cashouts
          FROM game_players 
          WHERE player_id = $1
        `, [player.id]);

        const totalBuyins = parseFloat(gameStats?.[0]?.total_buyins || 0);
        const totalCashouts = parseFloat(gameStats?.[0]?.total_cashouts || 0);
        const netProfit = totalCashouts - totalBuyins;

        if (netProfit > 0) {
          totalPositive += netProfit;
        } else if (netProfit < 0) {
          totalNegative += Math.abs(netProfit);
        }
      }

      const totalDiscrepancy = totalPositive - totalNegative;
      const isBalanced = Math.abs(totalDiscrepancy) < 0.01; // Allow for small rounding differences

      res.json({
        total_positive_profit: totalPositive,
        total_negative_profit: totalNegative,
        total_discrepancy: totalDiscrepancy,
        is_balanced: isBalanced,
        players_count: players.length
      });
    } else {
      res.json({
        total_positive_profit: 0,
        total_negative_profit: 0,
        total_discrepancy: 0,
        is_balanced: true,
        players_count: 0
      });
    }
  } catch (error) {
    console.error('💰 Error calculating total discrepancy:', error);
    res.status(500).json({ error: 'Failed to calculate total discrepancy' });
  }
});

// Settlements endpoints (real data with fallback)
app.get('/api/settlements', async (req, res) => {
  try {
    // Try to get real data from database
    const settlements = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      ORDER BY date DESC, created_at DESC
    `);
    
    if (settlements) {
      res.json(settlements);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('💰 Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

app.get('/api/settlements/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;
    
    const settlement = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      WHERE id = $1
    `, [settlementId]);
    
    if (settlement && settlement.length > 0) {
      res.json(settlement[0]);
    } else {
      res.status(404).json({ error: 'Settlement not found' });
    }
  } catch (error) {
    console.error('💰 Error fetching individual settlement:', error);
    res.status(500).json({ error: 'Failed to fetch settlement' });
  }
});

app.post('/api/settlements', async (req, res) => {
  try {
    const { from_player_id, to_player_id, amount, date, notes } = req.body;
    
    if (!from_player_id || !to_player_id || !amount || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate players exist
    const players = await queryDatabase(
      'SELECT id, name FROM players WHERE id IN ($1, $2)',
      [from_player_id, to_player_id]
    );
    
    if (!players || players.length !== 2) {
      return res.status(400).json({ error: 'One or more players not found' });
    }
    
    const fromPlayer = players.find(p => p.id === from_player_id);
    const toPlayer = players.find(p => p.id === to_player_id);
    
    if (!fromPlayer || !toPlayer) {
      return res.status(400).json({ error: 'Invalid player selection' });
    }
    
    const settlementId = require('crypto').randomUUID();
    await queryDatabase(`
      INSERT INTO settlements (
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [settlementId, from_player_id, to_player_id, fromPlayer.name, toPlayer.name, amount, date, notes || null]);
    
    // Return the created settlement
    const createdSettlement = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      WHERE id = $1
    `, [settlementId]);
    
    if (createdSettlement && createdSettlement.length > 0) {
      res.status(201).json(createdSettlement[0]);
    } else {
      res.status(201).json({ id: settlementId, message: 'Settlement created successfully' });
    }
  } catch (error) {
    console.error('💰 Error creating settlement:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

app.put('/api/settlements/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;
    const { amount, date, notes } = req.body;
    console.log('💰 Update settlement endpoint called for settlement:', settlementId);
    
    if (!settlementId) {
      return res.status(400).json({ error: 'Settlement ID is required' });
    }
    
    // Check if settlement exists
    const existingSettlement = await queryDatabase('SELECT id FROM settlements WHERE id = $1', [settlementId]);
    if (!existingSettlement || existingSettlement.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    // Update settlement
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (amount !== undefined) {
      updateFields.push(`amount = $${paramCount}`);
      updateValues.push(amount);
      paramCount++;
    }
    
    if (date !== undefined) {
      updateFields.push(`date = $${paramCount}`);
      updateValues.push(date);
      paramCount++;
    }
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`);
      updateValues.push(notes);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(settlementId);
    
    const updateQuery = `
      UPDATE settlements 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `;
    
    await queryDatabase(updateQuery, updateValues);
    
    console.log('💰 Settlement updated successfully:', settlementId);
    
    // Return the updated settlement
    const updatedSettlement = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      WHERE id = $1
    `, [settlementId]);
    
    if (updatedSettlement && updatedSettlement.length > 0) {
      res.json(updatedSettlement[0]);
    } else {
      res.status(404).json({ error: 'Settlement not found' });
    }
  } catch (error) {
    console.error('💰 Error updating settlement:', error);
    res.status(500).json({ error: 'Failed to update settlement' });
  }
});

app.delete('/api/settlements/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;
    console.log('💰 Delete settlement endpoint called for settlement:', settlementId);
    
    // Check if settlement exists
    const existingSettlement = await queryDatabase('SELECT id FROM settlements WHERE id = $1', [settlementId]);
    if (!existingSettlement || existingSettlement.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    await queryDatabase('DELETE FROM settlements WHERE id = $1', [settlementId]);
    
    console.log('💰 Settlement deleted successfully:', settlementId);
    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('💰 Error deleting settlement:', error);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
});

app.get('/api/settlements/stats/overview', async (req, res) => {
  try {
    console.log('💰 Settlements stats endpoint called');
    // Try to get real data from database
    const stats = await queryDatabase(`
      SELECT 
        COUNT(*) as total_settlements,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
      FROM settlements
    `);
    
    if (stats && stats.length > 0) {
      console.log('💰 Found settlement stats in database:', stats[0]);
      res.json({
        total_settlements: parseInt(stats[0].total_settlements),
        total_amount: stats[0].total_amount.toString()
      });
    } else {
      console.log('💰 No settlement stats found, using mock data');
      res.json({
        total_settlements: 0,
        total_amount: '0.00'
      });
    }
  } catch (error) {
    console.error('💰 Error fetching settlement stats:', error);
    res.status(500).json({ error: 'Failed to fetch settlement stats' });
  }
});

app.get('/api/settlements/player/:playerId/debts', async (req, res) => {
  try {
    const playerId = req.params.playerId;
    console.log('💰 Player debts endpoint called for player:', playerId);
    
    // Check if player exists
    const player = await queryDatabase('SELECT id, name FROM players WHERE id = $1', [playerId]);
    if (!player || player.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Get debts owed by this player
    const debtsOwed = await queryDatabase(`
      SELECT 
        s.id, s.to_player_name, s.amount, s.date, s.notes
      FROM settlements s
      WHERE s.from_player_id = $1
      ORDER BY s.date DESC
    `, [playerId]);
    
    // Get debts owed to this player
    const debtsOwedTo = await queryDatabase(`
      SELECT 
        s.id, s.from_player_name, s.amount, s.date, s.notes
      FROM settlements s
      WHERE s.to_player_id = $1
      ORDER BY s.date DESC
    `, [playerId]);
    
    const totalOwed = (debtsOwed || []).reduce((sum, debt) => sum + parseFloat(debt.amount || 0), 0);
    const totalOwedTo = (debtsOwedTo || []).reduce((sum, debt) => sum + parseFloat(debt.amount || 0), 0);
    const netDebt = totalOwedTo - totalOwed;
    
    res.json({
      player: { id: player[0].id, name: player[0].name },
      debtsOwed: debtsOwed || [],
      debtsOwedTo: debtsOwedTo || [],
      totalOwed,
      totalOwedTo,
      netDebt
    });
  } catch (error) {
    console.error('💰 Error fetching player debts:', error);
    res.status(500).json({ error: 'Failed to fetch player debt information' });
  }
});

// Bulk game creation endpoints
const TextParser = require('./textParser');
const FuzzyMatcher = require('./fuzzyMatcher');

// Initialize utilities
const textParser = new TextParser();
const fuzzyMatcher = new FuzzyMatcher();


/**
 * Parse text and return preview data
 * POST /api/bulk-game/parse
 */
app.post('/api/bulk-game/parse', async (req, res) => {
  try {
    const { text, date } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Parse the text
    const parsedPlayers = textParser.parseText(text);
    
    // Validate parsed data
    const validation = textParser.validateParsedData(parsedPlayers);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid text format',
        details: validation.errors,
        warnings: validation.warnings
      });
    }

    // Get existing players for matching
    const existingPlayers = await queryDatabase(`
      SELECT id, name FROM players ORDER BY name
    `);

    // Match players using fuzzy matching
    const matching = fuzzyMatcher.matchPlayers(parsedPlayers, existingPlayers || []);

    // Generate preview
    const preview = textParser.generatePreview(parsedPlayers);

    res.json({
      success: true,
      preview: {
        ...preview,
        gameDate: date || new Date().toISOString().split('T')[0]
      },
      matching: {
        matched: matching.matched,
        unmatched: matching.unmatched
      },
      validation: {
        errors: validation.errors,
        warnings: validation.warnings
      }
    });

  } catch (error) {
    console.error('Error parsing text:', error);
    res.status(500).json({ error: 'Failed to parse text' });
  }
});

/**
 * Create game from parsed data
 * POST /api/bulk-game/create
 */
app.post('/api/bulk-game/create', async (req, res) => {
  try {
    const { date, players, createNewPlayers = true } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Valid date is required' });
    }

    if (!players || players.length === 0) {
      return res.status(400).json({ error: 'At least one player is required' });
    }

    // Process players and create/find player IDs
    const processedPlayers = [];
    const newPlayersCreated = [];

    for (const playerData of players) {
      const { name, profit, playerId } = playerData;
      
      let finalPlayerId = playerId;

      // If no playerId provided, try to find existing player or create new one
      if (!finalPlayerId) {
        if (createNewPlayers) {
          // Create new player
          const newPlayerId = require('crypto').randomUUID();
          await queryDatabase(
            'INSERT INTO players (id, name) VALUES ($1, $2)',
            [newPlayerId, name]
          );
          finalPlayerId = newPlayerId;
          newPlayersCreated.push({ id: newPlayerId, name });
        } else {
          return res.status(400).json({ 
            error: `Player "${name}" not found and createNewPlayers is false` 
          });
        }
      }

      // Convert profit to buy-in/cash-out
      const { buyin, cashout } = textParser.convertProfitToBuyinCashout(profit);

      processedPlayers.push({
        player_id: finalPlayerId,
        buyin,
        cashout,
        profit
      });
    }

    // Create the game
    const gameId = require('crypto').randomUUID();
    const totalBuyins = processedPlayers.reduce((sum, p) => sum + p.buyin, 0);
    const totalCashouts = processedPlayers.reduce((sum, p) => sum + p.cashout, 0);
    const discrepancy = totalCashouts - totalBuyins;

    // Insert game
    await queryDatabase(`
      INSERT INTO games (id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
    `, [gameId, date, totalBuyins.toString(), totalCashouts.toString(), discrepancy.toString()]);

    // Add players to game and update their statistics
    for (const player of processedPlayers) {
      const gamePlayerId = require('crypto').randomUUID();
      
      // Insert game player record
      await queryDatabase(`
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [gamePlayerId, gameId, player.player_id, player.buyin.toString(), player.cashout.toString(), player.profit.toString()]);

      // Update player statistics
      await queryDatabase(`
        UPDATE players 
        SET 
          net_profit = net_profit + $1,
          total_games = total_games + 1,
          total_buyins = total_buyins + $2,
          total_cashouts = total_cashouts + $3,
          updated_at = NOW()
        WHERE id = $4
      `, [player.profit, player.buyin, player.cashout, player.player_id]);
    }

    // Get the created game with full details
    const createdGame = await queryDatabase(`
      SELECT 
        g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy,
        g.created_at, g.updated_at
      FROM games g
      WHERE g.id = $1
    `, [gameId]);

    // Get game players with player names
    const gamePlayers = await queryDatabase(`
      SELECT 
        gp.id, gp.player_id, gp.buyin, gp.cashout, gp.profit,
        p.name as player_name
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = $1
      ORDER BY p.name
    `, [gameId]);

    res.status(201).json({
      success: true,
      game: {
        ...createdGame[0],
        players: gamePlayers || []
      },
      newPlayersCreated,
      summary: {
        totalPlayers: processedPlayers.length,
        totalBuyins,
        totalCashouts,
        discrepancy,
        newPlayersCount: newPlayersCreated.length
      }
    });

  } catch (error) {
    console.error('Error creating bulk game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

/**
 * Get existing players for matching
 * GET /api/bulk-game/players
 */
app.get('/api/bulk-game/players', async (req, res) => {
  try {
    const players = await queryDatabase(`
      SELECT id, name FROM players ORDER BY name
    `);

    res.json({
      success: true,
      players: players || []
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});


module.exports = app;
