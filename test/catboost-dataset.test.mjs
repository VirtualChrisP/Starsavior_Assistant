import test from "node:test";
import assert from "node:assert/strict";
import { createDraftState, applyDraftAction } from "../src/draft/draft-state.mjs";
import { createMatchRecord } from "../src/matches/match-history.mjs";
import { buildCatBoostDataset } from "../src/training/catboost-dataset.mjs";

const roster = { characters: [
  { id: "lacy" }, { id: "omega" }, { id: "charlotte-monastir-knights" }, { id: "asherah-voyager-savior-party" }
] };
const rules = {
  id: "dataset-rules", mode: "ranked-arena", strictTurnOrder: true, allowDuplicateAcrossSides: false,
  teamSize: 2, banLimit: 1,
  turnOrder: [
    { type: "ban", side: "enemy" },
    { type: "ban", side: "ally" },
    { type: "pick", side: "ally" },
    { type: "pick", side: "enemy" }
  ]
};

test("CatBoost 生成器输出动作前特征、标签和列描述", () => {
  let state = createDraftState({ draftId: "dataset-draft", patch: "test-patch", region: "asia", rules });
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "lacy" }, roster);
  state = applyDraftAction(state, { type: "ban", side: "ally", rosterId: "omega" }, roster);
  const record = createMatchRecord(state, { winner: "ally", status: "completed" });
  const dataset = buildCatBoostDataset({ matches: [record] }, { patch: "test-patch", region: "asia" });
  assert.equal(dataset.summary.matchesUsed, 1);
  assert.equal(dataset.summary.rows, 2);
  assert.equal(dataset.rows[0].label, 1);
  assert.equal(dataset.rows[0].action_roster_id, "lacy");
  assert.match(dataset.tsv, /draft_id.*label/);
  assert.match(dataset.columnDescription, /0\tGroupId/);
  assert.match(dataset.columnDescription, /20\tLabel/);
});

test("CatBoost 生成器默认跳过未知、无效和没有快照的样本", () => {
  const dataset = buildCatBoostDataset({ matches: [
    { draftId: "unknown", result: { winner: "unknown", status: "completed" }, actions: [] },
    { draftId: "invalid", result: { winner: "ally", status: "invalid" }, actions: [] },
    { draftId: "legacy", result: { winner: "ally", status: "completed" }, actions: [{ type: "pick", side: "ally", rosterId: "lacy" }] }
  ] });
  assert.equal(dataset.summary.rows, 0);
  assert.equal(dataset.summary.skippedMatches, 2);
  assert.equal(dataset.summary.skippedActions, 1);
});
