const express = require('express');

const app = express();

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
    } catch (error) {
      console.error('❌ Failed to create database pool:', error);
    }
  }
  return dbPool;
}

async function queryDatabase(sql, params = []) {
  try {
    const pool = await getDbPool();
    if (!pool) return null;
    
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Database query failed:', error);
    return null;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database_pool: !!dbPool,
    version: '1.0.1'
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
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
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
    console.log('🎮 Update player amounts endpoint called for game:', gameId, 'player:', playerId);
    
    const profit = parseFloat(cashout || 0) - parseFloat(buyin || 0);
    
    // Update player amounts
    await queryDatabase(`
      UPDATE game_players 
      SET buyin = $1, cashout = $2, profit = $3, updated_at = NOW()
      WHERE game_id = $4 AND player_id = $5
    `, [buyin.toString(), cashout.toString(), profit.toString(), gameId, playerId]);
    
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
    
    console.log('🎮 Player amounts updated successfully');
    res.json({ message: 'Player amounts updated successfully' });
  } catch (error) {
    console.error('🎮 Error updating player amounts:', error);
    res.status(500).json({ error: 'Failed to update player amounts' });
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

// Delete game endpoint
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

// Games endpoints (real data with fallback)
app.get('/api/games', async (req, res) => {
  try {
    console.log('🎮 Games endpoint called');
    // Try to get real data from database with correct column names
    const games = await queryDatabase(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at
      FROM games 
      ORDER BY date DESC
    `);
    
    if (games && games.length > 0) {
      console.log('🎮 Found', games.length, 'games in database');
      res.json(games);
    } else {
      console.log('🎮 No games found, using mock data');
      // Fallback to mock data
      res.json([
        {
          id: '1',
          date: new Date().toISOString(),
          total_buyins: '800.00',
          total_cashouts: '800.00',
          discrepancy: '0',
          is_completed: true
        }
      ]);
    }
  } catch (error) {
    console.error('🎮 Error fetching games:', error);
    console.error('🎮 Error details:', error.message);
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
      
      await queryDatabase(`
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `, [
        require('crypto').randomUUID(),
        gameId,
        player.player_id, // Frontend sends player_id, not id
        player.buyin.toString(),
        player.cashout.toString(),
        profit.toString()
      ]);
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
    console.log('💰 Settlements endpoint called');
    // Try to get real data from database
    const settlements = await queryDatabase(`
      SELECT 
        s.id, s.amount, s.notes, s.date, s.created_at,
        fp.name as from_player_name,
        tp.name as to_player_name
      FROM settlements s
      JOIN players fp ON s.from_player_id = fp.id
      JOIN players tp ON s.to_player_id = tp.id
      ORDER BY s.date DESC
    `);
    
    if (settlements) {
      console.log('💰 Found', settlements.length, 'settlements in database');
      res.json(settlements);
    } else {
      console.log('💰 No settlements found, using empty array');
      res.json([]);
    }
  } catch (error) {
    console.error('💰 Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
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

module.exports = app;
