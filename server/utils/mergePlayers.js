// ---------------------------------------------------------------------------
// Merging duplicate players
//
// Duplicates accumulate because a ledger import creates a new player whenever a
// nickname does not match an existing name -- the same person shows up as
// "Soni" and "Soni03". Merging folds one or more source players into a target
// and gives the result a single chosen name.
//
// Every statement here runs on a transaction client whose query() throws, so a
// failure anywhere aborts the whole merge. Never route this through
// queryDatabase(), which releases its client per call and converts write errors
// into return values.
// ---------------------------------------------------------------------------

/** Load the players involved, rejecting anything that would make the merge ill-defined. */
async function loadParticipants(client, sourceIds, targetId) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw Object.assign(new Error('At least one source player is required'), { status: 400 });
  }
  if (!targetId) {
    throw Object.assign(new Error('A target player is required'), { status: 400 });
  }
  // Guarded here as well as in the route: without it the delete step below
  // would remove the very player the merge is supposed to keep.
  if (sourceIds.includes(targetId)) {
    throw Object.assign(new Error('A player cannot be merged into itself'), { status: 400 });
  }

  const ids = [...new Set([...sourceIds, targetId])];

  const { rows } = await client.query(
    `SELECT id, name, email, total_games FROM players WHERE id = ANY($1::text[])`,
    [ids]
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    throw Object.assign(new Error(`Player not found: ${missing.join(', ')}`), { status: 404 });
  }

  return {
    target: byId.get(targetId),
    sources: sourceIds.map((id) => byId.get(id))
  };
}

/**
 * Work out what a merge would change, without writing anything.
 *
 * Two cases need care and are surfaced separately in the result:
 *  - a game both the target and a source played in, where the two rows have to
 *    be combined rather than simply repointed; and
 *  - a settlement between two players being merged, which would otherwise end
 *    up pointing a payment at the person who made it.
 */
async function planMerge(client, sourceIds, targetId) {
  const allIds = [...sourceIds, targetId];

  const { rows: collisions } = await client.query(
    `SELECT gp.game_id,
            g.date,
            SUM(CAST(gp.buyin AS DECIMAL))   AS buyin,
            SUM(CAST(gp.cashout AS DECIMAL)) AS cashout,
            COUNT(*)                          AS row_count
       FROM game_players gp
       LEFT JOIN games g ON g.id = gp.game_id
      WHERE gp.player_id = ANY($1::text[])
      GROUP BY gp.game_id, g.date
     HAVING COUNT(*) > 1
      ORDER BY g.date DESC`,
    [allIds]
  );

  const { rows: moving } = await client.query(
    `SELECT COUNT(*)::int AS count FROM game_players WHERE player_id = ANY($1::text[])`,
    [sourceIds]
  );

  const { rows: settlementsMoving } = await client.query(
    `SELECT COUNT(*)::int AS count FROM settlements
      WHERE from_player_id = ANY($1::text[]) OR to_player_id = ANY($1::text[])`,
    [sourceIds]
  );

  // A settlement whose two sides both end up as the target is a payment from a
  // person to themselves. It has to go, or the settlement totals drift.
  // Report each side's *current* name. settlements.from_player_name is captured
  // when the settlement is created and goes stale on rename, so showing it here
  // makes the preview disagree with the merge it is describing.
  const { rows: selfSettlements } = await client.query(
    `SELECT s.id,
            COALESCE(pf.name, s.from_player_name) AS from_name,
            COALESCE(pt.name, s.to_player_name)   AS to_name,
            s.amount, s.date
       FROM settlements s
       LEFT JOIN players pf ON pf.id = s.from_player_id
       LEFT JOIN players pt ON pt.id = s.to_player_id
      WHERE s.from_player_id = ANY($1::text[]) AND s.to_player_id = ANY($1::text[])
      ORDER BY s.date DESC`,
    [allIds]
  );

  // What the target's stats become once every source row belongs to it.
  const { rows: totals } = await client.query(
    `SELECT COALESCE(SUM(CAST(buyin AS DECIMAL)), 0)   AS total_buyins,
            COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) AS total_cashouts,
            COUNT(DISTINCT game_id)::int               AS total_games
       FROM game_players
      WHERE player_id = ANY($1::text[])`,
    [allIds]
  );

  const t = totals[0] || { total_buyins: 0, total_cashouts: 0, total_games: 0 };
  const buyins = parseFloat(t.total_buyins);
  const cashouts = parseFloat(t.total_cashouts);

  return {
    gameRowsMoving: moving[0]?.count ?? 0,
    settlementsMoving: settlementsMoving[0]?.count ?? 0,
    collisions: collisions.map((c) => ({
      gameId: c.game_id,
      date: c.date,
      rowCount: parseInt(c.row_count, 10),
      combinedBuyin: parseFloat(c.buyin),
      combinedCashout: parseFloat(c.cashout)
    })),
    selfSettlements: selfSettlements.map((s) => ({
      id: s.id,
      from: s.from_name,
      to: s.to_name,
      amount: parseFloat(s.amount),
      date: s.date
    })),
    resultingTotals: {
      total_games: t.total_games,
      total_buyins: buyins,
      total_cashouts: cashouts,
      net_profit: cashouts - buyins
    }
  };
}

/**
 * Fold `sourceIds` into `targetId` and rename the survivor to `newName`.
 *
 * Order matters: game rows are combined before they are repointed, so the
 * combine step can still tell the two players apart; and self-settlements are
 * deleted after repointing, which catches settlements between two sources as
 * well as between a source and the target.
 */
async function mergePlayers(client, { sourceIds, targetId, newName }) {
  const { target, sources } = await loadParticipants(client, sourceIds, targetId);
  const plan = await planMerge(client, sourceIds, targetId);
  const allIds = [...sourceIds, targetId];

  // 1. Combine rows for games where the target and a source both appear.
  for (const collision of plan.collisions) {
    const { rows: keep } = await client.query(
      `SELECT id FROM game_players
        WHERE game_id = $1 AND player_id = ANY($2::text[])
        ORDER BY (player_id = $3) DESC, created_at ASC
        LIMIT 1`,
      [collision.gameId, allIds, targetId]
    );
    const keepId = keep[0].id;

    await client.query(
      `UPDATE game_players
          SET buyin = $1, cashout = $2, profit = $3, player_id = $4
        WHERE id = $5`,
      [
        collision.combinedBuyin.toString(),
        collision.combinedCashout.toString(),
        (collision.combinedCashout - collision.combinedBuyin).toString(),
        targetId,
        keepId
      ]
    );

    await client.query(
      `DELETE FROM game_players
        WHERE game_id = $1 AND player_id = ANY($2::text[]) AND id <> $3`,
      [collision.gameId, allIds, keepId]
    );
  }

  // 2. Repoint every remaining game row at the target.
  await client.query(
    `UPDATE game_players SET player_id = $1 WHERE player_id = ANY($2::text[])`,
    [targetId, sourceIds]
  );

  // 3. Repoint settlements, then drop any that now point at themselves.
  await client.query(
    `UPDATE settlements SET from_player_id = $1 WHERE from_player_id = ANY($2::text[])`,
    [targetId, sourceIds]
  );
  await client.query(
    `UPDATE settlements SET to_player_id = $1 WHERE to_player_id = ANY($2::text[])`,
    [targetId, sourceIds]
  );
  // Scoped to the target: an unqualified `from_player_id = to_player_id` would
  // also delete unrelated self-referential rows that this merge did not create.
  const dropped = await client.query(
    `DELETE FROM settlements
      WHERE from_player_id = $1 AND to_player_id = $1`,
    [targetId]
  );

  // 4. Keep an email if the target lacks one but a source has it.
  const inheritedEmail = target.email || sources.find((s) => s.email)?.email || null;

  // 5. The sources are now unreferenced.
  await client.query(`DELETE FROM players WHERE id = ANY($1::text[])`, [sourceIds]);

  // 6. Rename the survivor and refresh its stats from the merged rows.
  const { rows: totals } = await client.query(
    `SELECT COALESCE(SUM(CAST(buyin AS DECIMAL)), 0)   AS total_buyins,
            COALESCE(SUM(CAST(cashout AS DECIMAL)), 0) AS total_cashouts,
            COUNT(*)::int                              AS total_games
       FROM game_players WHERE player_id = $1`,
    [targetId]
  );
  const buyins = parseFloat(totals[0].total_buyins);
  const cashouts = parseFloat(totals[0].total_cashouts);

  const { rows: merged } = await client.query(
    `UPDATE players
        SET name = $1, email = $2, net_profit = $3, total_games = $4,
            total_buyins = $5, total_cashouts = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING id, name, email, net_profit, total_games, total_buyins, total_cashouts`,
    [newName, inheritedEmail, cashouts - buyins, totals[0].total_games, buyins, cashouts, targetId]
  );

  // 7. settlements carries denormalised names; without this the history keeps
  //    showing whichever duplicate name was used at the time.
  await client.query(
    `UPDATE settlements SET from_player_name = $1 WHERE from_player_id = $2`,
    [newName, targetId]
  );
  await client.query(
    `UPDATE settlements SET to_player_name = $1 WHERE to_player_id = $2`,
    [newName, targetId]
  );

  return {
    player: merged[0],
    mergedFrom: sources.map((s) => ({ id: s.id, name: s.name, total_games: s.total_games })),
    gamesCombined: plan.collisions.length,
    settlementsDropped: dropped.rowCount || 0
  };
}

module.exports = { planMerge, mergePlayers, loadParticipants };
