import { getDraftCandidates } from "./rule-engine.mjs";
import { getEquipmentModifier, getStatTotal } from "../knowledge/character-overrides.mjs";
import { getCharacterPerformance } from "../matches/match-history.mjs";

const CONTROL_TAGS = new Set(["control", "stun", "freeze", "entangled-dream", "isolation", "chill"]);
const DAMAGE_TAGS = new Set(["damage", "single-target", "area-damage", "critical", "follow-up"]);
const SUPPORT_TAGS = new Set(["heal", "self-heal", "team-buff", "buff", "action-gauge", "revive", "cleanse", "dispel"]);
const COUNTER_TAGS = new Set(["cleanse", "dispel", "effect-resistance", "effect-hit", "defense-break", "toughness-break"]);

const slugOverrides = {
  "asherah-voyager-savior-party": "asherah", "asherah-waltz-of-starlight": "asherahwaltzofstarlight",
  "smile-voyager-savior-party": "smile", "smile-sunshine-cat": "smile", "luna-voyager-savior-party": "luna", "luna-white-pearl-trap": "luna",
  bell: "bellrhys", emily: "emilly", "charlotte-monastir-knights": "charlotte", "charlotte-heart-of-monastir": "charlotte",
  "claire-candle-square": "claire", "claire-flawless-blue-rose": "claire", "scarlet-candle-square": "scarlet", "scarlet-little-tyrant": "scarlet",
  "carmen-monastir-knights": "carmen", "carmen-eternal-promise": "carmeneternalpromise", "frey-monastir-knights": "frey", "frey-noble-princess": "freynobleprincess",
  "epindel-house-orlan": "epindel", "epindel-blessing-in-bloom": "epindelblessinginbloom"
};

function slugFor(character) {
  return slugOverrides[character.id] ?? character.name.toLowerCase().replace(/[^a-z]+/g, "");
}

function getPublicSkills(character, tycharaData) {
  const slug = slugFor(character);
  return tycharaData?.characters?.find((item) => item.slug === slug)?.skills ?? [];
}

function tagsFor(candidate, normalizedSkills, tycharaData) {
  const tags = new Set(candidate.knowledgeCharacter?.tags ?? []);
  const slug = slugFor(candidate.rosterCharacter);
  for (const skill of normalizedSkills?.skills ?? []) {
    if (skill.ownerSlug !== slug) continue;
    for (const tag of skill.tags ?? []) tags.add(tag);
  }
  if (getPublicSkills(candidate.rosterCharacter, tycharaData).length > 0) tags.add("public-skills");
  return tags;
}

function scoreStat(candidate, key, overrides) {
  const base = candidate.rosterCharacter?.stats?.[key] ?? candidate.knowledgeCharacter?.stats?.[key];
  if (base == null) return null;
  return getStatTotal(base, getEquipmentModifier(overrides, candidate.rosterId, key));
}

function threatScore(tags, candidate, overrides) {
  let score = 0;
  for (const tag of tags) {
    if (CONTROL_TAGS.has(tag)) score += 10;
    if (DAMAGE_TAGS.has(tag)) score += 8;
    if (SUPPORT_TAGS.has(tag)) score += 5;
  }
  const speed = scoreStat(candidate, "speed", overrides);
  const attack = scoreStat(candidate, "attack", overrides);
  if (speed != null) score += Math.min(12, speed / 20);
  if (attack != null) score += Math.min(10, attack / 400);
  if (candidate.usableForSimulation) score += 6;
  return score;
}

function intersectionCount(left, right) {
  let count = 0;
  for (const value of left) if (right.has(value)) count += 1;
  return count;
}

function roleLabel(tags) {
  if ([...tags].some((tag) => CONTROL_TAGS.has(tag))) return "控制";
  if ([...tags].some((tag) => DAMAGE_TAGS.has(tag))) return "输出";
  if ([...tags].some((tag) => SUPPORT_TAGS.has(tag))) return "支援";
  return "功能";
}

function stageId(state) {
  return state.rules?.turnStages?.[state.stageIndex]?.id ?? state.phase;
}

/**
 * 返回当前阶段面向一个操作方的前三个建议。
 * 评分只表达“当前信息下的规则优先级”，不是胜率预测。
 */
export function getDraftRecommendations(state, roster, knowledgeBase, options = {}) {
  const candidates = getDraftCandidates(state, roster, knowledgeBase);
  const side = options.side ?? state.currentSide ?? candidates[0]?.side ?? "ally";
  const filtered = candidates.filter((candidate) => candidate.side === side);
  const normalizedSkills = options.normalizedSkills;
  const tycharaData = options.tycharaData;
  const overrides = options.overrides ?? { characters: {} };
  const matchHistory = options.matchHistory ?? { matches: [] };
  const ownPicks = side === "ally" ? state.allyPicks : state.enemyPicks;
  const opponentPicks = side === "ally" ? state.enemyPicks : state.allyPicks;
  const ownTags = new Set(ownPicks.flatMap((id) => {
    const item = roster.characters.find((character) => character.id === id);
    const data = knowledgeBase.characters.find((character) => character.rosterId === id);
    return [...(data?.tags ?? []), ...(normalizedSkills?.skills ?? []).filter((skill) => skill.ownerSlug === slugFor(item ?? { id, name: "" })).flatMap((skill) => skill.tags ?? [])];
  }));
  const opponentTags = new Set(opponentPicks.flatMap((id) => {
    const item = roster.characters.find((character) => character.id === id);
    const data = knowledgeBase.characters.find((character) => character.rosterId === id);
    return [...(data?.tags ?? []), ...(normalizedSkills?.skills ?? []).filter((skill) => skill.ownerSlug === slugFor(item ?? { id, name: "" })).flatMap((skill) => skill.tags ?? [])];
  }));
  const stage = stageId(state);
  const isBan = state.phase === "ban";
  const results = filtered.map((candidate) => {
    const tags = tagsFor(candidate, normalizedSkills, tycharaData);
    const reasons = [];
    let score = 40;
    const threat = threatScore(tags, candidate, overrides);
    if (isBan) {
      score += threat;
      reasons.push(`威胁评分 ${Math.round(threat)}：${roleLabel(tags)}能力更值得优先处理`);
      if (stage === "closing-ban") reasons.push("末轮禁用只能从对方已选角色中选择");
    } else {
      const missingControl = !tagsHaveAny(ownTags, CONTROL_TAGS);
      const missingDamage = !tagsHaveAny(ownTags, DAMAGE_TAGS);
      const missingSupport = !tagsHaveAny(ownTags, SUPPORT_TAGS);
      const roleTags = [missingControl && [...tags].some((tag) => CONTROL_TAGS.has(tag)), missingDamage && [...tags].some((tag) => DAMAGE_TAGS.has(tag)), missingSupport && [...tags].some((tag) => SUPPORT_TAGS.has(tag))].filter(Boolean).length;
      score += roleTags * 12;
      if (roleTags) reasons.push(`补足阵容缺口：${roleTags} 项关键功能`);
      const synergy = intersectionCount(tags, ownTags);
      if (synergy) { score += synergy * 3; reasons.push(`与我方已有标签协同 ${synergy} 项`); }
      const counters = intersectionCount(tags, opponentTags) && [...tags].some((tag) => COUNTER_TAGS.has(tag));
      if (counters) { score += 8; reasons.push("包含针对对方已展示能力的应对标签"); }
      if (stage === "pick-1") { score += threat * 0.35; reasons.push("首选阶段提高泛用性和先手价值"); }
      if (stage === "pick-2" || stage === "pick-4" || stage === "pick-6") { score += threat * 0.15; reasons.push("次选阶段优先补齐当前阵容结构"); }
    }
    const speed = scoreStat(candidate, "speed", overrides);
    if (speed != null && speed >= 110) { score += 4; reasons.push(`当前速度 ${speed}，行动顺序价值较高`); }
    const performance = getCharacterPerformance(matchHistory, candidate.rosterId, { patch: state.patch, region: state.region });
    if (performance.appearances > 0) {
      score += performance.scoreAdjustment;
      const direction = performance.scoreAdjustment >= 0 ? "+" : "";
      reasons.unshift(`本机历史 ${performance.appearances} 场，平滑胜率 ${Math.round(performance.smoothedWinRate * 100)}%，校准 ${direction}${performance.scoreAdjustment.toFixed(1)} 分`);
    }
    if (candidate.usableForSimulation) reasons.push("技能数据可用于进一步模拟");
    else reasons.push("技能数据不完整，建议人工复核后再高权重使用");
    return {
      rosterId: candidate.rosterId,
      side,
      score: Math.round(score * 10) / 10,
      historySampleSize: performance.appearances,
      name: candidate.rosterCharacter.name,
      title: candidate.rosterCharacter.title,
      reasons,
      risk: candidate.usableForSimulation ? null : "技能资料不完整",
      dataCompleteness: candidate.dataCompleteness
    };
  });
  return results.sort((left, right) => right.score - left.score).slice(0, options.limit ?? 3);
}

function tagsHaveAny(tags, group) {
  for (const tag of tags) if (group.has(tag)) return true;
  return false;
}
