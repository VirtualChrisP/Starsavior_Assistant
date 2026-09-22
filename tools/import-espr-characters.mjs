import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

const execFileAsync = promisify(execFile);
const baseUrl = "https://ss.espr.gg/zh-CN/database/characters";
const rosterPath = "data/roster.asia-2026-09-17.json";
const outputPath = "data/espr.characters.zh-CN.json";

const slugByRosterId = {
  "asherah-voyager-savior-party": "asherah-moon-striker",
  "smile-voyager-savior-party": "smile",
  "luna-voyager-savior-party": "luna",
  carnelia: "carnelia",
  bell: "bell",
  emily: "emily",
  "charlotte-monastir-knights": "charlotte-sun-striker",
  "carmen-monastir-knights": "carmen-moon-defender",
  "frey-monastir-knights": "frey-star-supporter",
  seira: "seira",
  trish: "trish",
  lyn: "lyn",
  cristelle: "cristelle",
  haydee: "haydee",
  serpang: "serpang",
  dana: "dana",
  muriel: "muriel",
  elisa: "elisa",
  tyria: "tyria",
  roberta: "roberta",
  lugh: "lugh",
  fei: "fei",
  "epindel-house-orlan": "epindel-moon-assassin",
  omega: "omega",
  "charlotte-heart-of-monastir": "charlotte-sun-assassin",
  ceres: "ceres",
  lydia: "lydia",
  "professor-m": "professor-m",
  gwen: "gwen",
  harley: "harley",
  petra: "petra",
  "scarlet-little-tyrant": "scarlet-sun-ranger",
  "claire-flawless-blue-rose": "claire-moon-striker",
  "luna-white-pearl-trap": "luna-sun-defender",
  "smile-sunshine-cat": "smile-star-assassin",
  lacy: "lacy",
  tanya: "tanya",
  lily: "lily",
  kyra: "kyra",
  "asherah-waltz-of-starlight": "asherah-order-supporter",
  "carmen-eternal-promise": "carmen-moon-supporter",
  "epindel-blessing-in-bloom": "epindel-sun-caster",
  "frey-noble-princess": "frey-moon-caster",
  amora: "amora",
  besta: "besta",
  annah: "annah",
  marcille: "marcille",
  vera: "vera",
  naru: "naru",
  "claire-candle-square": "claire-moon-assassin",
  "scarlet-candle-square": "scarlet-sun-striker",
  clarissa: "clarissa",
  hilde: "hilde",
  "yoo-mina": "yoo-mina",
  rosaria: "rosaria"
};

function decodeEscaped(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value.replaceAll('\\"', '"').replaceAll("\\u003c", "<").replaceAll("\\u003e", ">");
  }
}

function stripMarkup(value) {
  return decodeEscaped(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1] ?? null;
}

function parseSkills(html, skillStart) {
  if (skillStart < 0) return [];
  const end = html.indexOf('\\"bloomSkills\\"', skillStart);
  const section = html.slice(skillStart, end >= 0 ? end : html.length);
  const starts = [...section.matchAll(/\{\\"name\\":\\"((?:\\\\.|[^"\\])*)\\",\\"type\\":\\"([^"\\]*)\\",\\"iconUrl\\":\\"([^"\\]*)\\"/g)];
  const iconId = starts[0]?.[3]?.match(/characters\/skills\/(\d+)_\d+\.webp/)?.[1];
  const visibleSkills = iconId
    ? [...html.matchAll(new RegExp(`<img alt="([^"]+)"[^>]*srcSet="[^"]*skills%2F${iconId}_(\\d+)\\.webp`, "g"))]
        .map((match, index, matches) => {
          const chunk = html.slice(match.index, matches[index + 1]?.index ?? html.length);
          return stripMarkup(chunk.match(/<p class="mt-2 text-sm text-gray-400">([\s\S]*?)<\/p>/)?.[1] ?? "");
        })
    : [];
  const visibleDescriptions = [...html.matchAll(/<p class="mt-2 text-sm text-gray-400">([\s\S]*?)<\/p>/g)]
    .map((match) => stripMarkup(match[1]));
  const descriptions = visibleSkills.length >= starts.length ? visibleSkills : visibleDescriptions;
  return starts.map((match, index) => {
    const chunk = section.slice(match.index, starts[index + 1]?.index ?? section.length);
    const description = [...chunk.matchAll(/\\"descriptionHtml\\":\\"((?:\\\\.|[^"\\])*)\\"/g)].map((match) => match[1]).find((value) => !value.startsWith("$"));
    const levelDesc = [...chunk.matchAll(/\\"levelDesc\\":\\"((?:\\\\.|[^"\\])*)\\"/g)].map((match) => match[1]).find((value) => !value.startsWith("$"));
    return {
      type: match[2],
      nameZh: decodeEscaped(match[1]),
      descriptionZh: descriptions[index] || (description && !description.startsWith("$") ? stripMarkup(description) : null),
      levelDescZh: levelDesc && !levelDesc.startsWith("$") ? stripMarkup(levelDesc) : null,
      iconUrl: decodeEscaped(match[3])
    };
  }).filter((skill) => skill.nameZh);
}

function parsePage(html, rosterId, slug) {
  const portraitUrl = firstMatch(html, /<meta property="og:image" content="([^"]+)"/);
  const title = firstMatch(html, /<title>([^<|]+)\s*\|/);
  const descriptionZh = firstMatch(html, /<meta name="description" content="([^"]+)"/);
  const skillStart = html.indexOf('\\"skills\\":[{');
  const element = lastMatch(html, /\\"element\\":\\"([^"\\]+)\\"/g) ?? firstMatch(html, /images\/characters\/icon\/element\.([a-z]+)/);
  const roleClass = firstMatch(html, /images\/characters\/icon\/class\.([a-z]+)/);
  const attackType = firstMatch(html, /images\/characters\/icon\/attack\.type\.([a-z]+)/);
  const rarity = lastMatch(html, /\\"rarity\\":\\"([^"\\]+)\\"/g) ?? firstMatch(html, /alt="(SSR|SR)"/);
  const faction = firstMatch(html, /<p class="text-sm font-medium text-violet-300">([^<]+)<\/p>/);
  return {
    rosterId,
    slug,
    pageUrl: `${baseUrl}/${slug}`,
    nameZh: title?.trim() || rosterId,
    factionZh: faction,
    profileZh: descriptionZh,
    rarity,
    element,
    class: roleClass,
    attackType,
    portraitUrl,
    fullArtUrl: portraitUrl?.replace("/portrait/", "/illustration/").replace(/\\.webp$/, ".ui.webp") ?? null,
    skills: parseSkills(html, skillStart)
  };
}

async function fetchHtml(url) {
  const { stdout } = await execFileAsync("curl.exe", [
    "-L", "--silent", "--show-error", "--retry", "3", "--retry-delay", "1",
    "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    "-H", "Accept-Language: zh-CN,zh;q=0.9", url
  ], { maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

const roster = JSON.parse(await readFile(rosterPath, "utf8"));
const characters = [];
const importStart = Number(process.env.ESPR_START ?? 0);
const importLimit = Number(process.env.ESPR_LIMIT ?? roster.characters.length);
const sourceCharacters = roster.characters.slice(importStart, importStart + importLimit);
for (const character of sourceCharacters) {
  const slug = slugByRosterId[character.id];
  if (!slug) throw new Error(`缺少 ESPR slug 映射：${character.id}`);
  const html = await fetchHtml(`${baseUrl}/${slug}`);
  const parsed = parsePage(html, character.id, slug);
  characters.push(parsed);
  console.log(`已读取 ESPR ${characters.length}/${sourceCharacters.length}: ${parsed.nameZh} (${slug})，技能 ${parsed.skills.length} 个`);
}

const output = {
  schemaVersion: 1,
  datasetStatus: "observed-public-espr-zh-CN",
  source: { url: "https://ss.espr.gg/zh-CN/database/characters", sourceLastUpdated: null, verifiedInAsiaClient: false },
  generatedAt: new Date().toISOString(),
  characters
};
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`已写入 ${outputPath}：${characters.length} 个角色`);

function lastMatch(html, pattern) {
  const matches = [...html.matchAll(pattern)];
  return matches.at(-1)?.[1] ?? null;
}
