const VERIFICATION_LEVELS = new Set([
  "confirmed-public",
  "observed-public",
  "assumption",
  "unknown"
]);

const ID_PATTERN = /^[a-z0-9-]+$/;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value */
export function validateRosterSnapshot(value) {
  const issues = [];
  const add = (path, message) => issues.push({ path, message });
  if (!isRecord(value)) return [{ path: "$", message: "阵容快照必须是对象" }];
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) add("schemaVersion", "必须是大于等于 1 的整数");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.snapshotDate ?? "")) add("snapshotDate", "必须使用 YYYY-MM-DD 格式");
  if (typeof value.patch !== "string" || value.patch.length === 0) add("patch", "不能为空");
  if (typeof value.region !== "string" || value.region.length === 0) add("region", "不能为空");
  if (!Array.isArray(value.characters)) {
    add("characters", "必须是数组");
    return issues;
  }

  const ids = new Set();
  const statKeys = ["hp", "attack", "defense", "speed", "criticalHitRate", "criticalDamage", "effectHit", "effectResistance"];
  for (const [index, character] of value.characters.entries()) {
    const path = `characters[${index}]`;
    if (!isRecord(character)) {
      add(path, "必须是对象");
      continue;
    }
    if (!ID_PATTERN.test(character.id ?? "")) add(`${path}.id`, "ID 格式无效");
    if (ids.has(character.id)) add(`${path}.id`, "角色 ID 重复");
    ids.add(character.id);
    for (const field of ["name", "title", "rarity", "element", "class"]) {
      if (typeof character[field] !== "string") add(`${path}.${field}`, "必须是字符串");
    }
    if (!VERIFICATION_LEVELS.has(character.verification)) add(`${path}.verification`, "可信度标记无效");
    if (!isRecord(character.stats)) {
      add(`${path}.stats`, "必须是对象");
      continue;
    }
    for (const key of statKeys) {
      if (typeof character.stats[key] !== "number" || !Number.isFinite(character.stats[key])) {
        add(`${path}.stats.${key}`, "必须是有限数值");
      }
    }
  }

  if (Number.isInteger(value.source?.sourceCount) && value.source.sourceCount !== value.characters.length) {
    add("source.sourceCount", `来源数量 ${value.source.sourceCount} 与实际角色数量 ${value.characters.length} 不一致`);
  }
  return issues;
}

/** @param {unknown} value */
export function parseRosterSnapshot(value) {
  const issues = validateRosterSnapshot(value);
  if (issues.length > 0) {
    throw new Error(`阵容快照校验失败：${issues.map((issue) => `${issue.path}: ${issue.message}`).join("；")}`);
  }
  return value;
}

/** @param {object} roster @param {string} id */
export function findRosterCharacter(roster, id) {
  return roster.characters.find((character) => character.id === id) ?? null;
}

/** @param {object} roster @param {string} name */
export function findRosterVariants(roster, name) {
  return roster.characters.filter((character) => character.name.toLowerCase() === name.toLowerCase());
}
