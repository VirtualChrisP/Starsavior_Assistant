import test from "node:test";
import assert from "node:assert/strict";
import roster from "../data/roster.asia-2026-09-17.json" with { type: "json" };
import knowledgeBase from "../data/knowledge-base.json" with { type: "json" };
import rules from "../data/draft-rules.asia-ranked.json" with { type: "json" };
import normalizedSkills from "../data/skills.normalized.json" with { type: "json" };
import tycharaData from "../data/tychara.characters.json" with { type: "json" };
import { createDraftState, setFirstPicker } from "../src/draft/draft-state.mjs";
import { getDraftRecommendations } from "../src/draft/recommendation-engine.mjs";

test("首轮禁用会返回三个可解释建议", () => {
  const state = createDraftState({ draftId: "recommendation-test", patch: roster.patch, region: roster.region, rules });
  const recommendations = getDraftRecommendations(state, roster, knowledgeBase, { normalizedSkills, tycharaData });
  assert.equal(recommendations.length, 3);
  assert.ok(recommendations[0].score >= recommendations[1].score);
  assert.ok(recommendations.every((item) => item.reasons.length > 0));
});

test("首选方已确定后，推荐会优先补足当前阵容功能", () => {
  let state = createDraftState({ draftId: "recommendation-pick", patch: roster.patch, region: roster.region, rules });
  state = setFirstPicker(state, "ally");
  state.stageIndex = 1;
  state.phase = "pick";
  state.allyPicks = ["lacy"];
  const recommendations = getDraftRecommendations(state, roster, knowledgeBase, { normalizedSkills, tycharaData, side: "ally" });
  assert.equal(recommendations.length, 3);
  assert.ok(recommendations.every((item) => item.rosterId !== "lacy"));
  assert.ok(recommendations.every((item) => item.reasons.length > 0));
});
test("本机对局历史会以平滑分数有限校准推荐", () => {
  const state = createDraftState({ draftId: "recommendation-history", patch: roster.patch, region: roster.region, rules });
  const options = { normalizedSkills, tycharaData, side: "ally", limit: roster.characters.length };
  const baseline = getDraftRecommendations(state, roster, knowledgeBase, options).find((item) => item.rosterId === "lacy");
  const matchHistory = {
    matches: Array.from({ length: 8 }, (_, index) => ({
      id: `history-${index}`,
      draftId: `history-draft-${index}`,
      recordedAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      patch: roster.patch,
      region: roster.region,
      mode: "ranked-arena",
      allyPicks: ["lacy"],
      enemyPicks: ["omega"],
      allyBans: [],
      enemyBans: [],
      result: { winner: "ally", status: "completed", durationSeconds: null, notes: "" }
    }))
  };
  const calibrated = getDraftRecommendations(state, roster, knowledgeBase, { ...options, matchHistory }).find((item) => item.rosterId === "lacy");
  assert.equal(calibrated.historySampleSize, 8);
  assert.ok(calibrated.score > baseline.score);
  assert.match(calibrated.reasons[0], /本机历史 8 场/);
});
