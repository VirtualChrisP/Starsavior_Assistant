import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseRosterSnapshot, validateRosterSnapshot, findRosterCharacter, findRosterVariants } from "../src/knowledge/roster.mjs";

const roster = JSON.parse(await readFile(new URL("../data/roster.asia-2026-09-17.json", import.meta.url), "utf8"));

test("亚服公开阵容快照包含 55 名角色", () => {
  assert.deepEqual(validateRosterSnapshot(roster), []);
  assert.doesNotThrow(() => parseRosterSnapshot(roster));
  assert.equal(roster.characters.length, 55);
});

test("同名不同版本角色使用独立 ID", () => {
  const variants = findRosterVariants(roster, "Charlotte");
  assert.equal(variants.length, 2);
  assert.notEqual(variants[0].id, variants[1].id);
});

test("可以查询 9 月新增角色", () => {
  assert.equal(findRosterCharacter(roster, "professor-m")?.class, "ranger");
  assert.equal(findRosterCharacter(roster, "gwen")?.element, "star");
});

test("来源数量必须与实际角色数量一致", () => {
  const invalid = structuredClone(roster);
  invalid.source.sourceCount = 54;
  assert.throws(() => parseRosterSnapshot(invalid), /来源数量/);
});
