const express = require('express');
const { queryDatabase } = require('../db');

const router = express.Router();

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * Render one CSV field.
 *
 * Text fields are prefixed with an apostrophe when they begin with a character
 * that Excel and Sheets treat as the start of a formula. Player names and
 * settlement notes are user-supplied, so without this a name like "=1+1" would
 * be evaluated on open. Numeric columns skip the guard, since a negative
 * profit legitimately starts with "-".
 */
function csvField(value, { numeric = false } = {}) {
  if (value === null || value === undefined) return '';

  let out = String(value);
  if (!numeric && /^[=+\-@\t\r]/.test(out)) out = "'" + out;

  // Quote when the value would otherwise break the row apart.
  if (/[",\n\r]/.test(out)) out = '"' + out.replace(/"/g, '""') + '"';
  return out;
}

function toCsv(headers, rows) {
  const numericColumns = new Set(['buyin', 'cashout', 'profit', 'amount',
    'net_profit', 'total_games', 'total_buyins', 'total_cashouts',
    'discrepancy', 'player_count']);

  const lines = [headers.map((h) => csvField(h)).join(',')];
  for (const row of rows) {
    lines.push(headers
      .map((h) => csvField(row[h], { numeric: numericColumns.has(h) }))
      .join(','));
  }
  // CRLF and a UTF-8 BOM so Excel opens accented names correctly.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function sendCsv(res, filename, headers, rows) {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',
    `attachment; filename="${filename}-${stamp}.csv"`);
  res.send(toCsv(headers, rows));
}

const EXPORTS = {
  // One row per player per game, which is the grain people actually want in a
  // spreadsheet -- the /api/games list is game-level only.
  games: {
    filename: 'poker-game-history',
    headers: ['date', 'game_id', 'player_name', 'buyin', 'cashout', 'profit'],
    // date is formatted by TO_CHAR rather than in JS: node-postgres turns DATE
    // into a local-midnight Date object, which stringifies unreadably and can
    // shift the day across a timezone boundary.
    sql: `
      SELECT TO_CHAR(g.date, 'YYYY-MM-DD') AS date,
             g.id AS game_id, p.name AS player_name,
             gp.buyin, gp.cashout, gp.profit
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      JOIN players p ON gp.player_id = p.id
      ORDER BY g.date DESC, p.name
    `
  },
  players: {
    filename: 'poker-players',
    headers: ['name', 'email', 'total_games', 'total_buyins', 'total_cashouts',
      'net_profit'],
    sql: `
      SELECT name, email, total_games, total_buyins, total_cashouts, net_profit
      FROM players
      ORDER BY name
    `
  },
  settlements: {
    filename: 'poker-settlements',
    headers: ['date', 'from_player_name', 'to_player_name', 'amount', 'notes'],
    sql: `
      SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date,
             from_player_name, to_player_name, amount, notes
      FROM settlements
      ORDER BY date DESC, created_at DESC
    `
  }
};

router.get('/:dataset', async (req, res) => {
  const spec = EXPORTS[req.params.dataset];
  if (!spec) {
    return res.status(404).json({
      error: `Unknown export. Available: ${Object.keys(EXPORTS).join(', ')}`
    });
  }

  try {
    const rows = await queryDatabase(spec.sql);
    if (!rows) {
      // queryDatabase swallows failures and returns null; treat that as an
      // error rather than sending a valid-looking empty spreadsheet.
      return res.status(503).json({ error: 'Database unavailable' });
    }
    sendCsv(res, spec.filename, spec.headers, rows);
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({ error: 'Failed to build export' });
  }
});
module.exports = router;
