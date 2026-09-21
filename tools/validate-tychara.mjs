import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile(new URL("../data/tychara.characters.json", import.meta.url), "utf8"));
const issues = [];
if (data.schemaVersion !== 1) issues.push("schemaVersion 必须为 1");
if (!Array.isArray(data.characters) || data.characters.length === 0) issues.push("characters 必须是非空数组");
const slugs = new Set();
let skillCount = 0;
for (const [index, character] of (data.characters ?? []).entries()) {
  if (!character.slug || slugs.has(character.slug)) issues.push(`characters[${index}].slug 缺失或重复`);
  slugs.add(character.slug);
  for (const field of ["pageUrl", "iconUrl", "fullArtUrl"]) {
    if (typeof character[field] !== "string" || !character[field].startsWith("https://tychara.com/")) issues.push(`characters[${index}].${field} 不是 Tychara URL`);
  }
  if (!Array.isArray(character.skills)) issues.push(`characters[${index}].skills 必须是数组`);
  skillCount += character.skills?.length ?? 0;
}
if (issues.length > 0) throw new Error(`Tychara 数据校验失败：${issues.join("；")}`);
console.log(`Tychara 数据校验通过：${data.characters.length} 个角色页，${skillCount} 个技能条目`);
