import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseKnowledgeBase } from "../src/knowledge/knowledge-base.mjs";

const dataPath = resolve(process.cwd(), "data/knowledge-base.json");
const raw = await readFile(dataPath, "utf8");
const data = JSON.parse(raw);
parseKnowledgeBase(data);

console.log(`知识库校验通过：${data.characters.length} 个角色，${data.skills.length} 个技能，${data.effectsCatalog.length} 个效果定义`);
