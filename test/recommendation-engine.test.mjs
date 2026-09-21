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
