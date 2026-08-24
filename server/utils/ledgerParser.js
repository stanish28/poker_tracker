/**
 * Parser for PokerNow ledger CSV exports.
 *
 * The export has one row per *session*, not per player: anyone who leaves the
 * table and rejoins gets an additional row. Rows must therefore be aggregated
 * by player_id, which is stable for a person within a ledger, before the
 * numbers mean anything.
 *
 * Expected columns:
 *   player_nickname, player_id, session_start_at, session_end_at,
 *   buy_in, buy_out, stack, nit_escrow, net
 */

const REQUIRED_COLUMNS = ['player_nickname', 'player_id', 'buy_in', 'buy_out', 'stack'];

/**
 * Minimal RFC-4180 CSV reader: handles quoted fields, embedded commas and
 * newlines, and doubled quotes. Player nicknames are quoted and user-chosen,
 * so splitting on commas is not safe.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += char;
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }

  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * Empty cells are meaningful here: a seated player has no buy_out yet, so a
 * blank reads as 0. A cell that is present but unparseable is different -- it
 * means money we cannot account for -- so it is reported rather than silently
 * zeroed.
 */
function num(value, onBadValue) {
  if (value === undefined || value === null || String(value).trim() === '') return 0;
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) {
    if (onBadValue) onBadValue(String(value).trim());
    return 0;
  }
  return n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

class LedgerParser {
  /**
   * @param {string} csvText raw contents of the downloaded ledger
   * @returns {{players: Array, warnings: string[], errors: string[], meta: Object}}
   */
  parse(csvText) {
    const errors = [];
    const warnings = [];

    if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
      return { players: [], errors: ['The file is empty'], warnings: [], meta: {} };
    }

    const rows = parseCsv(csvText.replace(/^﻿/, ''));
    if (rows.length < 2) {
      return { players: [], errors: ['The file has no data rows'], warnings: [], meta: {} };
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length) {
      return {
        players: [],
        errors: [`This does not look like a PokerNow ledger; missing column(s): ${missing.join(', ')}`],
        warnings: [],
        meta: {}
      };
    }

    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    const badValues = [];
    const flag = (column) => (raw) => badValues.push(`${column}="${raw}"`);
    const byPlayer = new Map();
    let openSessions = 0;
    let earliestStart = null;
    let netColumnTotal = 0;

    for (const row of rows.slice(1)) {
      const id = (row[idx.player_id] || '').trim();
      const nickname = (row[idx.player_nickname] || '').trim();
      if (!id && !nickname) continue;

      const key = id || nickname;
      if (!byPlayer.has(key)) {
        byPlayer.set(key, { name: nickname, playerRef: id, buyin: 0, cashout: 0, sessions: 0 });
      }
      const entry = byPlayer.get(key);
      entry.sessions += 1;
      if (nickname) entry.name = nickname;

      // A player still at the table has an empty buy_out and their chips in
      // `stack`, so cash-out is the sum of the two.
      entry.buyin += num(row[idx.buy_in], flag('buy_in'));
      entry.cashout += num(row[idx.buy_out], flag('buy_out')) + num(row[idx.stack], flag('stack'));

      if (idx.net !== undefined) netColumnTotal += num(row[idx.net]);

      const endAt = idx.session_end_at !== undefined ? (row[idx.session_end_at] || '').trim() : '';
      if (!endAt) openSessions += 1;

      const startAt = idx.session_start_at !== undefined ? (row[idx.session_start_at] || '').trim() : '';
      if (startAt && (!earliestStart || startAt < earliestStart)) earliestStart = startAt;
    }

    const players = [...byPlayer.values()].map((p) => ({
      name: p.name,
      buyin: round2(p.buyin),
      cashout: round2(p.cashout),
      profit: round2(p.cashout - p.buyin),
      sessions: p.sessions
    })).sort((a, b) => b.profit - a.profit);

    if (!players.length) errors.push('No player rows found in the file');

    const totalBuyins = round2(players.reduce((s, p) => s + p.buyin, 0));
    const totalCashouts = round2(players.reduce((s, p) => s + p.cashout, 0));
    const discrepancy = round2(totalCashouts - totalBuyins);

    const rejoined = players.filter((p) => p.sessions > 1);
    if (rejoined.length) {
      warnings.push(
        `${rejoined.map((p) => p.name).join(', ')} ` +
        `${rejoined.length === 1 ? 'has' : 'have'} multiple sessions in this ledger; ` +
        `their buy-ins have been combined.`
      );
    }

    if (openSessions > 0) {
      warnings.push(
        `${openSessions} session${openSessions === 1 ? ' was' : 's were'} still open when this ledger ` +
        `was downloaded. Chips in an unfinished pot are not counted in anyone's stack, so the ` +
        `totals may not balance. Re-download after the game ends for exact numbers.`
      );
    }

    if (badValues.length) {
      warnings.push(
        `${badValues.length} amount${badValues.length === 1 ? '' : 's'} could not be read as a ` +
        `number and ${badValues.length === 1 ? 'was' : 'were'} treated as 0: ` +
        `${badValues.slice(0, 5).join(', ')}${badValues.length > 5 ? ', ...' : ''}`
      );
    }

    if (discrepancy !== 0) {
      warnings.push(
        `Cash-outs are ${discrepancy > 0 ? 'over' : 'short'} by ` +
        `$${Math.abs(discrepancy).toFixed(2)} against buy-ins.`
      );
    }

    // The file carries its own net column; disagreeing with it means we have
    // misread the format rather than merely found an unbalanced game.
    if (idx.net !== undefined && Math.abs(round2(netColumnTotal) - discrepancy) > 0.01) {
      warnings.push(
        `The ledger's own net column totals ${round2(netColumnTotal)}, which does not match the ` +
        `${discrepancy} computed from buy-ins and cash-outs. Check the file before importing.`
      );
    }

    return {
      players,
      errors,
      warnings,
      meta: {
        totalBuyins,
        totalCashouts,
        discrepancy,
        playerCount: players.length,
        openSessions,
        // Returned as a raw timestamp so the client can render the date in the
        // viewer's timezone; a late-night game would otherwise land on the
        // wrong day when read as UTC.
        earliestSessionStart: earliestStart
      }
    };
  }
}

module.exports = LedgerParser;
