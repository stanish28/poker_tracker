const express = require('express');
const { queryDatabase } = require('../db');
const { sendGameResultEmail } = require('../notifications/email');

const router = express.Router();

// Delete game endpoint (must be before other /api/games/:id routes)
router.delete('/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    
    // First, delete all game_players records for this game
    await queryDatabase(`
      DELETE FROM game_players 
      WHERE game_id = $1
    `, [gameId]);
    
    
    // Then delete the game itself
    await queryDatabase(`
      DELETE FROM games 
      WHERE id = $1
    `, [gameId]);
    
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('🎮 Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});
// Game players endpoint
router.get('/:gameId/players', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    
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
      res.json(gamePlayers);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('🎮 Error fetching game players:', error);
    res.status(500).json({ error: 'Failed to fetch game players' });
  }
});
// Add players to existing game endpoint
router.post('/:gameId/players', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const { players, player_id, buyin, cashout } = req.body;
    
    // Support both array format and single player format
    let playersToAdd = [];
    if (players && Array.isArray(players) && players.length > 0) {
      playersToAdd = players;
    } else if (player_id) {
      // Legacy single player format
      playersToAdd = [{ player_id, buyin, cashout }];
    } else {
      return res.status(400).json({ error: 'At least one player is required' });
    }
    
    
    // Add each player to the game
    for (const player of playersToAdd) {
      const profit = parseFloat(player.cashout || 0) - parseFloat(player.buyin || 0);
      
      
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
    
    const gd = await queryDatabase('SELECT date FROM games WHERE id = $1', [gameId]);
    const gameDate = gd?.[0]?.date || new Date().toISOString();

    // Await SMTP before responding — Vercel terminates the function after res.json(),
    // which previously killed fire-and-forget email tasks.
    await Promise.allSettled(
      playersToAdd.map(async (p) => {
        try {
          const rows = await queryDatabase(
            'SELECT name, email FROM players WHERE id = $1',
            [p.player_id]
          );
          if (!rows || !rows[0] || !rows[0].email) return;
          const profit =
            parseFloat(p.cashout || 0) - parseFloat(p.buyin || 0);
          await sendGameResultEmail(rows[0].email, rows[0].name, {
            buyin: p.buyin,
            cashout: p.cashout,
            profit,
            date: gameDate,
          });
        } catch (_) {
          /* non-fatal */
        }
      })
    );

    res.json({ message: 'Players added successfully' });
  } catch (error) {
    console.error('🎮 Error adding players to game:', error);
    res.status(500).json({ error: 'Failed to add players to game' });
  }
});
// Remove player from game endpoint
router.delete('/:gameId/players/:playerId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const playerId = req.params.playerId;
    
    // Get the game_player record to reverse statistics
    const gamePlayer = await queryDatabase(
      'SELECT buyin, cashout, profit FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    );

    if (!gamePlayer || gamePlayer.length === 0) {
      return res.status(404).json({ error: 'Player not found in this game' });
    }

    const buyin = parseFloat(gamePlayer[0].buyin || 0);
    const cashout = parseFloat(gamePlayer[0].cashout || 0);
    const profit = parseFloat(gamePlayer[0].profit || 0);
    
    // Delete the game_player record
    await queryDatabase(
      'DELETE FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    );
    
    // Update player statistics (reverse the amounts)
    await queryDatabase(`
      UPDATE players 
      SET 
        net_profit = net_profit - $1,
        total_games = total_games - 1,
        total_buyins = total_buyins - $2,
        total_cashouts = total_cashouts - $3,
        updated_at = NOW()
      WHERE id = $4
    `, [profit, buyin, cashout, playerId]);
    
    // Update game totals
    const gameStats = await queryDatabase(`
      SELECT 
        COALESCE(SUM(CAST(buyin AS DECIMAL)), 0) as total_buyins,
        COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) as total_cashouts
      FROM game_players 
      WHERE game_id = $1
    `, [gameId]);
    
    const totalBuyins = parseFloat(gameStats?.[0]?.total_buyins || 0);
    const totalCashouts = parseFloat(gameStats?.[0]?.total_cashouts || 0);
    const discrepancy = totalCashouts - totalBuyins;
    
    await queryDatabase(`
      UPDATE games 
      SET total_buyins = $1, total_cashouts = $2, discrepancy = $3, updated_at = NOW()
      WHERE id = $4
    `, [totalBuyins, totalCashouts, discrepancy, gameId]);
    
    res.json({ message: 'Player removed from game successfully' });
  } catch (error) {
    console.error('🎮 Error removing player from game:', error);
    res.status(500).json({ error: 'Failed to remove player from game' });
  }
});
// Update player amounts in game endpoint
router.put('/:gameId/players/:playerId', async (req, res) => {
  try {
    const gameId = req.params.gameId;
    const playerId = req.params.playerId;
    const { buyin, cashout } = req.body;
    
    // Get OLD values BEFORE updating
    const oldGamePlayer = await queryDatabase(
      'SELECT buyin, cashout, profit FROM game_players WHERE game_id = $1 AND player_id = $2',
      [gameId, playerId]
    );

    if (!oldGamePlayer || oldGamePlayer.length === 0) {
      return res.status(404).json({ error: 'Player not found in this game' });
    }

    const oldProfit = parseFloat(oldGamePlayer[0].profit || 0);
    const oldBuyin = parseFloat(oldGamePlayer[0].buyin || 0);
    const oldCashout = parseFloat(oldGamePlayer[0].cashout || 0);
    
    const newProfit = parseFloat(cashout || 0) - parseFloat(buyin || 0);
    
    // Update game player amounts
    const updateResult = await queryDatabase(`
      UPDATE game_players 
      SET buyin = $1, cashout = $2, profit = $3
      WHERE game_id = $4 AND player_id = $5
      RETURNING buyin, cashout, profit
    `, [parseFloat(buyin), parseFloat(cashout), newProfit, gameId, playerId]);
    
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
    
    res.json({ message: 'Player amounts updated successfully' });
  } catch (error) {
    console.error('Error updating player amounts:', error);
    res.status(500).json({ error: 'Failed to update player amounts' });
  }
});
// Individual game endpoint with players
router.get('/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    
    // Get game details
    const game = await queryDatabase(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at
      FROM games 
      WHERE id = $1
    `, [gameId]);
    
    if (game && game.length > 0) {
      
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
      res.status(404).json({ error: 'Game not found' });
    }
  } catch (error) {
    console.error('🎮 Error fetching individual game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});
// Games endpoints (real data with fallback)
router.get('/', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    const { date, players } = req.body;
    
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
    
    
    // Add players to the game
    for (const player of players) {
      const profit = parseFloat(player.cashout || 0) - parseFloat(player.buyin || 0);
      
      
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
        // Logged rather than thrown so one bad row cannot fail the whole game.
        console.error('🎮 Failed to add player:', player.player_id);
      }
    }
    
    
    // Return the created game
    const createdGame = await queryDatabase(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed, created_at, updated_at
      FROM games 
      WHERE id = $1
    `, [gameId]);
    
    const payload =
      createdGame && createdGame.length > 0
        ? createdGame[0]
        : { id: gameId, date, message: 'Game created successfully' };
    const gameDate = payload.date || date;

    await Promise.allSettled(
      players.map(async (gp) => {
        try {
          const rows = await queryDatabase(
            'SELECT name, email FROM players WHERE id = $1',
            [gp.player_id]
          );
          if (!rows || !rows[0] || !rows[0].email) return;
          const profit =
            parseFloat(gp.cashout || 0) - parseFloat(gp.buyin || 0);
          await sendGameResultEmail(rows[0].email, rows[0].name, {
            buyin: gp.buyin,
            cashout: gp.cashout,
            profit,
            date: gameDate,
          });
        } catch (_) {
          /* non-fatal */
        }
      })
    );

    res.status(201).json(payload);
  } catch (error) {
    console.error('🎮 Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});
// Update game endpoint
router.put('/:id', async (req, res) => {
  try {
    const gameId = req.params.id;
    const { date, is_completed } = req.body;
    
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
router.get('/stats/overview', async (req, res) => {
  try {
    // Try to get real data from database
    const stats = await queryDatabase(`
      SELECT 
        COUNT(*) as total_games,
        COALESCE(SUM(CAST(total_buyins AS DECIMAL)), 0) as total_buyins
      FROM games
    `);
    
    if (stats && stats.length > 0) {
      res.json({
        total_games: parseInt(stats[0].total_games),
        total_buyins: stats[0].total_buyins.toString()
      });
    } else {
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
module.exports = router;
