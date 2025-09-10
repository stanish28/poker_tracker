const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/postgres-adapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all games
router.get('/', async (req, res) => {
  try {
    const games = await allQuery(`
      SELECT 
        g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy, 
        g.is_completed, g.created_at, g.updated_at,
        COUNT(gp.player_id) as player_count
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      GROUP BY g.id
      ORDER BY g.date DESC, g.created_at DESC
    `);
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
          updated_at = CURRENT_TIMESTAMP
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
          updated_at = CURRENT_TIMESTAMP
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

// Get game statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getQuery(`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_games,
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
