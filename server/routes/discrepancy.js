const express = require('express');
const { queryDatabase } = require('../db');

const router = express.Router();

// Total discrepancy endpoint
router.get('/total', async (req, res) => {
  try {
    
    // Get all players and calculate their net profits from game data
    const players = await queryDatabase(`
      SELECT 
        id, name
      FROM players 
      ORDER BY name
    `);

    if (players && players.length > 0) {

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
module.exports = router;
