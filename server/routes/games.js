const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/postgres-adapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all games (with optional player filter)
router.get('/', async (req, res) => {
  try {
    const { playerId } = req.query;
    console.log('Games endpoint called with playerId:', playerId);
    console.log('Full query object:', req.query);
    console.log('Request URL:', req.url);
    
    let query;
    let params = [];
    
    if (playerId) {
      // Filter games by player ID - even simpler approach
      query = `
        SELECT DISTINCT
          g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy, 
          g.is_completed, g.created_at, g.updated_at,
          (SELECT COUNT(*) FROM game_players gp2 WHERE gp2.game_id = g.id) as player_count
        FROM games g
        INNER JOIN game_players gp ON g.id = gp.game_id
        WHERE gp.player_id = ?
        ORDER BY g.date DESC, g.created_at DESC
      `;
      params = [playerId];
      console.log('Using filtered query for playerId:', playerId);
    } else {
      // Get all games
      query = `
        SELECT 
          g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy, 
          g.is_completed, g.created_at, g.updated_at,
          COUNT(gp.player_id) as player_count
        FROM games g
        LEFT JOIN game_players gp ON g.id = gp.game_id
        GROUP BY g.id
        ORDER BY g.date DESC, g.created_at DESC
      `;
      console.log('Using all games query');
    }
    
    console.log('Executing query:', query);
    console.log('With params:', params);
    const games = await allQuery(query, params);
    console.log(`Returning ${games.length} games for playerId:`, playerId);
    
    // Return debugging info in the response headers
    if (playerId) {
      const playerGames = await allQuery(
        'SELECT DISTINCT game_id FROM game_players WHERE player_id = ?',
        [playerId]
      );
      console.log(`Player ${playerId} is in ${playerGames.length} games:`, playerGames.map(g => g.game_id));
      
      // Set debugging info in response headers
      res.setHeader('X-Debug-PlayerId', playerId);
      res.setHeader('X-Debug-PlayerGames', playerGames.length.toString());
      res.setHeader('X-Debug-FilteredGames', games.length.toString());
      res.setHeader('X-Debug-Query', query.substring(0, 100) + '...');
      res.setHeader('X-Debug-IsFiltered', 'true');
      
      console.log('Setting debug headers:', {
        playerId,
        playerGames: playerGames.length,
        filteredGames: games.length
      });
    }
    
    res.json(games);
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Get single game with players
router.get('/:id', async (req, res) => {
  try {
    const game = await getQuery(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, 
        is_completed, created_at, updated_at
      FROM games 
      WHERE id = ?
    `, [req.params.id]);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const players = await allQuery(`
      SELECT 
        gp.id, gp.buyin, gp.cashout, gp.profit,
        p.id as player_id, p.name as player_name
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ?
      ORDER BY p.name ASC
    `, [req.params.id]);

    res.json({ ...game, players });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Create new game
router.post('/', [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('players').isArray({ min: 1 }).withMessage('At least one player is required'),
  body('players.*.player_id').notEmpty().withMessage('Player ID is required'),
  body('players.*.buyin').isNumeric().withMessage('Buy-in must be a number'),
  body('players.*.cashout').isNumeric().withMessage('Cash-out must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, players } = req.body;

    // Validate all players exist
    const playerIds = players.map(p => p.player_id);
    const existingPlayers = await allQuery(
      `SELECT id FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
      playerIds
    );

    if (existingPlayers.length !== playerIds.length) {
      return res.status(400).json({ error: 'One or more players not found' });
    }

    const gameId = uuidv4();
    const totalBuyins = players.reduce((sum, p) => sum + parseFloat(p.buyin), 0);
    const totalCashouts = players.reduce((sum, p) => sum + parseFloat(p.cashout), 0);
    const discrepancy = totalCashouts - totalBuyins;

    // Create game
    await runQuery(`
      INSERT INTO games (id, date, total_buyins, total_cashouts, discrepancy)
      VALUES (?, ?, ?, ?, ?)
    `, [gameId, date, totalBuyins, totalCashouts, discrepancy]);

    // Add players to game
    for (const player of players) {
      const profit = parseFloat(player.cashout) - parseFloat(player.buyin);
      const gamePlayerId = uuidv4();
      
      await runQuery(`
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [gamePlayerId, gameId, player.player_id, player.buyin, player.cashout, profit]);
    }

    // Update player statistics
    for (const player of players) {
      const profit = parseFloat(player.cashout) - parseFloat(player.buyin);
      
      await runQuery(`
        UPDATE players SET 
          net_profit = net_profit + ?,
          total_games = total_games + 1,
          total_buyins = total_buyins + ?,
          total_cashouts = total_cashouts + ?,
          updated_at = NOW()
        WHERE id = ?
      `, [profit, player.buyin, player.cashout, player.player_id]);
    }

    const newGame = await getQuery(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, 
        is_completed, created_at, updated_at
      FROM games 
      WHERE id = ?
    `, [gameId]);

    res.status(201).json(newGame);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Update game
router.put('/:id', [
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('is_completed').optional().isBoolean().withMessage('is_completed must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const gameId = req.params.id;
    const { date, is_completed } = req.body;

    // Check if game exists
    const existingGame = await getQuery('SELECT id FROM games WHERE id = ?', [gameId]);
    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const updateFields = [];
    const updateValues = [];

    if (date !== undefined) {
      updateFields.push('date = ?');
      updateValues.push(date);
    }

    if (is_completed !== undefined) {
      updateFields.push('is_completed = ?');
      updateValues.push(is_completed);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(gameId);

    await runQuery(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedGame = await getQuery(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, 
        is_completed, created_at, updated_at
      FROM games 
      WHERE id = ?
    `, [gameId]);

    res.json(updatedGame);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Delete game
router.delete('/:id', async (req, res) => {
  try {
    const gameId = req.params.id;

    // Check if game exists
    const existingGame = await getQuery('SELECT id FROM games WHERE id = ?', [gameId]);
    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get game players to reverse statistics
    const gamePlayers = await allQuery(`
      SELECT player_id, buyin, cashout, profit
      FROM game_players 
      WHERE game_id = ?
    `, [gameId]);

    // Reverse player statistics
    for (const player of gamePlayers) {
      await runQuery(`
        UPDATE players SET 
          net_profit = net_profit - ?,
          total_games = total_games - 1,
          total_buyins = total_buyins - ?,
          total_cashouts = total_cashouts - ?,
          updated_at = NOW()
        WHERE id = ?
      `, [player.profit, player.buyin, player.cashout, player.player_id]);
    }

    // Delete game (cascade will delete game_players)
    await runQuery('DELETE FROM games WHERE id = ?', [gameId]);

    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Add player to existing game
router.post('/:gameId/players', [
  body('player_id').notEmpty().withMessage('Player ID is required'),
  body('buyin').isNumeric().withMessage('Buy-in must be a number'),
  body('cashout').isNumeric().withMessage('Cash-out must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId } = req.params;
    const { player_id, buyin, cashout } = req.body;
    const profit = cashout - buyin;

    // Check if game exists
    const existingGame = await getQuery('SELECT id FROM games WHERE id = ?', [gameId]);
    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if player exists
    const existingPlayer = await getQuery('SELECT id, name FROM players WHERE id = ?', [player_id]);
    if (!existingPlayer) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if player is already in this game
    const existingGamePlayer = await getQuery(
      'SELECT id FROM game_players WHERE game_id = ? AND player_id = ?',
      [gameId, player_id]
    );

    if (existingGamePlayer) {
      return res.status(400).json({ error: 'Player is already in this game' });
    }

    // Add player to game
    const gamePlayerId = uuidv4();
    await runQuery(`
      INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [gamePlayerId, gameId, player_id, buyin, cashout, profit]);

    // Update player statistics
    await runQuery(`
      UPDATE players 
      SET 
        net_profit = net_profit + ?,
        total_games = total_games + 1,
        total_buyins = total_buyins + ?,
        total_cashouts = total_cashouts + ?,
        updated_at = NOW()
      WHERE id = ?
    `, [profit, buyin, cashout, player_id]);

    // Recalculate and update game totals
    const gameTotals = await getQuery(`
      SELECT 
        SUM(buyin) as total_buyins,
        SUM(cashout) as total_cashouts
      FROM game_players 
      WHERE game_id = ?
    `, [gameId]);

    const discrepancy = gameTotals.total_cashouts - gameTotals.total_buyins;

    await runQuery(`
      UPDATE games 
      SET total_buyins = ?, total_cashouts = ?, discrepancy = ?, updated_at = NOW()
      WHERE id = ?
    `, [gameTotals.total_buyins, gameTotals.total_cashouts, discrepancy, gameId]);

    res.json({ 
      message: 'Player added to game successfully',
      player: {
        id: gamePlayerId,
        player_id,
        player_name: existingPlayer.name,
        buyin,
        cashout,
        profit
      }
    });
  } catch (error) {
    console.error('Error adding player to game:', error);
    res.status(500).json({ error: 'Failed to add player to game' });
  }
});

// Update game player amounts
router.put('/:gameId/players/:playerId', [
  body('buyin').isNumeric().withMessage('Buy-in must be a number'),
  body('cashout').isNumeric().withMessage('Cash-out must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gameId, playerId } = req.params;
    const { buyin, cashout } = req.body;
    const profit = cashout - buyin;

    // Check if game-player record exists and get OLD values BEFORE updating
    const oldGamePlayer = await getQuery(
      'SELECT buyin, cashout, profit FROM game_players WHERE game_id = ? AND player_id = ?',
      [gameId, playerId]
    );

    if (!oldGamePlayer) {
      return res.status(404).json({ error: 'Player not found in this game' });
    }

    // Update game player amounts
    await runQuery(`
      UPDATE game_players 
      SET buyin = ?, cashout = ?, profit = ?
      WHERE game_id = ? AND player_id = ?
    `, [buyin, cashout, profit, gameId, playerId]);

    // Recalculate and update game totals
    const gameTotals = await getQuery(`
      SELECT 
        SUM(buyin) as total_buyins,
        SUM(cashout) as total_cashouts
      FROM game_players 
      WHERE game_id = ?
    `, [gameId]);

    const discrepancy = gameTotals.total_cashouts - gameTotals.total_buyins;

    await runQuery(`
      UPDATE games 
      SET total_buyins = ?, total_cashouts = ?, discrepancy = ?, updated_at = NOW()
      WHERE id = ?
    `, [gameTotals.total_buyins, gameTotals.total_cashouts, discrepancy, gameId]);

    // Update player statistics with the difference
    const oldProfit = parseFloat(oldGamePlayer.profit || 0);
    const oldBuyin = parseFloat(oldGamePlayer.buyin || 0);
    const oldCashout = parseFloat(oldGamePlayer.cashout || 0);
    
    const profitDifference = profit - oldProfit;
    const buyinDifference = buyin - oldBuyin;
    const cashoutDifference = cashout - oldCashout;

    await runQuery(`
      UPDATE players 
      SET 
        net_profit = net_profit + ?,
        total_buyins = total_buyins + ?,
        total_cashouts = total_cashouts + ?,
        updated_at = NOW()
      WHERE id = ?
    `, [profitDifference, buyinDifference, cashoutDifference, playerId]);

    res.json({ message: 'Player amounts updated successfully' });
  } catch (error) {
    console.error('Error updating game player amounts:', error);
    res.status(500).json({ error: 'Failed to update player amounts' });
  }
});

// Test endpoint to verify player filtering
router.get('/test-filter/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    console.log('Testing filter for playerId:', playerId);
    
    // Test the subquery first
    const playerGames = await allQuery(
      'SELECT DISTINCT game_id FROM game_players WHERE player_id = ?',
      [playerId]
    );
    console.log('Player games found:', playerGames);
    
    // Test the full query with INNER JOIN
    const filteredGames = await allQuery(`
      SELECT DISTINCT
        g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy, 
        g.is_completed, g.created_at, g.updated_at,
        (SELECT COUNT(*) FROM game_players gp2 WHERE gp2.game_id = g.id) as player_count
      FROM games g
      INNER JOIN game_players gp ON g.id = gp.game_id
      WHERE gp.player_id = ?
      ORDER BY g.date DESC, g.created_at DESC
    `, [playerId]);
    
    res.json({
      playerId: playerId,
      playerGamesCount: playerGames.length,
      filteredGamesCount: filteredGames.length,
      playerGames: playerGames,
      filteredGames: filteredGames
    });
  } catch (error) {
    console.error('Test filter error:', error);
    res.status(500).json({ error: 'Test filter failed' });
  }
});

// Get game statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getQuery(`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN is_completed = TRUE THEN 1 ELSE 0 END) as completed_games,
        SUM(total_buyins) as total_buyins,
        SUM(total_cashouts) as total_cashouts,
        AVG(discrepancy) as avg_discrepancy,
        MAX(date) as last_game_date
      FROM games
    `);

    const recentGames = await allQuery(`
      SELECT 
        id, date, total_buyins, total_cashouts, discrepancy, is_completed
      FROM games
      ORDER BY date DESC
      LIMIT 5
    `);

    res.json({ ...stats, recentGames });
  } catch (error) {
    console.error('Error fetching game stats:', error);
    res.status(500).json({ error: 'Failed to fetch game statistics' });
  }
});

module.exports = router;
