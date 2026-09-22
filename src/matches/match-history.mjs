export const matchHistorySchemaVersion = 1;

const WINNERS = new Set(["ally", "enemy", "draw", "unknown"]);
const STATUSES = new Set(["completed", "surrender", "disconnect", "invalid"]);

export function createEmptyMatchHistory() {
  return { schemaVersion: matchHistorySchemaVersion, updatedAt: null, matches: [] };
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export function sanitizeMatchRecord(input) {
  if (!input || typeof input !== "object") return null;
  const winner = WINNERS.has(input.result?.winner) ? input.result.winner : "unknown";
  const status = STATUSES.has(input.result?.status) ? input.result.status : "completed";
  const rawDuration = input.result?.durationSeconds;
  const duration = rawDuration == null || rawDuration === "" ? null : Number(rawDuration);
  const draftId = typeof input.draftId === "string" && input.draftId ? input.draftId : null;
  if (!draftId) return null;
  return {
    id: typeof input.id === "string" && input.id ? input.id : `match-${draftId}`,
    draftId,
    recordedAt: typeof input.recordedAt === "string" ? input.recordedAt : new Date().toISOString(),
    patch: typeof input.patch === "string" ? input.patch : "unknown",
    region: typeof input.region === "string" ? input.region : "unknown",
    mode: typeof input.mode === "string" ? input.mode : "unknown",
    firstPicker: input.firstPicker === "ally" || input.firstPicker === "enemy" ? input.firstPicker : null,
    allyPicks: stringArray(input.allyPicks),
    enemyPicks: stringArray(input.enemyPicks),
    allyBans: stringArray(input.allyBans),
    enemyBans: stringArray(input.enemyBans),
    actions: Array.isArray(input.actions) ? structuredClone(input.actions) : [],
    characterOverrides: input.characterOverrides && typeof input.characterOverrides === "object" ? structuredClone(input.characterOverrides) : {},
    result: {
      winner,
      status,
      durationSeconds: duration != null && Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
      notes: typeof input.result?.notes === "string" ? input.result.notes.slice(0, 2000) : ""
    }
  };
}

export function sanitizeMatchHistory(input) {
  const history = createEmptyMatchHistory();
  if (!input || typeof input !== "object") return history;
  const byDraftId = new Map();
  for (const value of Array.isArray(input.matches) ? input.matches : []) {
    const record = sanitizeMatchRecord(value);
    if (record) byDraftId.set(record.draftId, record);
  }
  history.matches = [...byDraftId.values()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  history.updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : null;
  return history;
}

function relevantOverrides(overrides, ids) {
  const output = {};
  for (const id of new Set(ids)) {
    if (overrides?.characters?.[id]) output[id] = structuredClone(overrides.characters[id]);
  }
  return output;
}

export function createMatchRecord(draftState, result, overrides = { characters: {} }, now = new Date()) {
  if (!draftState?.draftId) throw new Error("无法保存缺少 draftId 的对局");
  const ids = [...draftState.allyPicks, ...draftState.enemyPicks];
  return sanitizeMatchRecord({
    id: `match-${draftState.draftId}`,
    draftId: draftState.draftId,
    recordedAt: now.toISOString(),
    patch: draftState.patch,
    region: draftState.region,
    mode: draftState.mode,
    firstPicker: draftState.firstPicker,
    allyPicks: draftState.allyPicks,
    enemyPicks: draftState.enemyPicks,
    allyBans: draftState.allyBans,
    enemyBans: draftState.enemyBans,
    actions: draftState.history,
    characterOverrides: relevantOverrides(overrides, ids),
    result
  });
}

export function upsertMatchRecord(history, record, now = new Date()) {
  const next = sanitizeMatchHistory(history);
  const clean = sanitizeMatchRecord(record);
  if (!clean) throw new Error("对局记录无效");
  const existing = next.matches.findIndex((item) => item.draftId === clean.draftId);
  if (existing >= 0) next.matches[existing] = clean;
  else next.matches.unshift(clean);
  next.matches.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  next.updatedAt = now.toISOString();
  return next;
}

export function findMatchByDraftId(history, draftId) {
  return sanitizeMatchHistory(history).matches.find((item) => item.draftId === draftId) ?? null;
}

export function getCharacterPerformance(history, rosterId, context = {}) {
  let appearances = 0;
  let points = 0;
  for (const match of sanitizeMatchHistory(history).matches) {
    if (context.patch && match.patch !== context.patch) continue;
    if (context.region && match.region !== context.region) continue;
    if (match.result.status === "invalid" || match.result.winner === "unknown") continue;
    const ally = match.allyPicks.includes(rosterId);
    const enemy = match.enemyPicks.includes(rosterId);
    if (!ally && !enemy) continue;
    appearances += 1;
    if (match.result.winner === "draw") points += 0.5;
    else if ((ally && match.result.winner === "ally") || (enemy && match.result.winner === "enemy")) points += 1;
  }
  const smoothedWinRate = (points + 2) / (appearances + 4);
  return {
    appearances,
    wins: points,
    smoothedWinRate,
    scoreAdjustment: Math.max(-10, Math.min(10, (smoothedWinRate - 0.5) * 20))
  };
}
