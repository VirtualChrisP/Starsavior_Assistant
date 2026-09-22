import test from "node:test";
import assert from "node:assert/strict";
import { createMatchRecord, getCharacterPerformance, sanitizeMatchHistory, upsertMatchRecord } from "../src/matches/match-history.mjs";

const draft = {
  draftId: "draft-1", patch: "test", region: "asia", mode: "ranked-arena", firstPicker: "ally",
  allyPicks: ["lacy", "omega"], enemyPicks: ["tanya"], allyBans: ["bell"], enemyBans: ["luna"], history: []
};

test("完整 Draft 和胜负可以生成本地对局记录", () => {
  const record = createMatchRecord(draft, { winner: "ally", status: "completed", durationSeconds: 601, notes: "测试" }, { characters: { lacy: { equipment: { speed: 12 }, skills: {} }, unused: { equipment: { speed: 1 }, skills: {} } } }, new Date("2026-09-22T00:00:00.000Z"));
  assert.equal(record.result.winner, "ally");
  assert.equal(record.result.durationSeconds, 601);
  assert.ok(record.characterOverrides.lacy);
  assert.equal(record.characterOverrides.unused, undefined);
  assert.equal(record.schemaVersion, 2);
});

test("重复保存同一 draftId 会更新而不是追加", () => {
  const first = createMatchRecord(draft, { winner: "ally", status: "completed" });
  const second = createMatchRecord(draft, { winner: "enemy", status: "surrender" });
  let history = upsertMatchRecord(null, first);
  history = upsertMatchRecord(history, second);
  assert.equal(history.matches.length, 1);
  assert.equal(history.matches[0].result.winner, "enemy");
});

test("角色历史表现使用平滑结果且忽略无效对局", () => {
  const history = sanitizeMatchHistory({ matches: [
    createMatchRecord(draft, { winner: "ally", status: "completed" }, {}, new Date("2026-09-22T01:00:00.000Z")),
    createMatchRecord({ ...draft, draftId: "draft-2" }, { winner: "enemy", status: "completed" }, {}, new Date("2026-09-22T02:00:00.000Z")),
    createMatchRecord({ ...draft, draftId: "draft-3" }, { winner: "ally", status: "invalid" }, {}, new Date("2026-09-22T03:00:00.000Z"))
  ] });
  const performance = getCharacterPerformance(history, "lacy");
  assert.equal(performance.appearances, 2);
  assert.equal(performance.smoothedWinRate, 0.5);
  assert.equal(performance.scoreAdjustment, 0);
});
test("空时长保持为空而不是被转换为零", () => {
  const record = createMatchRecord(draft, { winner: "ally", status: "completed", durationSeconds: null });
  const restored = sanitizeMatchHistory({ matches: [record] });
  assert.equal(restored.matches[0].result.durationSeconds, null);
});
test("对局记录会保留每个动作的可见状态快照", () => {
  const record = createMatchRecord({ ...draft, history: [{ type: "pick", side: "ally", rosterId: "lacy", stageIndex: 1, visibleState: { phase: "pick", stageIndex: 1, actionIndex: 2, currentSide: "ally", firstPicker: "ally", allyBans: [], enemyBans: [], allyPicks: [], enemyPicks: [], visibleActionCount: 2 } }] }, { winner: "ally", status: "completed" });
  assert.equal(record.actions[0].visibleState.phase, "pick");
  assert.equal(record.actions[0].visibleState.visibleActionCount, 2);
});
