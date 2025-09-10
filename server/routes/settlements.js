const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { runQuery, getQuery, allQuery } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all settlements
router.get('/', async (req, res) => {
  try {
    const settlements = await allQuery(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name,
        amount, date, notes, created_at
      FROM settlements 
      ORDER BY date DESC, created_at DESC
    `);
    res.json(settlements);
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

// Get single settlement
router.get('/:id', async (req, res) => {
  try {
    const settlement = await getQuery(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name,
        amount, date, notes, created_at
      FROM settlements 
      WHERE id = ?
    `, [req.params.id]);

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    res.json(settlement);
  } catch (error) {
    console.error('Error fetching settlement:', error);
    res.status(500).json({ error: 'Failed to fetch settlement' });
  }
});

// Create new settlement
router.post('/', [
  body('from_player_id').notEmpty().withMessage('From player ID is required'),
  body('to_player_id').notEmpty().withMessage('To player ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { from_player_id, to_player_id, amount, date, notes } = req.body;

    // Validate players exist
    const players = await allQuery(
      'SELECT id, name FROM players WHERE id IN (?, ?)',
      [from_player_id, to_player_id]
    );

    if (players.length !== 2) {
      return res.status(400).json({ error: 'One or more players not found' });
    }

    const fromPlayer = players.find(p => p.id === from_player_id);
    const toPlayer = players.find(p => p.id === to_player_id);

    if (!fromPlayer || !toPlayer) {
      return res.status(400).json({ error: 'Invalid player selection' });
    }

    const settlementId = uuidv4();
    await runQuery(`
      INSERT INTO settlements (
        id, from_player_id, to_player_id, from_player_name, to_player_name,
        amount, date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      settlementId, from_player_id, to_player_id, 
      fromPlayer.name, toPlayer.name, amount, date, notes || null
    ]);

    const newSettlement = await getQuery(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name,
        amount, date, notes, created_at
      FROM settlements 
      WHERE id = ?
    `, [settlementId]);

    res.status(201).json(newSettlement);
  } catch (error) {
    console.error('Error creating settlement:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

// Update settlement
router.put('/:id', [
  body('amount').optional().isNumeric().withMessage('Amount must be a number'),
  body('date').optional().isISO8601().withMessage('Valid date is required'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const settlementId = req.params.id;
    const { amount, date, notes } = req.body;

    // Check if settlement exists
    const existingSettlement = await getQuery('SELECT id FROM settlements WHERE id = ?', [settlementId]);
    if (!existingSettlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    const updateFields = [];
    const updateValues = [];

    if (amount !== undefined) {
      updateFields.push('amount = ?');
      updateValues.push(amount);
    }

    if (date !== undefined) {
      updateFields.push('date = ?');
      updateValues.push(date);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(settlementId);

    await runQuery(
      `UPDATE settlements SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    const updatedSettlement = await getQuery(`
      SELECT 
        id, from_player_id, to_player_id, from_player_name, to_player_name,
        amount, date, notes, created_at
      FROM settlements 
      WHERE id = ?
    `, [settlementId]);

    res.json(updatedSettlement);
  } catch (error) {
    console.error('Error updating settlement:', error);
    res.status(500).json({ error: 'Failed to update settlement' });
  }
});

// Delete settlement
router.delete('/:id', async (req, res) => {
  try {
    const settlementId = req.params.id;

    // Check if settlement exists
    const existingSettlement = await getQuery('SELECT id FROM settlements WHERE id = ?', [settlementId]);
    if (!existingSettlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    await runQuery('DELETE FROM settlements WHERE id = ?', [settlementId]);

    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
});

// Get settlement statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getQuery(`
      SELECT 
        COUNT(*) as total_settlements,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MAX(date) as last_settlement_date
      FROM settlements
    `);

    const recentSettlements = await allQuery(`
      SELECT 
        id, from_player_name, to_player_name, amount, date, notes
      FROM settlements
      ORDER BY date DESC
      LIMIT 5
    `);

    // Get debt summary
    const debtSummary = await allQuery(`
      SELECT 
        p.name,
        COALESCE(SUM(CASE WHEN s.from_player_id = p.id THEN -s.amount ELSE s.amount END), 0) as net_debt
      FROM players p
      LEFT JOIN settlements s ON p.id = s.from_player_id OR p.id = s.to_player_id
      GROUP BY p.id, p.name
      HAVING net_debt != 0
      ORDER BY ABS(net_debt) DESC
    `);

    res.json({ ...stats, recentSettlements, debtSummary });
  } catch (error) {
    console.error('Error fetching settlement stats:', error);
    res.status(500).json({ error: 'Failed to fetch settlement statistics' });
  }
});

// Get player debt summary
router.get('/player/:playerId/debts', async (req, res) => {
  try {
    const playerId = req.params.playerId;

    // Check if player exists
    const player = await getQuery('SELECT id, name FROM players WHERE id = ?', [playerId]);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get debts owed by this player
    const debtsOwed = await allQuery(`
      SELECT 
        s.id, s.to_player_name, s.amount, s.date, s.notes
      FROM settlements s
      WHERE s.from_player_id = ?
      ORDER BY s.date DESC
    `, [playerId]);

    // Get debts owed to this player
    const debtsOwedTo = await allQuery(`
      SELECT 
        s.id, s.from_player_name, s.amount, s.date, s.notes
      FROM settlements s
      WHERE s.to_player_id = ?
      ORDER BY s.date DESC
    `, [playerId]);

    const totalOwed = debtsOwed.reduce((sum, debt) => sum + debt.amount, 0);
    const totalOwedTo = debtsOwedTo.reduce((sum, debt) => sum + debt.amount, 0);
    const netDebt = totalOwedTo - totalOwed;

    res.json({
      player: { id: player.id, name: player.name },
      debtsOwed,
      debtsOwedTo,
      totalOwed,
      totalOwedTo,
      netDebt
    });
  } catch (error) {
    console.error('Error fetching player debts:', error);
    res.status(500).json({ error: 'Failed to fetch player debt information' });
  }
});

module.exports = router;
