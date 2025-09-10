const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/postgres-adapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all players
router.get('/', async (req, res) => {
  try {
    const players = await allQuery(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts,
        created_at, updated_at
      FROM players 
      ORDER BY name ASC
    `);
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get single player
router.get('/:id', async (req, res) => {
  try {
    const player = await getQuery(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts,
        created_at, updated_at
      FROM players 
      WHERE id = ?
    `, [req.params.id]);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
  }
});

// Create new player
router.post('/', [
  body('name').trim().isLength({ min: 1 }).withMessage('Player name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    // Check if player already exists
    const existingPlayer = await getQuery('SELECT id FROM players WHERE name = ?', [name]);
    if (existingPlayer) {
      return res.status(400).json({ error: 'Player with this name already exists' });
    }

    const playerId = uuidv4();
    await runQuery(
      'INSERT INTO players (id, name) VALUES (?, ?)',
      [playerId, name]
    );

    const newPlayer = await getQuery(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts,
        created_at, updated_at
      FROM players 
      WHERE id = ?
    `, [playerId]);

    res.status(201).json(newPlayer);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update player
router.put('/:id', [
  body('name').trim().isLength({ min: 1 }).withMessage('Player name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;
    const playerId = req.params.id;

    // Check if player exists
    const existingPlayer = await getQuery('SELECT id FROM players WHERE id = ?', [playerId]);
    if (!existingPlayer) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if name is already taken by another player
    const nameTaken = await getQuery('SELECT id FROM players WHERE name = ? AND id != ?', [name, playerId]);
    if (nameTaken) {
      return res.status(400).json({ error: 'Player with this name already exists' });
    }

    await runQuery(
      'UPDATE players SET name = ?, updated_at = NOW() WHERE id = ?',
      [name, playerId]
    );

    const updatedPlayer = await getQuery(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts,
        created_at, updated_at
      FROM players 
      WHERE id = ?
    `, [playerId]);

    res.json(updatedPlayer);
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete player
router.delete('/:id', async (req, res) => {
  try {
    const playerId = req.params.id;

    // Check if player exists
    const existingPlayer = await getQuery('SELECT id FROM players WHERE id = ?', [playerId]);
    if (!existingPlayer) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Check if player has any game records
    const gameRecords = await getQuery(
      'SELECT id FROM game_players WHERE player_id = ? LIMIT 1',
      [playerId]
    );

    if (gameRecords) {
      return res.status(400).json({ 
        error: 'Cannot delete player with game records. Please remove all game records first.' 
      });
    }

    await runQuery('DELETE FROM players WHERE id = ?', [playerId]);

    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Get player statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const playerId = req.params.id;

    // Get basic player info
    const player = await getQuery(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts
      FROM players 
      WHERE id = ?
    `, [playerId]);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get recent games
    const recentGames = await allQuery(`
      SELECT 
        g.id, g.date, g.is_completed,
        gp.buyin, gp.cashout, gp.profit
      FROM games g
      JOIN game_players gp ON g.id = gp.game_id
      WHERE gp.player_id = ?
      ORDER BY g.date DESC
      LIMIT 10
    `, [playerId]);

    // Get win/loss streak
    const allGames = await allQuery(`
      SELECT gp.profit
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.player_id = ? AND g.is_completed = TRUE
      ORDER BY g.date DESC
    `, [playerId]);

    let currentStreak = 0;
    let isWinning = null;
    
    for (const game of allGames) {
      if (isWinning === null) {
        isWinning = game.profit > 0;
        currentStreak = 1;
      } else if ((game.profit > 0) === isWinning) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.json({
      ...player,
      recentGames,
      currentStreak: {
        count: currentStreak,
        type: isWinning ? 'winning' : 'losing'
      }
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch player statistics' });
  }
});

// Get player net profit including settlements
router.get('/:id/net-profit', async (req, res) => {
  try {
    const playerId = req.params.id;

    // Get basic player info
    const player = await getQuery(`
      SELECT 
        id, name, net_profit, total_games, total_buyins, total_cashouts
      FROM players 
      WHERE id = ?
    `, [playerId]);

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get settlements where this player is involved
    const settlements = await allQuery(`
      SELECT 
        from_player_id, to_player_id, amount
      FROM settlements 
      WHERE from_player_id = ? OR to_player_id = ?
      ORDER BY created_at DESC
    `, [playerId, playerId]);

    // Calculate settlement impact
    let settlementImpact = 0;
    for (const settlement of settlements) {
      if (settlement.from_player_id === playerId) {
        // Player paid out money (negative impact - they lost money)
        settlementImpact -= parseFloat(settlement.amount);
      } else if (settlement.to_player_id === playerId) {
        // Player received settlement (negative impact - they were paid out, reducing their net profit)
        settlementImpact -= parseFloat(settlement.amount);
      }
    }

    // Calculate true net profit (game profits + settlement impact)
    const trueNetProfit = parseFloat(player.net_profit || 0) + settlementImpact;

    res.json({
      player_id: playerId,
      game_net_profit: parseFloat(player.net_profit || 0),
      settlement_impact: settlementImpact,
      true_net_profit: trueNetProfit,
      settlements_count: settlements.length
    });
  } catch (error) {
    console.error('Error calculating net profit with settlements:', error);
    res.status(500).json({ error: 'Failed to calculate net profit' });
  }
});

module.exports = router;
