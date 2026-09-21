import test from "node:test";
import assert from "node:assert/strict";
import {
  getEquipmentModifier,
  getStatTotal,
  sanitizeOverrides,
  skillOverrideKey,
  upsertCharacterOverride
} from "../src/knowledge/character-overrides.mjs";

test("装备覆盖层会清理非法数值并保留中文技能覆盖", () => {
  const state = sanitizeOverrides({
    characters: {
      lacy: {
        equipment: { attack: 120, speed: "9", defense: "nope" },
        skills: { "lacy:basic:Strike": { nameZh: "突刺", descriptionZh: "中文描述" } }
      }
    }
  });
  assert.equal(getEquipmentModifier(state, "lacy", "attack"), 120);
  assert.equal(getEquipmentModifier(state, "lacy", "speed"), 9);
  assert.equal(getEquipmentModifier(state, "lacy", "defense"), 0);
  assert.deepEqual(state.characters.lacy.skills["lacy:basic:Strike"], { nameZh: "突刺", descriptionZh: "中文描述" });
});

test("属性总值是基础值与装备加成之和", () => {
  assert.equal(getStatTotal(3255, 120), 3375);
  assert.equal(getStatTotal(null, 12), 12);
});

test("技能覆盖键稳定且更新不会污染其他角色", () => {
  const key = skillOverrideKey("lacy", { type: "basic", name: "Strike" });
  assert.equal(key, "lacy:basic:Strike");
  const state = upsertCharacterOverride({ characters: {} }, "lacy", (current) => ({
    ...current,
    equipment: { ...current.equipment, speed: 8 }
  }));
  assert.equal(state.characters.lacy.equipment.speed, 8);
  assert.equal(state.characters.omega, undefined);
});
