import { writeFile } from "node:fs/promises";

const baseUrl = "https://tychara.com";
const listUrl = `${baseUrl}/StarSavior/characterlist/`;

function decodeHtml(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(html, pattern) {
  return html.match(pattern)?.[1] ?? null;
}

function absolute(path) {
  return path ? new URL(path, baseUrl).href : null;
}

function numberValue(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function parseStats(html) {
  const stats = {};
  const rows = html.matchAll(/<div class="status-row">([\s\S]*?)<\/div>\s*<\/div>/g);
  for (const row of rows) {
    const name = decodeHtml(row[1].match(/<div class="status-name">([\s\S]*?)<\/div>/)?.[1] ?? "").toLowerCase();
    const value = numberValue(row[1].match(/<span class="status-value">([\s\S]*?)<\/span>/)?.[1]);
    if (name === "attack power") stats.attack = value;
    else if (name === "vitality") stats.vitality = value;
    else if (name === "defense") stats.defense = value;
    else if (name === "speed") stats.speed = value;
    else if (name === "critical hit probability") stats.criticalHitRate = value;
    else if (name === "critical damage") stats.criticalDamage = value;
  }
  const tail = decodeHtml(html.match(/<div class="status-name">Critical Damage[\s\S]*?<\/div>/i)?.[0] ?? "");
  const effectMatch = tail.match(/Effect Hit\s+(\d+)%\s+Effect Resistance\s+(\d+)%\s+Hit Rate\s+(\d+)%/i);
  if (effectMatch) {
    stats.effectHit = Number(effectMatch[1]);
    stats.effectResistance = Number(effectMatch[2]);
    stats.hitRate = Number(effectMatch[3]);
  }
  return stats;
}

function parseSkills(html) {
  const sectionStart = html.indexOf('class="skills-panel');
  const section = sectionStart >= 0 ? html.slice(sectionStart) : html;
  const starts = [...section.matchAll(/<div class="skill-card\b/g)].map((match) => match.index);
  return starts.map((start, index) => {
    const chunk = section.slice(start, starts[index + 1] ?? section.length);
    const typeClass = chunk.match(/skill-type--([a-z]+)/)?.[1] ?? "unknown";
    const icon = absolute(attr(chunk, /<img class="skill-icon"[^>]*src="([^"]+)"/));
    const name = decodeHtml(chunk.match(/<p class="skill-name">([\s\S]*?)<\/p>/)?.[1] ?? "");
    const description = decodeHtml(chunk.match(/<div class="skill-base-text">([\s\S]*?)<\/div>/)?.[1] ?? "");
    const banner = decodeHtml(chunk.match(/<div class="skill-type-banner[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "");
    return { type: typeClass, banner, name, descriptionEn: description, iconUrl: icon };
  }).filter((skill) => skill.name);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

const listHtml = await fetchText(listUrl);
const discoveredSlugs = [...new Set([
  ...[...listHtml.matchAll(/href=["'](?:https:\/\/tychara\.com)?\/StarSavior\/characters\/([^"']+)["']/g)].map((match) => match[1])
])];
const slugs = discoveredSlugs.length > 0 ? discoveredSlugs : [
  "ceres", "annah", "asherah", "asherahwaltzofstarlight", "bellrhys", "besta", "bunnygirlcharlotte", "bunnygirlclaire", "bunnygirlscarlet", "carmen", "carmeneternalpromise", "carnelia", "charlotte", "claire", "clarissa", "dana", "elisa", "emilly", "epindel", "epindelblessinginbloom", "fei", "frey", "freynobleprincess", "harley", "haydee", "hilde", "kyra", "lacy", "lily", "lugh", "luna", "lydia", "lyn", "marcille", "muriel", "naru", "omega", "petra", "roberta", "rosaria", "scarlet", "seira", "serpang", "smile", "tanya", "trish", "tyria", "vera", "yoomina"
];
const characters = [];
for (let index = 0; index < slugs.length; index += 4) {
  const batch = slugs.slice(index, index + 4);
  const results = await Promise.all(batch.map(async (slug) => {
    const pageUrl = `${baseUrl}/StarSavior/characters/${slug}/`;
    const html = await fetchText(pageUrl);
    const fullArt = absolute(attr(html, /<meta property="og:image" content="([^"]+)"/));
    const icon = absolute(attr(html, /<img[^>]+src="(\/StarSavior\/characterimg\/charicons\/[^"]+)"/));
    const name = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? slug);
    const profile = decodeHtml(attr(html, /<meta property="og:description" content="([^"]+)"/) ?? "");
    return {
      slug,
      name,
      pageUrl,
      lastUpdated: attr(html, /Last updated:\s*<\/[^>]+>\s*([^<]+)/i),
      profileEn: profile,
      iconUrl: icon,
      fullArtUrl: fullArt,
      stats: parseStats(html),
      skills: parseSkills(html)
    };
  }));
  characters.push(...results);
  console.log(`已读取 Tychara 角色页 ${Math.min(index + batch.length, slugs.length)} / ${slugs.length}`);
}

const output = {
  schemaVersion: 1,
  datasetStatus: "observed-public-tychara",
  source: { url: listUrl, sourceLastUpdated: "2026-06-29", verifiedInAsiaClient: false },
  generatedAt: new Date().toISOString(),
  characters
};
await writeFile("data/tychara.characters.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`已写入 data/tychara.characters.json：${characters.length} 个角色页`);
