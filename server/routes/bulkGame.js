const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { getQuery, runQuery, allQuery } = require('../database/adapter');
const TextParser = require('../utils/textParser');
const FuzzyMatcher = require('../utils/fuzzyMatcher');

const router = express.Router();

// Initialize utilities
const textParser = new TextParser();
const fuzzyMatcher = new FuzzyMatcher();


/**
 * Parse text and return preview data
 * POST /api/bulk-game/parse
 */
router.post('/parse', [
  body('text').isString().withMessage('Text is required'),
  body('date').optional().isISO8601().withMessage('Valid date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { text, date } = req.body;

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
    const existingPlayers = await allQuery(`
      SELECT id, name FROM players ORDER BY name
    `);

    // Match players using fuzzy matching
    const matching = fuzzyMatcher.matchPlayers(parsedPlayers, existingPlayers);

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
router.post('/create', [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('players').isArray({ min: 1 }).withMessage('At least one player is required'),
  body('players.*.name').notEmpty().withMessage('Player name is required'),
  body('players.*.profit').isNumeric().withMessage('Profit must be a number'),
  body('players.*.playerId').optional().isString().withMessage('Player ID must be string'),
  body('createNewPlayers').optional().isBoolean().withMessage('createNewPlayers must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { date, players, createNewPlayers = true } = req.body;

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
          const newPlayerId = uuidv4();
          await runQuery(
            'INSERT INTO players (id, name) VALUES (?, ?)',
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
    const gameId = uuidv4();
    const totalBuyins = processedPlayers.reduce((sum, p) => sum + p.buyin, 0);
    const totalCashouts = processedPlayers.reduce((sum, p) => sum + p.cashout, 0);
    const discrepancy = totalCashouts - totalBuyins;

    // Insert game
    await runQuery(`
      INSERT INTO games (id, date, total_buyins, total_cashouts, discrepancy)
      VALUES (?, ?, ?, ?, ?)
    `, [gameId, date, totalBuyins, totalCashouts, discrepancy]);

    // Add players to game and update their statistics
    for (const player of processedPlayers) {
      const gamePlayerId = uuidv4();
      
      // Insert game player record
      await runQuery(`
        INSERT INTO game_players (id, game_id, player_id, buyin, cashout, profit)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [gamePlayerId, gameId, player.player_id, player.buyin, player.cashout, player.profit]);

      // Update player statistics
      await runQuery(`
        UPDATE players 
        SET 
          net_profit = net_profit + ?,
          total_games = total_games + 1,
          total_buyins = total_buyins + ?,
          total_cashouts = total_cashouts + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [player.profit, player.buyin, player.cashout, player.player_id]);
    }

    // Get the created game with full details
    const createdGame = await getQuery(`
      SELECT 
        g.id, g.date, g.total_buyins, g.total_cashouts, g.discrepancy,
        g.created_at, g.updated_at
      FROM games g
      WHERE g.id = ?
    `, [gameId]);

    // Get game players with player names
    const gamePlayers = await allQuery(`
      SELECT 
        gp.id, gp.player_id, gp.buyin, gp.cashout, gp.profit,
        p.name as player_name
      FROM game_players gp
      JOIN players p ON gp.player_id = p.id
      WHERE gp.game_id = ?
      ORDER BY p.name
    `, [gameId]);

    res.status(201).json({
      success: true,
      game: {
        ...createdGame,
        players: gamePlayers
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
router.get('/players', async (req, res) => {
  try {
    const players = await allQuery(`
      SELECT id, name FROM players ORDER BY name
    `);

    res.json({
      success: true,
      players
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});


module.exports = router;
