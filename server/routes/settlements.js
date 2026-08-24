const express = require('express');
const { queryDatabase } = require('../db');

const router = express.Router();

// Settlements endpoints (real data with fallback)
router.get('/', async (req, res) => {
  try {
    // Try to get real data from database
    const settlements = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      ORDER BY date DESC, created_at DESC
    `);
    
    if (settlements) {
      res.json(settlements);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('💰 Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;
    
    const settlement = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      WHERE id = $1
    `, [settlementId]);
    
    if (settlement && settlement.length > 0) {
      res.json(settlement[0]);
    } else {
      res.status(404).json({ error: 'Settlement not found' });
    }
  } catch (error) {
    console.error('💰 Error fetching individual settlement:', error);
    res.status(500).json({ error: 'Failed to fetch settlement' });
  }
});
router.post('/', async (req, res) => {
  try {
    const { from_player_id, to_player_id, amount, date, notes } = req.body;
    
    if (!from_player_id || !to_player_id || !amount || !date) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate players exist
    const players = await queryDatabase(
      'SELECT id, name FROM players WHERE id IN ($1, $2)',
      [from_player_id, to_player_id]
    );
    
    if (!players || players.length !== 2) {
      return res.status(400).json({ error: 'One or more players not found' });
    }
    
    const fromPlayer = players.find(p => p.id === from_player_id);
    const toPlayer = players.find(p => p.id === to_player_id);
    
    if (!fromPlayer || !toPlayer) {
      return res.status(400).json({ error: 'Invalid player selection' });
    }
    
    const settlementId = require('crypto').randomUUID();
    await queryDatabase(`
      INSERT INTO settlements (
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [settlementId, from_player_id, to_player_id, fromPlayer.name, toPlayer.name, amount, date, notes || null]);
    
    // Return the created settlement
    const createdSettlement = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      WHERE id = $1
    `, [settlementId]);
    
    if (createdSettlement && createdSettlement.length > 0) {
      res.status(201).json(createdSettlement[0]);
    } else {
      res.status(201).json({ id: settlementId, message: 'Settlement created successfully' });
    }
  } catch (error) {
    console.error('💰 Error creating settlement:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});
router.put('/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;
    const { amount, date, notes } = req.body;
    
    if (!settlementId) {
      return res.status(400).json({ error: 'Settlement ID is required' });
    }
    
    // Check if settlement exists
    const existingSettlement = await queryDatabase('SELECT id FROM settlements WHERE id = $1', [settlementId]);
    if (!existingSettlement || existingSettlement.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    // Update settlement
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (amount !== undefined) {
      updateFields.push(`amount = $${paramCount}`);
      updateValues.push(amount);
      paramCount++;
    }
    
    if (date !== undefined) {
      updateFields.push(`date = $${paramCount}`);
      updateValues.push(date);
      paramCount++;
    }
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`);
      updateValues.push(notes);
      paramCount++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(settlementId);
    
    const updateQuery = `
      UPDATE settlements 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `;
    
    await queryDatabase(updateQuery, updateValues);
    
    
    // Return the updated settlement
    const updatedSettlement = await queryDatabase(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name, amount, date, notes, created_at
      FROM settlements
      WHERE id = $1
    `, [settlementId]);
    
    if (updatedSettlement && updatedSettlement.length > 0) {
      res.json(updatedSettlement[0]);
    } else {
      res.status(404).json({ error: 'Settlement not found' });
    }
  } catch (error) {
    console.error('💰 Error updating settlement:', error);
    res.status(500).json({ error: 'Failed to update settlement' });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;
    
    // Check if settlement exists
    const existingSettlement = await queryDatabase('SELECT id FROM settlements WHERE id = $1', [settlementId]);
    if (!existingSettlement || existingSettlement.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    await queryDatabase('DELETE FROM settlements WHERE id = $1', [settlementId]);
    
    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('💰 Error deleting settlement:', error);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
});
router.get('/stats/overview', async (req, res) => {
  try {
    // Try to get real data from database
    const stats = await queryDatabase(`
      SELECT 
        COUNT(*) as total_settlements,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
      FROM settlements
    `);
    
    if (stats && stats.length > 0) {
      res.json({
        total_settlements: parseInt(stats[0].total_settlements),
        total_amount: stats[0].total_amount.toString()
      });
    } else {
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
router.get('/player/:playerId/debts', async (req, res) => {
  try {
    const playerId = req.params.playerId;
    
    // Check if player exists
    const player = await queryDatabase('SELECT id, name FROM players WHERE id = $1', [playerId]);
    if (!player || player.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Get debts owed by this player
    const debtsOwed = await queryDatabase(`
      SELECT 
        s.id, s.to_player_name, s.amount, s.date, s.notes
      FROM settlements s
      WHERE s.from_player_id = $1
      ORDER BY s.date DESC
    `, [playerId]);
    
    // Get debts owed to this player
    const debtsOwedTo = await queryDatabase(`
      SELECT 
        s.id, s.from_player_name, s.amount, s.date, s.notes
      FROM settlements s
      WHERE s.to_player_id = $1
      ORDER BY s.date DESC
    `, [playerId]);
    
    const totalOwed = (debtsOwed || []).reduce((sum, debt) => sum + parseFloat(debt.amount || 0), 0);
    const totalOwedTo = (debtsOwedTo || []).reduce((sum, debt) => sum + parseFloat(debt.amount || 0), 0);
    const netDebt = totalOwedTo - totalOwed;
    
    res.json({
      player: { id: player[0].id, name: player[0].name },
      debtsOwed: debtsOwed || [],
      debtsOwedTo: debtsOwedTo || [],
      totalOwed,
      totalOwedTo,
      netDebt
    });
  } catch (error) {
    console.error('💰 Error fetching player debts:', error);
    res.status(500).json({ error: 'Failed to fetch player debt information' });
  }
});
module.exports = router;
