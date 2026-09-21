export const overrideSchemaVersion = 1;

export const editorStatKeys = [
  "hp",
  "vitality",
  "attack",
  "defense",
  "speed",
  "criticalHitRate",
  "criticalDamage",
  "effectHit",
  "effectResistance",
  "hitRate"
];

export const editorStatLabels = {
  hp: "生命",
  vitality: "生命（知识库）",
  attack: "攻击",
  defense: "防御",
  speed: "速度",
  criticalHitRate: "暴击率",
  criticalDamage: "暴击伤害",
  effectHit: "效果命中",
  effectResistance: "效果抵抗",
  hitRate: "命中率"
};

export function createEmptyOverrides() {
  return { schemaVersion: overrideSchemaVersion, updatedAt: null, characters: {} };
}

export function sanitizeOverrides(input) {
  const output = createEmptyOverrides();
  if (!input || typeof input !== "object") return output;
  output.updatedAt = typeof input.updatedAt === "string" ? input.updatedAt : null;
  const characters = input.characters && typeof input.characters === "object" ? input.characters : {};
  for (const [characterId, value] of Object.entries(characters)) {
    if (!value || typeof value !== "object") continue;
    const equipmentInput = value.equipment && typeof value.equipment === "object" ? value.equipment : {};
    const equipment = {};
    for (const key of editorStatKeys) {
      const number = Number(equipmentInput[key]);
      if (Number.isFinite(number)) equipment[key] = number;
    }
    const skillsInput = value.skills && typeof value.skills === "object" ? value.skills : {};
    const skills = {};
    for (const [skillKey, skillValue] of Object.entries(skillsInput)) {
      if (!skillValue || typeof skillValue !== "object") continue;
      skills[skillKey] = {
        nameZh: typeof skillValue.nameZh === "string" ? skillValue.nameZh : "",
        descriptionZh: typeof skillValue.descriptionZh === "string" ? skillValue.descriptionZh : ""
      };
    }
    if (Object.keys(equipment).length || Object.keys(skills).length) output.characters[characterId] = { equipment, skills };
  }
  return output;
}

export function getCharacterOverride(overrides, characterId) {
  return overrides?.characters?.[characterId] ?? { equipment: {}, skills: {} };
}

export function getEquipmentModifier(overrides, characterId, statKey) {
  const value = Number(getCharacterOverride(overrides, characterId).equipment?.[statKey]);
  return Number.isFinite(value) ? value : 0;
}

export function getStatTotal(baseValue, modifier) {
  const base = Number(baseValue);
  const add = Number(modifier);
  return (Number.isFinite(base) ? base : 0) + (Number.isFinite(add) ? add : 0);
}

export function skillOverrideKey(ownerSlug, skill) {
  return `${ownerSlug}:${skill.type}:${skill.name}`;
}

export function upsertCharacterOverride(overrides, characterId, updater) {
  const next = sanitizeOverrides(overrides);
  const current = getCharacterOverride(next, characterId);
  next.characters[characterId] = updater({ equipment: { ...current.equipment }, skills: { ...current.skills } });
  next.updatedAt = new Date().toISOString();
  return sanitizeOverrides(next);
}
