const VALID_WINNERS = new Set(["ally", "enemy"]);

export const trainingSchemaVersion = 1;

const columns = [
  ["draft_id", "GroupId"],
  ["patch", "Categ"],
  ["region", "Categ"],
  ["mode", "Categ"],
  ["first_picker", "Categ"],
  ["phase", "Categ"],
  ["stage_index", "Num"],
  ["action_index", "Num"],
  ["action_type", "Categ"],
  ["action_side", "Categ"],
  ["action_roster_id", "Categ"],
  ["visible_action_count", "Num"],
  ["ally_pick_count", "Num"],
  ["enemy_pick_count", "Num"],
  ["ally_ban_count", "Num"],
  ["enemy_ban_count", "Num"],
  ["visible_ally_picks", "Categ"],
  ["visible_enemy_picks", "Categ"],
  ["visible_ally_bans", "Categ"],
  ["visible_enemy_bans", "Categ"],
  ["label", "Label"]
];

function cleanList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
}

function listValue(value) {
  return cleanList(value).join("|") || "<empty>";
}

function escapeTsv(value) {
  return String(value ?? "").replace(/[\t\r\n]/g, " ");
}

function validRecord(record, options) {
  if (!record || typeof record !== "object") return false;
  if (!VALID_WINNERS.has(record.result?.winner)) return false;
  if (record.result?.status === "invalid") return false;
  if (options.patch && record.patch !== options.patch) return false;
  if (options.region && record.region !== options.region) return false;
  return true;
}

function actionRow(record, action, label) {
  const snapshot = action.visibleState;
  if (!snapshot) return null;
  const allyPicks = cleanList(snapshot.allyPicks);
  const enemyPicks = cleanList(snapshot.enemyPicks);
  const allyBans = cleanList(snapshot.allyBans);
  const enemyBans = cleanList(snapshot.enemyBans);
  return {
    draft_id: record.draftId,
    patch: record.patch,
    region: record.region,
    mode: record.mode,
    first_picker: snapshot.firstPicker ?? record.firstPicker ?? "unknown",
    phase: snapshot.phase,
    stage_index: snapshot.stageIndex,
    action_index: snapshot.actionIndex,
    action_type: action.type,
    action_side: action.side,
    action_roster_id: action.rosterId,
    visible_action_count: snapshot.visibleActionCount,
    ally_pick_count: allyPicks.length,
    enemy_pick_count: enemyPicks.length,
    ally_ban_count: allyBans.length,
    enemy_ban_count: enemyBans.length,
    visible_ally_picks: listValue(allyPicks),
    visible_enemy_picks: listValue(enemyPicks),
    visible_ally_bans: listValue(allyBans),
    visible_enemy_bans: listValue(enemyBans),
    label
  };
}

export function getCatBoostColumns() {
  return columns.map(([name, type]) => ({ name, type }));
}

export function buildCatBoostDataset(input, options = {}) {
  const matches = Array.isArray(input) ? input : input?.matches;
  const rows = [];
  let skippedMatches = 0;
  let skippedActions = 0;
  for (const record of Array.isArray(matches) ? matches : []) {
    if (!validRecord(record, options)) {
      skippedMatches += 1;
      continue;
    }
    const label = record.result.winner === "ally" ? 1 : 0;
    for (const action of Array.isArray(record.actions) ? record.actions : []) {
      const row = actionRow(record, action, label);
      if (row) rows.push(row);
      else skippedActions += 1;
    }
  }
  const header = columns.map(([name]) => name);
  const tsv = [header, ...rows.map((row) => columns.map(([name]) => escapeTsv(row[name])))]
    .map((line) => line.join("\t"))
    .join("\n") + "\n";
  const columnDescription = columns.map(([, type], index) => `${index}\t${type}`).join("\n") + "\n";
  return {
    schemaVersion: trainingSchemaVersion,
    rows,
    tsv,
    columnDescription,
    summary: {
      matchesRead: Array.isArray(matches) ? matches.length : 0,
      matchesUsed: new Set(rows.map((row) => row.draft_id)).size,
      rows: rows.length,
      positiveRows: rows.filter((row) => row.label === 1).length,
      negativeRows: rows.filter((row) => row.label === 0).length,
      skippedMatches,
      skippedActions
    }
  };
}
