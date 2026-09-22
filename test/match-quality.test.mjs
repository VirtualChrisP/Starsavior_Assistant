import test from "node:test";
import assert from "node:assert/strict";
import { createMatchRecord, mergeMatchHistories } from "../src/matches/match-history.mjs";
import { inspectMatchHistory } from "../src/matches/match-quality.mjs";

const draft = {
  draftId: "quality-draft", patch: "test-patch", region: "asia", mode: "ranked-arena", firstPicker: "ally",
  allyPicks: ["a", "b", "c", "d", "e"], enemyPicks: ["f", "g", "h", "i", "j"], allyBans: [], enemyBans: [],
  history: [{ type: "pick", side: "ally", rosterId: "a", stageIndex: 1, visibleState: { phase: "pick", stageIndex: 1, actionIndex: 0, currentSide: "ally", firstPicker: "ally", allyBans: [], enemyBans: [], allyPicks: [], enemyPicks: [], visibleActionCount: 0 } }]
};

test("对局质量检查能识别训练可用记录和缺失快照", () => {
  const complete = createMatchRecord(draft, { winner: "ally", status: "completed" });
  const unknown = createMatchRecord({ ...draft, draftId: "quality-unknown", history: [] }, { winner: "unknown", status: "completed" });
  const report = inspectMatchHistory({ matches: [complete, unknown] }, { patch: "test-patch", region: "asia" });
  assert.equal(report.recordsKept, 2);
  assert.equal(report.trainingEligible, 1);
  assert.equal(report.snapshotMatches, 1);
  assert.ok(report.issues.some((item) => item.code === "UNKNOWN_RESULT"));
  assert.ok(report.issues.some((item) => item.code === "MISSING_SNAPSHOT"));
});

test("导入历史会按 draftId 合并并保留最新记录", () => {
  const first = createMatchRecord(draft, { winner: "ally", status: "completed" });
  const updated = createMatchRecord(draft, { winner: "enemy", status: "surrender" });
  const merged = mergeMatchHistories({ matches: [first] }, { matches: [updated] });
  assert.equal(merged.matches.length, 1);
  assert.equal(merged.matches[0].result.winner, "enemy");
});
