import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tychara = JSON.parse(await readFile(new URL("../data/tychara.characters.json", import.meta.url), "utf8"));

test("Tychara 公开资料包含角色图像资源", () => {
  assert.equal(tychara.characters.length, 49);
  for (const character of tychara.characters) {
    assert.match(character.iconUrl, /^https:\/\/tychara\.com\//);
    assert.match(character.fullArtUrl, /^https:\/\/tychara\.com\//);
    assert.ok(Array.isArray(character.skills));
  }
});

test("Tychara 公开资料包含技能条目", () => {
  const asherah = tychara.characters.find((character) => character.slug === "asherah");
  assert.equal(asherah?.skills.length, 4);
  assert.equal(asherah?.skills.find((skill) => skill.type === "special")?.name, "Veil Cleave");
  assert.ok(tychara.characters.reduce((total, character) => total + character.skills.length, 0) >= 150);
});
