import { readFile } from "node:fs/promises";

const roster = JSON.parse(await readFile("data/roster.asia-2026-09-17.json", "utf8"));
const dataset = JSON.parse(await readFile("data/espr.characters.zh-CN.json", "utf8"));
const rosterIds = new Set(roster.characters.map((character) => character.id));
if (dataset.characters.length !== roster.characters.length) {
  throw new Error(`ESPR 角色数量不匹配：${dataset.characters.length} / ${roster.characters.length}`);
}
for (const character of dataset.characters) {
  if (!rosterIds.has(character.rosterId)) throw new Error(`ESPR 数据引用未知角色：${character.rosterId}`);
  for (const key of ["nameZh", "pageUrl", "portraitUrl", "fullArtUrl"]) {
    if (!character[key]) throw new Error(`${character.rosterId} 缺少 ${key}`);
  }
  if (!Array.isArray(character.skills) || character.skills.length === 0) {
    throw new Error(`${character.rosterId} 缺少技能条目`);
  }
  for (const skill of character.skills) {
    if (!skill.nameZh || !skill.iconUrl) throw new Error(`${character.rosterId} 存在不完整技能条目`);
  }
}
console.log(`ESPR 中文数据校验通过：${dataset.characters.length} 个角色，${dataset.characters.reduce((total, character) => total + character.skills.length, 0)} 个技能条目`);
