/**
 * 阶段 1 的知识库运行时模块。
 * 该模块只处理数据读取、结构校验和查询，不包含推荐逻辑。
 */

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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function addIssue(issues, path, message) {
  issues.push({ path, message });
}

/**
 * 对知识库做运行时校验。返回空数组表示通过。
 * @param {unknown} value
 * @returns {{path: string, message: string}[]}
 */
export function validateKnowledgeBase(value) {
  const issues = [];
  if (!isRecord(value)) {
    return [{ path: "$", message: "知识库必须是对象" }];
  }

  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    addIssue(issues, "schemaVersion", "必须是大于等于 1 的整数");
  }
  if (!isNonEmptyString(value.datasetStatus)) addIssue(issues, "datasetStatus", "不能为空");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.lastReviewed ?? "")) {
    addIssue(issues, "lastReviewed", "必须使用 YYYY-MM-DD 格式");
  }
  if (value.patch !== null && !isNonEmptyString(value.patch)) addIssue(issues, "patch", "必须是字符串或 null");
  if (value.region !== null && !isNonEmptyString(value.region)) addIssue(issues, "region", "必须是字符串或 null");
  if (!Array.isArray(value.characters)) addIssue(issues, "characters", "必须是数组");
  if (!Array.isArray(value.skills)) addIssue(issues, "skills", "必须是数组");
  if (!Array.isArray(value.effectsCatalog)) addIssue(issues, "effectsCatalog", "必须是数组");

  const characterIds = new Set();
  for (const [index, character] of (value.characters ?? []).entries()) {
    const path = `characters[${index}]`;
    if (!isRecord(character)) {
      addIssue(issues, path, "必须是对象");
      continue;
    }
    if (!ID_PATTERN.test(character.id ?? "")) addIssue(issues, `${path}.id`, "必须是小写字母、数字和短横线组成的 ID");
    if (characterIds.has(character.id)) addIssue(issues, `${path}.id`, "角色 ID 重复");
    characterIds.add(character.id);
    if (!("rosterId" in character)) addIssue(issues, `${path}.rosterId`, "必须显式提供阵容角色 ID 或 null");
    if (character.rosterId !== null && !ID_PATTERN.test(character.rosterId ?? "")) addIssue(issues, `${path}.rosterId`, "阵容角色 ID 格式无效");
    if (!isNonEmptyString(character.name)) addIssue(issues, `${path}.name`, "不能为空");
    if (!Array.isArray(character.aliases)) addIssue(issues, `${path}.aliases`, "必须是数组");
    if (!Array.isArray(character.roles)) addIssue(issues, `${path}.roles`, "必须是数组");
    if (!Array.isArray(character.tags)) addIssue(issues, `${path}.tags`, "必须是数组");
    if (!Array.isArray(character.skills)) addIssue(issues, `${path}.skills`, "必须是数组");
    if (!VERIFICATION_LEVELS.has(character.verification)) addIssue(issues, `${path}.verification`, "不是有效的可信度标记");
  }

  const skillIds = new Set();
  for (const [index, skill] of (value.skills ?? []).entries()) {
    const path = `skills[${index}]`;
    if (!isRecord(skill)) {
      addIssue(issues, path, "必须是对象");
      continue;
    }
    if (!ID_PATTERN.test(skill.id ?? "")) addIssue(issues, `${path}.id`, "必须是小写字母、数字和短横线组成的 ID");
    if (skillIds.has(skill.id)) addIssue(issues, `${path}.id`, "技能 ID 重复");
    skillIds.add(skill.id);
    if (!characterIds.has(skill.ownerId)) addIssue(issues, `${path}.ownerId`, "未引用已存在的角色");
    if (!isNonEmptyString(skill.name)) addIssue(issues, `${path}.name`, "不能为空");
    if (!isNonEmptyString(skill.type)) addIssue(issues, `${path}.type`, "不能为空");
    if (!isNonEmptyString(skill.target)) addIssue(issues, `${path}.target`, "不能为空");
    if (!Array.isArray(skill.effects)) addIssue(issues, `${path}.effects`, "必须是数组");
    if (!VERIFICATION_LEVELS.has(skill.verification)) addIssue(issues, `${path}.verification`, "不是有效的可信度标记");
  }

  for (const [index, character] of (value.characters ?? []).entries()) {
    for (const skillId of character.skills ?? []) {
      if (!skillIds.has(skillId)) addIssue(issues, `characters[${index}].skills`, `引用了不存在的技能 ${skillId}`);
    }
  }

  const effectIds = new Set();
  for (const [index, effect] of (value.effectsCatalog ?? []).entries()) {
    const path = `effectsCatalog[${index}]`;
    if (!isRecord(effect)) {
      addIssue(issues, path, "必须是对象");
      continue;
    }
    if (!ID_PATTERN.test(effect.id ?? "")) addIssue(issues, `${path}.id`, "必须是小写字母、数字和短横线组成的 ID");
    if (effectIds.has(effect.id)) addIssue(issues, `${path}.id`, "效果 ID 重复");
    effectIds.add(effect.id);
    if (!isNonEmptyString(effect.name)) addIssue(issues, `${path}.name`, "不能为空");
    if (!isNonEmptyString(effect.category)) addIssue(issues, `${path}.category`, "不能为空");
    if (!Array.isArray(effect.parameters)) addIssue(issues, `${path}.parameters`, "必须是数组");
    if (!VERIFICATION_LEVELS.has(effect.verification)) addIssue(issues, `${path}.verification`, "不是有效的可信度标记");
  }

  for (const [skillIndex, skill] of (value.skills ?? []).entries()) {
    for (const [effectIndex, effect] of (skill.effects ?? []).entries()) {
      const path = `skills[${skillIndex}].effects[${effectIndex}]`;
      if (!isRecord(effect)) {
        addIssue(issues, path, "必须是对象");
        continue;
      }
      if (!effectIds.has(effect.type)) {
        addIssue(issues, `${path}.type`, `引用了未定义的效果类型 ${effect.type}`);
      }
    }
  }

  return issues;
}

/** @param {unknown} value */
export function parseKnowledgeBase(value) {
  const issues = validateKnowledgeBase(value);
  if (issues.length > 0) {
    const message = issues.map((issue) => `${issue.path}: ${issue.message}`).join("；");
    throw new Error(`知识库校验失败：${message}`);
  }
  return value;
}

/** @param {object} knowledgeBase @param {string} id */
export function findCharacter(knowledgeBase, id) {
  return knowledgeBase.characters.find((character) => character.id === id) ?? null;
}

/** @param {object} knowledgeBase @param {string} id */
export function findSkill(knowledgeBase, id) {
  return knowledgeBase.skills.find((skill) => skill.id === id) ?? null;
}

/** @param {object} knowledgeBase @param {string} verification */
export function listCharactersByVerification(knowledgeBase, verification) {
  return knowledgeBase.characters.filter((character) => character.verification === verification);
}

/**
 * 正式推荐候选只允许使用已确认的角色；阶段 1 的种子数据会返回空数组，这是刻意的安全行为。
 * @param {object} knowledgeBase
 */
export function listRecommendationCandidates(knowledgeBase) {
  return listCharactersByVerification(knowledgeBase, "confirmed-public");
}
