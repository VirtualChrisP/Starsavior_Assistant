const CONTROL_RULES = [
  ["冻结", "freeze"],
  ["眩晕", "stun"],
  ["束缚|禁锢", "entangled-dream"],
  ["沉默", "silence"],
  ["睡眠", "sleep"],
  ["嘲讽|挑衅", "taunt"],
  ["恐惧", "fear"]
];

function skillType(type) {
  return type === "ultimate" ? "hyper" : type;
}

function targetFor(description, type) {
  if (/全体(?:敌人|目标)|所有敌人/.test(description)) return "all-enemies";
  if (/全体(?:我方|队友)|所有我方|所有队友/.test(description)) return "all-allies";
  if (/队友|我方角色/.test(description)) return "single-ally";
  if (/敌人|目标/.test(description)) return "single-enemy";
  if (type === "passive" || /自身|自己/.test(description)) return "self";
  return "unknown";
}

function addTag(tags, tag) {
  if (tag) tags.add(tag);
}

function tagsFor(description, type, target) {
  const tags = new Set();
  const active = type !== "passive";
  if (/伤害|攻击|斩击|炮击|射击|打击|爆炸|冲击/.test(description)) addTag(tags, "damage");
  if (target === "single-enemy") addTag(tags, "single-target");
  if (target === "all-enemies") addTag(tags, "area-damage");
  if (/恢复(?:自身|我方|队友)?[^。；，]*生命|生命力[^。；，]*(?:恢复|回复)|治疗/.test(description)) {
    addTag(tags, /自身/.test(description) && !/我方|队友/.test(description) ? "self-heal" : "heal");
  }
  if (/行动条/.test(description)) addTag(tags, "action-gauge");
  if (/复活/.test(description)) addTag(tags, "revive");
  if (/护盾|屏障/.test(description)) addTag(tags, "shield");
  if (/暴击/.test(description)) addTag(tags, "critical");
  if (/追加|追击|追加攻击|再次攻击|额外攻击/.test(description)) addTag(tags, "follow-up");
  if (/防御力[^。；，]*(?:降低|下降|减少)|防御[^。；，]*(?:降低|下降|减少)/.test(description)) addTag(tags, "defense-break");
  if (/效果命中/.test(description)) addTag(tags, "effect-hit");
  if (/效果抵抗/.test(description)) addTag(tags, "effect-resistance");
  if (/解除|驱散|消除/.test(description)) {
    addTag(tags, "cleanse");
    addTag(tags, "dispel");
  }
  if (/孤立/.test(description)) addTag(tags, "isolation");
  if (/冷冻/.test(description)) addTag(tags, "chill");
  for (const [pattern, tag] of CONTROL_RULES) if (new RegExp(pattern).test(description)) {
    addTag(tags, tag);
    addTag(tags, "control");
  }
  if (/增加|提升|强化|获得|赋予|提高/.test(description)) {
    addTag(tags, active && /攻击|伤害|暴击|速度|防御|生命|效果/.test(description) ? "buff" : "buff");
  }
  if (/降低|减少|下降|削弱|施加/.test(description) && /敌人|目标/.test(description)) addTag(tags, "debuff");
  return [...tags];
}

function effectsFor(description, target, tags) {
  return tags.map((tag) => ({
    type: ["control", "stun", "freeze", "entangled-dream", "silence", "sleep", "taunt", "fear"].includes(tag) ? "control" : tag,
    target,
    name: tag
  }));
}

/**
 * 将 ESPR 中文页面资料转换为推荐引擎使用的统一技能视图。
 * 这里保留原始中文描述，同时只对可从文字可靠推导的标签做关键词归类。
 */
export function normalizeEsprSkills(esprData) {
  const skills = [];
  for (const character of esprData?.characters ?? []) {
    for (const [index, skill] of (character.skills ?? []).entries()) {
      const type = skillType(skill.type);
      const descriptionZh = String(skill.descriptionZh ?? "").trim();
      const target = targetFor(descriptionZh, type);
      const tags = tagsFor(descriptionZh, type, target);
      skills.push({
        id: `espr-${character.rosterId}-${skill.type}-${index}`,
        ownerRosterId: character.rosterId,
        ownerSlug: character.slug,
        name: skill.nameZh,
        nameZh: skill.nameZh,
        type,
        target,
        cooldown: null,
        resourceCost: null,
        effects: effectsFor(descriptionZh, target, tags),
        tags,
        descriptionZh,
        iconUrl: skill.iconUrl,
        sourceUrl: character.pageUrl,
        verification: "observed-public",
        parsing: { method: "espr-zh-keywords", confidence: "parsed-medium", needsManualReview: true }
      });
    }
  }
  return { schemaVersion: 1, datasetStatus: "espr-zh-normalized", skills };
}

export function skillsForRosterId(esprSkills, rosterId) {
  return (esprSkills?.skills ?? []).filter((skill) => skill.ownerRosterId === rosterId);
}

export function tagsForRosterId(esprSkills, rosterId) {
  return new Set(skillsForRosterId(esprSkills, rosterId).flatMap((skill) => skill.tags ?? []));
}
