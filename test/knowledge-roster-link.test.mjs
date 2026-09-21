import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { findRosterCharacter } from "../src/knowledge/roster.mjs";

const knowledgeBase = JSON.parse(await readFile(new URL("../data/knowledge-base.json", import.meta.url), "utf8"));
const roster = JSON.parse(await readFile(new URL("../data/roster.asia-2026-09-17.json", import.meta.url), "utf8"));

test("知识库角色的非空 rosterId 都能关联当前阵容", () => {
  for (const character of knowledgeBase.characters) {
    if (character.rosterId !== null) {
      assert.ok(findRosterCharacter(roster, character.rosterId), `${character.id} 的 rosterId 无法解析`);
    }
  }
});

test("同名角色技能明确绑定到正确版本", () => {
  const charlotte = knowledgeBase.characters.find((character) => character.id === "charlotte");
  const claire = knowledgeBase.characters.find((character) => character.id === "claire");
  assert.equal(charlotte?.rosterId, "charlotte-monastir-knights");
  assert.equal(claire?.rosterId, "claire-candle-square");
});
