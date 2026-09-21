import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseKnowledgeBase, validateKnowledgeBase, findCharacter, findSkill, listRecommendationCandidates } from "../src/knowledge/knowledge-base.mjs";

const knowledgeBase = JSON.parse(await readFile(new URL("../data/knowledge-base.json", import.meta.url), "utf8"));

test("阶段 1 知识库可以通过结构校验", () => {
  assert.deepEqual(validateKnowledgeBase(knowledgeBase), []);
  assert.doesNotThrow(() => parseKnowledgeBase(knowledgeBase));
});

test("可以按 ID 查询角色", () => {
  assert.equal(findCharacter(knowledgeBase, "lacy")?.name, "Lacy");
  assert.equal(findCharacter(knowledgeBase, "missing"), null);
});

test("公开角色和技能数据已经建立双向引用", () => {
  const claire = findCharacter(knowledgeBase, "claire");
  assert.equal(claire?.dataCompleteness, "full-public-page");
  assert.equal(claire?.skills.length, 4);
  assert.equal(findSkill(knowledgeBase, "claire-hyper")?.cooldown, 4);
});

test("未确认角色不会进入正式推荐候选", () => {
  assert.deepEqual(listRecommendationCandidates(knowledgeBase), []);
});

test("技能必须引用已存在的角色", () => {
  const invalid = {
    ...knowledgeBase,
    skills: [{
      id: "skill-demo",
      ownerId: "missing-character",
      name: "测试技能",
      type: "active",
      target: "enemy",
      effects: [],
      verification: "assumption"
    }]
  };
  assert.throws(() => parseKnowledgeBase(invalid), /未引用已存在的角色/);
});

test("技能效果类型必须在效果目录中定义", () => {
  const invalid = structuredClone(knowledgeBase);
  invalid.skills[0].effects.push({ type: "undefined-effect" });
  assert.throws(() => parseKnowledgeBase(invalid), /引用了未定义的效果类型/);
});
