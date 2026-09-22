import test from "node:test";
import assert from "node:assert/strict";
import esprData from "../data/espr.characters.zh-CN.json" with { type: "json" };
import roster from "../data/roster.asia-2026-09-17.json" with { type: "json" };
import knowledgeBase from "../data/knowledge-base.json" with { type: "json" };
import rules from "../data/draft-rules.asia-ranked.json" with { type: "json" };
import { normalizeEsprSkills, skillsForRosterId, tagsForRosterId } from "../src/draft/espr-skill-adapter.mjs";
import { createDraftState } from "../src/draft/draft-state.mjs";
import { getDraftCandidates } from "../src/draft/rule-engine.mjs";
import { getDraftRecommendations } from "../src/draft/recommendation-engine.mjs";

const normalized = normalizeEsprSkills(esprData);

test("ESPR 中文技能会被标准化为 55 名角色的推荐数据", () => {
  assert.equal(esprData.characters.length, roster.characters.length);
  assert.equal(normalized.skills.length, 220);
  for (const character of roster.characters) {
    assert.equal(skillsForRosterId(normalized, character.id).length, 4, character.id);
  }
  assert.ok(tagsForRosterId(normalized, "asherah-voyager-savior-party").has("damage"));
  assert.ok([...tagsForRosterId(normalized, "smile-voyager-savior-party")].length > 0);
});

test("推荐候选优先使用 ESPR 中文技能判断资料完整度", () => {
  const state = createDraftState({ draftId: "espr-recommendation", patch: roster.patch, region: roster.region, rules });
  const candidates = getDraftCandidates(state, roster, knowledgeBase, { esprData });
  assert.equal(new Set(candidates.map((candidate) => candidate.rosterId)).size, roster.characters.length);
  assert.ok(candidates.every((candidate) => candidate.usableForSimulation));
  assert.ok(candidates.some((candidate) => candidate.dataCompleteness === "full-espr-zh-public"));

  const recommendations = getDraftRecommendations(state, roster, knowledgeBase, { esprData, side: "ally" });
  assert.equal(recommendations.length, 3);
  assert.ok(recommendations.every((item) => item.risk === null));
});
