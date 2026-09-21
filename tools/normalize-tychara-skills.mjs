import { readFile, writeFile } from "node:fs/promises";

const tychara = JSON.parse(await readFile(new URL("../data/tychara.characters.json", import.meta.url), "utf8"));
const knowledge = JSON.parse(await readFile(new URL("../data/knowledge-base.json", import.meta.url), "utf8"));

const buffNames = ["ATK Up", "DEF Up", "SPD Up", "CRIT Rate Up", "CRIT DMG Up", "Western Winds", "Starlight Wish", "Insight", "Leap", "Chill", "Power-Up Star", "Demolition Mode", "Jackpot Bloom", "Ignition", "Agitation", "Entangled Dream", "Barrier", "Stealth", "Preemptive Guard", "Pinball Time!", "Seven Ball", "Normal Ball", "Thorns of Ruin"];
const controlNames = ["Freeze", "Stun", "Silence", "Bind", "Isolation", "Burn", "Entangled Dream"];
const debuffNames = ["ATK Down", "DEF Down", "ACC Down", "SPD Down"];

function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

function targetFor(description, skillType = "") {
  if (skillType === "passive") return "self";
  if (/all enemies/i.test(description)) return "all-enemies";
  if (/all allies/i.test(description)) return "all-allies";
  if (/single ally|an ally|one ally/i.test(description)) return "single-ally";
  if (/the enemy|an enemy|single enemy|enemy/i.test(description)) return "single-enemy";
  if (/self/i.test(description)) return "self";
  return "unknown";
}

function chanceFor(description, phrase) {
  const match = description.match(new RegExp(`(\\d+)% chance to [^.]*${phrase}`, "i"));
  return match ? Number(match[1]) : null;
}

function durationFor(description, phrase = "") {
  const match = description.match(new RegExp(`${phrase}[^.]*?for (\\d+) turns`, "i"));
  return match ? Number(match[1]) : null;
}

function parseEffects(skill) {
  const description = skill.descriptionEn;
  const effects = [];
  const target = targetFor(description, skill.type);
  const active = skill.type !== "passive";
  if (active && /attack|attacks|damage|slash|strike|blast|shot|cleave|slash/i.test(description)) effects.push({ type: "damage", target });
  if (/restores?|recovery|heal/i.test(description)) effects.push({ type: "heal", target: /all allies/i.test(description) ? "all-allies" : target });
  if (/action gauge/i.test(description)) {
    const amounts = [...description.matchAll(/action gauge[^.]*?(\d+)%/gi)].map((match) => Number(match[1]));
    effects.push({ type: "action-gauge", target, amounts: unique(amounts) });
  }
  if (/toughness/i.test(description)) effects.push({ type: "toughness-damage", target: "self", condition: /NOVA BURST/i.test(description) ? "nova-burst" : null });
  if (/remove [^.]*buff|removes? all buffs|remove [^.]*debuff/i.test(description)) effects.push({ type: "cleanse", target, side: /debuff/i.test(description) ? "debuff" : "buff" });
  for (const match of description.matchAll(/increases? (?:self|[A-Za-z’']+(?:['’]s)?) (ATK|Max HP|HP|DEF|SPD|CRIT Rate|CRIT DMG|Action Gauge) by (\d+)%?/gi)) {
    effects.push({ type: "buff", name: `${match[1]} Up`, target: "self", amount: Number(match[2]) });
  }
  for (const match of description.matchAll(/reduces? (?:the enemy's|enemy) (ATK|DEF|SPD|Action Gauge) by (\d+)%/gi)) {
    effects.push({ type: "debuff", name: `${match[1]} Down`, target: "single-enemy", amount: Number(match[2]) });
  }
  for (const name of buffNames) {
    if (!description.toLowerCase().includes(name.toLowerCase())) continue;
    effects.push({ type: controlNames.includes(name) ? "control" : "buff", name, target, duration: durationFor(description, name) });
  }
  for (const name of debuffNames) {
    if (!description.toLowerCase().includes(name.toLowerCase())) continue;
    effects.push({ type: "debuff", name, target, duration: durationFor(description, name), chance: chanceFor(description, name) });
  }
  for (const name of controlNames) {
    if (!description.toLowerCase().includes(name.toLowerCase())) continue;
    effects.push({ type: "control", name, target, duration: durationFor(description, name), chance: chanceFor(description, name) });
  }
  if (/triggers?|after using/i.test(description)) effects.push({ type: "trigger", target: "self" });
  if (/penetrates? (\d+)% of DEF/i.test(description)) effects.push({ type: "def-penetration", target: "single-enemy", amount: Number(description.match(/penetrates? (\d+)% of DEF/i)[1]) });
  if (/increased damage/i.test(description)) effects.push({ type: "damage-modifier", target: "self", condition: /if ([^.]+)/i.exec(description)?.[1] ?? null });
  return effects.filter((effect, index, list) => list.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(effect)) === index);
}

function parseTags(skill, effects) {
  const tags = [];
  if (skill.type !== "passive" && effects.some((effect) => effect.type === "damage")) tags.push("damage");
  for (const effect of effects) {
    if (effect.type === "control") tags.push("control");
    if (effect.type === "debuff") tags.push("debuff");
    if (effect.type === "buff") tags.push("buff");
    if (effect.type === "heal") tags.push("healing");
    if (effect.type === "cleanse") tags.push("cleanse");
    if (effect.type === "action-gauge") tags.push("action-gauge");
    if (effect.type === "toughness-damage") tags.push("toughness");
  }
  if (/proportional to (?:self )?Max HP/i.test(skill.descriptionEn)) tags.push("max-hp-scaling");
  if (/proportional to self ATK|based on self ATK/i.test(skill.descriptionEn)) tags.push("atk-scaling");
  if (/NOVA BURST/i.test(skill.descriptionEn)) tags.push("nova-burst");
  return unique(tags);
}

function knowledgeMatch(ownerSlug, skill) {
  const ownerAliases = { bellrhys: "bell-rhys", charlotte: "charlotte", claire: "claire", omega: "omega", tanya: "tanya", asherah: "asherah", lacy: "lacy", smile: "smile", luna: "luna" };
  const ownerId = ownerAliases[ownerSlug];
  return ownerId ? knowledge.skills.find((candidate) => candidate.ownerId === ownerId && candidate.name === skill.name) ?? null : null;
}

const skills = [];
for (const character of tychara.characters) {
  for (const skill of character.skills) {
    const effects = parseEffects(skill);
    const matched = knowledgeMatch(character.slug, skill);
    const cooldown = Number(skill.descriptionEn.match(/Cooldown:\s*(\d+) turn/i)?.[1] ?? NaN);
    const normalizedType = skill.type === "ultimate" ? "hyper" : skill.type;
    const requiresReview = matched === null || /\b(if|when|after|each|proportional|stacks?|Undispellable|excluding|chance)\b/i.test(skill.descriptionEn);
    skills.push({
      id: `tychara-${character.slug}-${normalizedType}`,
      ownerSlug: character.slug,
      name: skill.name,
      type: normalizedType,
      target: targetFor(skill.descriptionEn, skill.type),
      cooldown: Number.isFinite(cooldown) ? cooldown : null,
      resourceCost: null,
      effects,
      tags: parseTags(skill, effects),
      descriptionEn: skill.descriptionEn,
      descriptionZh: matched?.descriptionZh ?? null,
      iconUrl: skill.iconUrl,
      sourceUrl: character.pageUrl,
      verification: "observed-public",
      parsing: {
        confidence: effects.length > 0 || skill.type === "passive" ? (requiresReview ? "parsed-medium" : "parsed-high") : "unresolved",
        cooldownSource: Number.isFinite(cooldown) ? "description" : "not-present-in-base-description",
        needsManualReview: targetFor(skill.descriptionEn, skill.type) === "unknown" || effects.length === 0 || requiresReview
      }
    });
  }
}

const output = {
  schemaVersion: 1,
  datasetStatus: "phase-3-normalized-public-skills",
  source: tychara.source,
  generatedAt: new Date().toISOString(),
  notes: [
    "本文件是从 Tychara 英文公开技能原文抽取的标准化中间层，不覆盖已人工确认的中文知识库。",
    "未能从基础描述可靠推导的冷却、概率和效果字段保持 null，并通过 parsing.needsManualReview 标记。",
    "公开资料主要覆盖韩服/日服，未在亚服客户端逐条验证。"
  ],
  skills
};
await writeFile("data/skills.normalized.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`已写入 data/skills.normalized.json：${skills.length} 个标准化技能`);
