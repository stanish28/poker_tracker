const express = require('express');
const { queryDatabase } = require('../db');
const { sendGameResultEmail } = require('../notifications/email');
const TextParser = require('../utils/textParser');
const FuzzyMatcher = require('../utils/fuzzyMatcher');
const LedgerParser = require('../utils/ledgerParser');

// Initialize utilities
const textParser = new TextParser();
const fuzzyMatcher = new FuzzyMatcher();
const ledgerParser = new LedgerParser();

const router = express.Router();

/**
 * Parse text and return preview data
 * POST /api/bulk-game/parse
 */
router.post('/parse', async (req, res) => {
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
/**
 * Parse an uploaded PokerNow ledger CSV and return a preview.
 * POST /api/bulk-game/parse-ledger
 *
 * Mirrors the shape of /parse so the client preview can be shared, but carries
 * real buy-in and cash-out figures from the file instead of deriving them from
 * a net amount.
 *
 * The file arrives as text in a JSON body rather than as a multipart upload:
 * the client reads it with FileReader, which keeps this endpoint behind the
 * same JSON + bearer-token handling as every other route.
 */
router.post('/parse-ledger', async (req, res) => {
  try {
    const { csv } = req.body;

    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: 'A ledger CSV is required' });
    }

    const parsed = ledgerParser.parse(csv);
    if (parsed.errors.length) {
      return res.status(400).json({
        error: parsed.errors[0],
        details: parsed.errors,
        warnings: parsed.warnings
      });
    }

    const existingPlayers = await queryDatabase(`
      SELECT id, name FROM players ORDER BY name
    `);

    const matching = fuzzyMatcher.matchPlayers(parsed.players, existingPlayers || []);

    res.json({
      success: true,
      preview: {
        players: parsed.players,
        totalBuyins: parsed.meta.totalBuyins,
        totalCashouts: parsed.meta.totalCashouts,
        discrepancy: parsed.meta.discrepancy,
        playerCount: parsed.meta.playerCount,
        // Raw timestamp: the client renders the day in the viewer's timezone,
        // so a late-night game is not pushed onto the next date by UTC.
        earliestSessionStart: parsed.meta.earliestSessionStart
      },
      matching: {
        matched: matching.matched,
        unmatched: matching.unmatched
      },
      validation: {
        errors: [],
        warnings: parsed.warnings
      }
    });

  } catch (error) {
    console.error('Error parsing ledger:', error);
    res.status(500).json({ error: 'Failed to parse ledger' });
  }
});

router.post('/create', async (req, res) => {
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
      const { name, profit, playerId, buyin: rawBuyin, cashout: rawCashout } = playerData;
      
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

      // A ledger import knows the real amounts, so use them. Text import only
      // yields a net figure, and falls back to synthesising the two from it.
      const hasRealAmounts = rawBuyin !== undefined && rawCashout !== undefined;
      const { buyin, cashout } = hasRealAmounts
        ? { buyin: Number(rawBuyin), cashout: Number(rawCashout) }
        : textParser.convertProfitToBuyinCashout(profit);

      // Derive profit from the amounts actually being stored rather than
      // trusting the caller's figure, so the row cannot contradict itself.
      const finalProfit = hasRealAmounts
        ? Math.round((cashout - buyin) * 100) / 100
        : profit;

      processedPlayers.push({
        player_id: finalPlayerId,
        buyin,
        cashout,
        profit: finalProfit
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

    await Promise.allSettled(
      processedPlayers.map(async (player) => {
        try {
          const rows = await queryDatabase(
            'SELECT name, email FROM players WHERE id = $1',
            [player.player_id]
          );
          if (!rows || !rows[0] || !rows[0].email) return;
          await sendGameResultEmail(rows[0].email, rows[0].name, {
            buyin: player.buyin,
            cashout: player.cashout,
            profit: player.profit,
            date,
          });
        } catch (_) {
          /* non-fatal */
        }
      })
    );

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
router.get('/players', async (req, res) => {
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
module.exports = router;
