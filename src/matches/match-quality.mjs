import { sanitizeMatchHistory, sanitizeMatchRecord } from "./match-history.mjs";

function issue(code, severity, message, count = 1) {
  return { code, severity, message, count };
}

/**
 * 检查本地对局是否适合用于推荐校准和 CatBoost 训练。
 * 质量检查不删除数据，只返回问题和可训练样本范围。
 */
export function inspectMatchHistory(input, options = {}) {
  const rawMatches = Array.isArray(input?.matches) ? input.matches : Array.isArray(input) ? input : [];
  const history = sanitizeMatchHistory(input);
  const issues = [];
  const draftIds = new Set();
  let duplicateDrafts = 0;
  let malformed = 0;
  let resultKnown = 0;
  let snapshotMatches = 0;
  let completeDrafts = 0;
  let patchMismatch = 0;
  let regionMismatch = 0;
  for (const raw of rawMatches) {
    if (!sanitizeMatchRecord(raw)) {
      malformed += 1;
      continue;
    }
    if (draftIds.has(raw.draftId)) duplicateDrafts += 1;
    draftIds.add(raw.draftId);
  }
  for (const record of history.matches) {
    const hasKnownResult = (record.result.winner === "ally" || record.result.winner === "enemy") && record.result.status !== "invalid";
    if (hasKnownResult) resultKnown += 1;
    if (record.actions.some((action) => action.visibleState)) snapshotMatches += 1;
    if (record.allyPicks.length === (options.teamSize ?? 5) && record.enemyPicks.length === (options.teamSize ?? 5)) completeDrafts += 1;
    if (options.patch && record.patch !== options.patch) patchMismatch += 1;
    if (options.region && record.region !== options.region) regionMismatch += 1;
  }
  if (malformed) issues.push(issue("MALFORMED_RECORD", "error", `${malformed} 条记录无法解析，导入或训练时会被丢弃`, malformed));
  if (duplicateDrafts) issues.push(issue("DUPLICATE_DRAFT_ID", "warning", `${duplicateDrafts} 条记录使用了重复 draftId，系统会以最新记录为准`, duplicateDrafts));
  if (history.matches.length - resultKnown) issues.push(issue("UNKNOWN_RESULT", "warning", `${history.matches.length - resultKnown} 条记录没有明确的我方/对方胜负`, history.matches.length - resultKnown));
  if (history.matches.length - snapshotMatches) issues.push(issue("MISSING_SNAPSHOT", "error", `${history.matches.length - snapshotMatches} 条记录没有可用于训练的 BP 状态快照`, history.matches.length - snapshotMatches));
  if (history.matches.length - completeDrafts) issues.push(issue("INCOMPLETE_DRAFT", "warning", `${history.matches.length - completeDrafts} 条记录不是双方各 5 人的完整阵容`, history.matches.length - completeDrafts));
  if (patchMismatch) issues.push(issue("PATCH_MISMATCH", "warning", `${patchMismatch} 条记录版本与当前筛选版本不一致`, patchMismatch));
  if (regionMismatch) issues.push(issue("REGION_MISMATCH", "warning", `${regionMismatch} 条记录服务器与当前筛选服务器不一致`, regionMismatch));
  const trainingEligible = history.matches.filter((record) => {
    if (!(record.result.winner === "ally" || record.result.winner === "enemy")) return false;
    if (record.result.status === "invalid") return false;
    if (!record.actions.some((action) => action.visibleState)) return false;
    if (options.patch && record.patch !== options.patch) return false;
    if (options.region && record.region !== options.region) return false;
    return true;
  });
  return {
    schemaVersion: 1,
    recordsRead: rawMatches.length,
    recordsKept: history.matches.length,
    resultKnown,
    snapshotMatches,
    completeDrafts,
    trainingEligible: trainingEligible.length,
    trainingEligibleDraftIds: trainingEligible.map((record) => record.draftId),
    issues,
    history
  };
}
