import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data/skills.normalized.json", import.meta.url), "utf8"));
const issues = [];
if (data.schemaVersion !== 1) issues.push("schemaVersion 必须为 1");
if (!Array.isArray(data.skills) || data.skills.length === 0) issues.push("skills 必须是非空数组");
const ids = new Set();
const validTypes = new Set(["passive", "basic", "special", "hyper"]);
const validTargets = new Set(["self", "single-enemy", "all-enemies", "single-ally", "all-allies", "unknown"]);
for (const [index, skill] of (data.skills ?? []).entries()) {
  if (!skill.id || ids.has(skill.id)) issues.push(`skills[${index}].id 缺失或重复`);
  ids.add(skill.id);
  if (!validTypes.has(skill.type)) issues.push(`skills[${index}].type 无效`);
  if (!validTargets.has(skill.target)) issues.push(`skills[${index}].target 无效`);
  if (!Array.isArray(skill.effects) || !Array.isArray(skill.tags)) issues.push(`skills[${index}] effects/tags 必须是数组`);
  if (typeof skill.descriptionEn !== "string" || typeof skill.sourceUrl !== "string") issues.push(`skills[${index}] 缺少原文或来源`);
}
if (issues.length > 0) throw new Error(`标准化技能校验失败：${issues.join("；")}`);
const reviewCount = data.skills.filter((skill) => skill.parsing.needsManualReview).length;
console.log(`标准化技能校验通过：${data.skills.length} 个技能，${reviewCount} 个需要人工复核`);
