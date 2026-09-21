import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDraftState, setFirstPicker, applyDraftAction, undoDraftAction, getLegalDraftActions, getDraftProgress } from "../src/draft/draft-state.mjs";
import { getDraftCandidates, summarizeDraftRisks } from "../src/draft/rule-engine.mjs";

const roster = JSON.parse(await readFile(new URL("../data/roster.asia-2026-09-17.json", import.meta.url), "utf8"));
const knowledgeBase = JSON.parse(await readFile(new URL("../data/knowledge-base.json", import.meta.url), "utf8"));
const rules = {
  id: "test-rules",
  mode: "ranked-arena",
  strictTurnOrder: true,
  allowDuplicateAcrossSides: false,
  teamSize: 3,
  banLimit: 1,
  turnOrder: [
    { type: "ban", side: "enemy" },
    { type: "ban", side: "ally" },
    { type: "pick", side: "ally" },
    { type: "pick", side: "enemy" }
  ]
};

const asiaRules = JSON.parse(await readFile(new URL("../data/draft-rules.asia-ranked.json", import.meta.url), "utf8"));

test("严格规则可以推进 Ban/Pick 状态", () => {
  let state = createDraftState({ draftId: "test-1", patch: roster.patch, region: "asia", rules });
  assert.equal(getLegalDraftActions(state, roster).length, 55);
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "lacy" }, roster);
  assert.deepEqual(state.enemyBans, ["lacy"]);
  assert.equal(state.phase, "ban");
  assert.equal(state.currentSide, "ally");
  assert.throws(() => applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "omega" }, roster), /当前应执行 ally 的 ban/);
});

test("已 Ban 或 Pick 的角色不能再次选择", () => {
  let state = createDraftState({ draftId: "test-2", patch: roster.patch, region: "asia", rules });
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "lacy" }, roster);
  state = applyDraftAction(state, { type: "ban", side: "ally", rosterId: "omega" }, roster);
  state = applyDraftAction(state, { type: "pick", side: "ally", rosterId: "charlotte-monastir-knights" }, roster);
  assert.throws(() => applyDraftAction(state, { type: "pick", side: "enemy", rosterId: "charlotte-monastir-knights" }, roster), /角色已经被 Pick/);
});

test("可以撤销最后一个 Draft 动作", () => {
  let state = createDraftState({ draftId: "test-3", patch: roster.patch, region: "asia", rules });
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "lacy" }, roster);
  state = undoDraftAction(state);
  assert.deepEqual(state.enemyBans, []);
  assert.equal(state.history.length, 0);
  assert.equal(state.actionIndex, 0);
});

test("规则引擎会返回角色资料和技能完整度", () => {
  const looseRules = { ...rules, strictTurnOrder: false, teamSize: null, banLimit: null };
  let state = createDraftState({ draftId: "test-4", patch: roster.patch, region: "asia", rules: looseRules, currentSide: "ally", phase: "pick" });
  const candidates = getDraftCandidates(state, roster, knowledgeBase);
  const omega = candidates.find((candidate) => candidate.rosterId === "omega");
  assert.equal(omega?.usableForSimulation, true);
  assert.equal(candidates.find((candidate) => candidate.rosterId === "professor-m")?.dataCompleteness, "metadata-only");
  assert.deepEqual(getDraftProgress(state).pickCount, 0);
  assert.ok(summarizeDraftRisks(state, roster, knowledgeBase).some((risk) => risk.code === "TEAM_SIZE_UNCONFIRMED"));
});

test("亚服阶段规则支持同时首轮禁用和随机首选方", () => {
  let state = createDraftState({ draftId: "asia-flow", patch: roster.patch, region: "asia", rules: asiaRules });
  state = setFirstPicker(state, "ally");
  assert.equal(getLegalDraftActions(state, roster).length, 110);
  state = applyDraftAction(state, { type: "ban", side: "ally", rosterId: "lacy" }, roster);
  assert.equal(state.stageIndex, 0);
  assert.throws(() => applyDraftAction(state, { type: "ban", side: "ally", rosterId: "omega" }, roster), /已完成当前阶段动作/);
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "omega" }, roster);
  assert.equal(state.stageIndex, 1);
  assert.equal(state.currentSide, "ally");

  state = applyDraftAction(state, { type: "pick", side: "ally", rosterId: "charlotte-monastir-knights" }, roster);
  assert.equal(state.stageIndex, 2);
  assert.equal(state.currentSide, "enemy");
  state = applyDraftAction(state, { type: "pick", side: "enemy", rosterId: "tanya" }, roster);
  state = applyDraftAction(state, { type: "pick", side: "enemy", rosterId: "bell" }, roster);
  assert.equal(state.stageIndex, 3);
  assert.equal(state.currentSide, "ally");
});

test("亚服末轮禁用只能选择对方已选角色", () => {
  let state = createDraftState({ draftId: "asia-closing-ban", patch: roster.patch, region: "asia", rules: asiaRules, firstPicker: "ally" });
  const picks = [
    ["ally", "lacy"], ["enemy", "omega"], ["enemy", "tanya"],
    ["ally", "charlotte-monastir-knights"], ["ally", "bell"],
    ["enemy", "claire-candle-square"], ["enemy", "scarlet-candle-square"],
    ["ally", "asherah-voyager-savior-party"], ["ally", "smile-voyager-savior-party"],
    ["enemy", "luna-voyager-savior-party"]
  ];
  state = applyDraftAction(state, { type: "ban", side: "ally", rosterId: "lyn" }, roster);
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "seira" }, roster);
  for (const [side, rosterId] of picks) state = applyDraftAction(state, { type: "pick", side, rosterId }, roster);
  assert.equal(state.stageIndex, 7);
  assert.throws(() => applyDraftAction(state, { type: "ban", side: "ally", rosterId: "roberta" }, roster), /只能禁用对方已选择/);
  state = applyDraftAction(state, { type: "ban", side: "ally", rosterId: "luna-voyager-savior-party" }, roster);
  state = applyDraftAction(state, { type: "ban", side: "enemy", rosterId: "smile-voyager-savior-party" }, roster);
  assert.equal(getDraftProgress(state).complete, true);
});
