import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseRosterSnapshot } from "../src/knowledge/roster.mjs";

const dataPath = resolve(process.cwd(), "data/roster.asia-2026-09-17.json");
const roster = JSON.parse(await readFile(dataPath, "utf8"));
parseRosterSnapshot(roster);

console.log(`阵容快照校验通过：${roster.characters.length} 个角色，版本 ${roster.patch}，地区 ${roster.region}`);
