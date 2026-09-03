const express = require('express');
const { queryDatabase, withTransaction } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { planMerge, mergePlayers, loadParticipants } = require('../utils/mergePlayers');

const router = express.Router();

/**
 * Validate a merge request body. Returns an error string, or null when usable.
 */
function validateMergeBody({ sourceIds, targetId, newName }, { requireName = false } = {}) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return 'At least one player to merge from is required';
  }
  if (!targetId) return 'A player to merge into is required';
  if (sourceIds.includes(targetId)) {
    return 'A player cannot be merged into itself';
  }
  if (requireName && (typeof newName !== 'string' || !newName.trim())) {
    return 'The merged player needs a name';
  }
  return null;
}

// Merge routes are declared before the '/:id' handlers below so that '/merge'
// is never captured as a player id.

/** Preview a merge: reports exactly what would change, and writes nothing. */
router.post('/merge/preview', requireAdmin, async (req, res) => {
  const problem = validateMergeBody(req.body);
  if (problem) return res.status(400).json({ error: problem });

  const { sourceIds, targetId } = req.body;

  try {
    // planMerge issues only SELECTs, so this transaction reads a consistent
    // snapshot and commits without having written anything.
    const result = await withTransaction(async (client) => {
      const { target, sources } = await loadParticipants(client, sourceIds, targetId);
      const plan = await planMerge(client, sourceIds, targetId);
      return { target, sources, plan };
    });

    res.json({
      success: true,
      target: { id: result.target.id, name: result.target.name, email: result.target.email },
      sources: result.sources.map((s) => ({ id: s.id, name: s.name, total_games: s.total_games })),
      ...result.plan
    });
  } catch (error) {
    console.error('Error previewing player merge:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to preview merge' });
  }
});

/** Perform the merge. Atomic: either every step lands or none do. */
router.post('/merge', requireAdmin, async (req, res) => {
  const problem = validateMergeBody(req.body, { requireName: true });
  if (problem) return res.status(400).json({ error: problem });

  const { sourceIds, targetId, newName } = req.body;

  try {
    const result = await withTransaction((client) =>
      mergePlayers(client, {
        sourceIds,
        targetId,
        newName: (newName || '').trim()
      })
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error merging players:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to merge players' });
  }
});

// Update player endpoint
router.put('/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    const { name, email } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const emailVal = email === undefined || email === '' || email === null
      ? null
      : String(email).trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    const result = await queryDatabase(`
      UPDATE players 
      SET name = $1, email = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, name, email, net_profit, total_games, total_buyins, total_cashouts, created_at, updated_at
    `, [name.trim(), emailVal, playerId]);

    const row = result?.rows?.[0];
    if (!row) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    res.json(row);
  } catch (error) {
    console.error('👥 Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});
// Recalculate all player statistics from game_players table
router.post('/recalculate-stats', async (req, res) => {
  try {
    
    // Get all players
    const players = await queryDatabase(`SELECT id, name FROM players`);
    
    if (!players || players.length === 0) {
      return res.json({ message: 'No players found', updated: 0 });
    }
    
    let updatedCount = 0;
    const results = [];
    
    for (const player of players) {
      // Calculate actual stats from game_players table
      const gameStats = await queryDatabase(`
        SELECT 
          COALESCE(SUM(CAST(buyin AS DECIMAL)), 0) as total_buyins,
          COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) as total_cashouts,
          COUNT(*) as total_games
        FROM game_players 
        WHERE player_id = $1
      `, [player.id]);
      
      const totalBuyins = parseFloat(gameStats?.[0]?.total_buyins || 0);
      const totalCashouts = parseFloat(gameStats?.[0]?.total_cashouts || 0);
      const totalGames = parseInt(gameStats?.[0]?.total_games || 0);
      const netProfit = totalCashouts - totalBuyins;
      
      // Update player record
      await queryDatabase(`
        UPDATE players 
        SET 
          net_profit = $1,
          total_games = $2,
          total_buyins = $3,
          total_cashouts = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [netProfit, totalGames, totalBuyins, totalCashouts, player.id]);
      
      updatedCount++;
      results.push({
        id: player.id,
        name: player.name,
        net_profit: netProfit,
        total_games: totalGames,
        total_buyins: totalBuyins,
        total_cashouts: totalCashouts
      });
    }
    
    res.json({ 
      message: `Successfully recalculated statistics for ${updatedCount} players`,
      updated: updatedCount,
      players: results
    });
  } catch (error) {
    console.error('🔄 Error recalculating player stats:', error);
    res.status(500).json({ error: 'Failed to recalculate player statistics' });
  }
});
// Recalculate single player statistics
router.post('/:id/recalculate-stats', async (req, res) => {
  try {
    const playerId = req.params.id;
    
    // Check if player exists
    const player = await queryDatabase(`SELECT id, name FROM players WHERE id = $1`, [playerId]);
    if (!player || player.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Calculate actual stats from game_players table
    const gameStats = await queryDatabase(`
      SELECT 
        COALESCE(SUM(CAST(buyin AS DECIMAL)), 0) as total_buyins,
        COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) as total_cashouts,
        COUNT(*) as total_games
      FROM game_players 
      WHERE player_id = $1
    `, [playerId]);
    
    const totalBuyins = parseFloat(gameStats?.[0]?.total_buyins || 0);
    const totalCashouts = parseFloat(gameStats?.[0]?.total_cashouts || 0);
    const totalGames = parseInt(gameStats?.[0]?.total_games || 0);
    const netProfit = totalCashouts - totalBuyins;
    
    // Update player record
    await queryDatabase(`
      UPDATE players 
      SET 
        net_profit = $1,
        total_games = $2,
        total_buyins = $3,
        total_cashouts = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [netProfit, totalGames, totalBuyins, totalCashouts, playerId]);
    
    res.json({ 
      message: `Successfully recalculated statistics for ${player[0].name}`,
      player: {
        id: playerId,
        name: player[0].name,
        net_profit: netProfit,
        total_games: totalGames,
        total_buyins: totalBuyins,
        total_cashouts: totalCashouts
      }
    });
  } catch (error) {
    console.error('🔄 Error recalculating player stats:', error);
    res.status(500).json({ error: 'Failed to recalculate player statistics' });
  }
});
// Delete player endpoint
router.delete('/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    
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
    
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    console.error('👥 Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});
// Create player (Vercel API parity with main server)
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }
    const emailVal = email === undefined || email === '' || email === null
      ? null
      : String(email).trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const dup = await queryDatabase(
      'SELECT id FROM players WHERE LOWER(name) = LOWER($1)',
      [String(name).trim()]
    );
    if (dup && dup.length > 0) {
      return res.status(400).json({ error: 'Player with this name already exists' });
    }
    const id = require('crypto').randomUUID();
    const ins = await queryDatabase(
      `INSERT INTO players (id, name, email)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, net_profit, total_games, total_buyins, total_cashouts, created_at, updated_at`,
      [id, String(name).trim(), emailVal]
    );
    const row = ins?.rows?.[0];
    if (!row) {
      return res.status(500).json({ error: 'Failed to create player' });
    }
    res.status(201).json(row);
  } catch (error) {
    console.error('👥 Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});
// Players endpoints (real data with fallback)
router.get('/', async (req, res) => {
  try {
    // Try to get real data from database
    const players = await queryDatabase(`
      SELECT 
        id, name, email, net_profit, total_games, total_buyins, total_cashouts, created_at, updated_at
      FROM players 
      ORDER BY name
    `);
    
    if (players && players.length > 0) {
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
// Player performance over time (playing curve).
router.get('/:id/performance', async (req, res) => {
  try {
    const playerId = req.params.id;

    const playerRows = await queryDatabase(
      `SELECT id, name FROM players WHERE id = $1`,
      [playerId]
    );
    if (!playerRows || playerRows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const player = playerRows[0];

    const games = await queryDatabase(
      `
      SELECT g.id as game_id, g.date, gp.profit, gp.cashout, gp.buyin
      FROM games g
      JOIN game_players gp ON g.id = gp.game_id
      WHERE gp.player_id = $1
      ORDER BY g.date ASC, g.id ASC
    `,
      [playerId]
    );

    const rows = games || [];
    let cumulative = 0;
    const dataPoints = rows.map((row) => {
      const stored = parseFloat(row.profit);
      const profit = Number.isFinite(stored)
        ? stored
        : parseFloat(row.cashout || 0) - parseFloat(row.buyin || 0);
      cumulative += profit;
      return {
        date: row.date,
        game_id: row.game_id,
        profit,
        cumulativeProfit: Math.round(cumulative * 100) / 100
      };
    });

    let summary = null;
    if (dataPoints.length > 0) {
      const profits = dataPoints.map((d) => d.profit);
      const winningGames = profits.filter((p) => p > 0).length;
      const totalProfit = profits.reduce((s, p) => s + p, 0);
      const avgProfitPerGame = totalProfit / dataPoints.length;
      const bestIdx = profits.indexOf(Math.max(...profits));
      const worstIdx = profits.indexOf(Math.min(...profits));

      let currentStreak = 0;
      let streakType = null;
      for (let i = profits.length - 1; i >= 0; i--) {
        if (streakType === null) {
          streakType = profits[i] > 0 ? 'winning' : 'losing';
          currentStreak = 1;
        } else if ((profits[i] > 0) === (streakType === 'winning')) {
          currentStreak++;
        } else {
          break;
        }
      }

      const n = Math.min(5, Math.floor(dataPoints.length / 2));
      let trend = 'stable';
      let trendLabel = 'Not enough games for trend';
      if (n >= 2) {
        const recent = profits.slice(-n);
        const previous = profits.slice(-n * 2, -n);
        const recentAvg = recent.reduce((s, p) => s + p, 0) / recent.length;
        const previousAvg = previous.reduce((s, p) => s + p, 0) / previous.length;
        const diff = recentAvg - previousAvg;
        if (diff > 1) {
          trend = 'up';
          trendLabel = `Up in last ${n} games (avg $${recentAvg.toFixed(2)} vs $${previousAvg.toFixed(2)})`;
        } else if (diff < -1) {
          trend = 'down';
          trendLabel = `Down in last ${n} games (avg $${recentAvg.toFixed(2)} vs $${previousAvg.toFixed(2)})`;
        } else {
          trendLabel = `Stable (last ${n} games similar to previous)`;
        }
      } else if (dataPoints.length >= 2) {
        trendLabel = `Only ${dataPoints.length} games – keep playing for trend`;
      }

      summary = {
        winRatePercent: Math.round((winningGames / dataPoints.length) * 100),
        avgProfitPerGame: Math.round(avgProfitPerGame * 100) / 100,
        bestGame: {
          profit: dataPoints[bestIdx].profit,
          date: dataPoints[bestIdx].date
        },
        worstGame: {
          profit: dataPoints[worstIdx].profit,
          date: dataPoints[worstIdx].date
        },
        trend,
        trendLabel,
        currentStreak: { count: currentStreak, type: streakType }
      };
    }

    res.json({
      player: { id: player.id, name: player.name },
      dataPoints,
      summary
    });
  } catch (error) {
    console.error('Error fetching player performance:', error);
    res.status(500).json({ error: 'Failed to fetch player performance' });
  }
});
// Individual player net profit endpoint
router.get('/:id/net-profit', async (req, res) => {
  try {
    const playerId = req.params.id;
    
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
router.get('/net-profit/bulk', async (req, res) => {
  try {
    
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
module.exports = router;
