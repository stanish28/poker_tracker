const express = require('express');
const { getQuery, allQuery } = require('../database/postgres-adapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

// Total discrepancy: sum of profits vs losses across all players (system balance)
router.get('/total', async (req, res) => {
  try {
    const players = await allQuery(`
      SELECT id, name FROM players ORDER BY name
    `);

    if (!players || players.length === 0) {
      return res.json({
        total_positive_profit: 0,
        total_negative_profit: 0,
        total_discrepancy: 0,
        is_balanced: true,
        players_count: 0
      });
    }

    let totalPositive = 0;
    let totalNegative = 0;

    for (const player of players) {
      const gameStats = await getQuery(`
        SELECT
          COALESCE(SUM(buyin), 0) as total_buyins,
          COALESCE(SUM(cashout), 0) as total_cashouts
        FROM game_players
        WHERE player_id = ?
      `, [player.id]);

      const totalBuyins = parseFloat(gameStats?.total_buyins || 0);
      const totalCashouts = parseFloat(gameStats?.total_cashouts || 0);
      const netProfit = totalCashouts - totalBuyins;

      if (netProfit > 0) {
        totalPositive += netProfit;
      } else if (netProfit < 0) {
        totalNegative += Math.abs(netProfit);
      }
    }

    const totalDiscrepancy = totalPositive - totalNegative;
    const isBalanced = Math.abs(totalDiscrepancy) < 0.01;

    res.json({
      total_positive_profit: totalPositive,
      total_negative_profit: totalNegative,
      total_discrepancy: totalDiscrepancy,
      is_balanced: isBalanced,
      players_count: players.length
    });
  } catch (error) {
    console.error('Error calculating total discrepancy:', error);
    res.status(500).json({ error: 'Failed to calculate total discrepancy' });
  }
});

module.exports = router;
