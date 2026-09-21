import {
  editorStatKeys,
  editorStatLabels,
  getCharacterOverride,
  getStatTotal,
  sanitizeOverrides,
  skillOverrideKey,
  upsertCharacterOverride
} from "/src/knowledge/character-overrides.mjs";

const storageKey = "star-savior-bp-character-overrides-v1";
const slugOverrides = {
  "asherah-voyager-savior-party": "asherah", "asherah-waltz-of-starlight": "asherahwaltzofstarlight",
  "smile-voyager-savior-party": "smile", "smile-sunshine-cat": "smile", "luna-voyager-savior-party": "luna", "luna-white-pearl-trap": "luna",
  bell: "bellrhys", emily: "emilly", "charlotte-monastir-knights": "charlotte", "charlotte-heart-of-monastir": "charlotte",
  "claire-candle-square": "claire", "claire-flawless-blue-rose": "claire", "scarlet-candle-square": "scarlet", "scarlet-little-tyrant": "scarlet",
  "carmen-monastir-knights": "carmen", "carmen-eternal-promise": "carmeneternalpromise", "frey-monastir-knights": "frey", "frey-noble-princess": "freynobleprincess",
  "epindel-house-orlan": "epindel", "epindel-blessing-in-bloom": "epindelblessinginbloom"
};
const statLabels = { ...editorStatLabels };
const percentStats = new Set(["criticalHitRate", "criticalDamage", "effectHit", "effectResistance", "hitRate"]);
const dom = {
  app: document.querySelector("#editor-app"), status: document.querySelector("#editor-status"), search: document.querySelector("#editor-search-input"),
  count: document.querySelector("#editor-character-count"), list: document.querySelector("#editor-character-list"), empty: document.querySelector("#editor-empty"), content: document.querySelector("#editor-content"),
  portrait: document.querySelector("#editor-portrait"), kicker: document.querySelector("#editor-character-kicker"), title: document.querySelector("#character-editor-title"), subtitle: document.querySelector("#editor-character-subtitle"),
  stats: document.querySelector("#stats-editor"), skills: document.querySelector("#skills-editor"), reset: document.querySelector("#reset-character-button"), export: document.querySelector("#export-editor-button"), import: document.querySelector("#import-editor-button"), importInput: document.querySelector("#import-editor-input")
};
let roster;
let tychara;
let normalized;
let overrides;
let selectedId = null;

function loadOverrides() {
  try { return sanitizeOverrides(JSON.parse(localStorage.getItem(storageKey) ?? "{}")); } catch { return sanitizeOverrides({}); }
}
function saveOverrides() {
  overrides.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey, JSON.stringify(overrides));
  dom.status.textContent = `已保存本机修改 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}
function char(id) { return roster.characters.find((item) => item.id === id); }
function publicData(id) {
  const item = char(id);
  if (!item) return null;
  const slug = slugOverrides[id] ?? item.name.toLowerCase().replace(/[^a-z]+/g, "");
  return tychara.characters.find((candidate) => candidate.slug === slug) ?? null;
}
function portrait(id, large = false) {
  const node = document.createElement("div");
  node.className = large ? "editor-portrait" : "portrait";
  const data = publicData(id);
  if (data?.iconUrl) {
    const image = document.createElement("img"); image.src = data.iconUrl; image.alt = char(id)?.name ?? id; image.onerror = () => { image.remove(); node.textContent = (char(id)?.name ?? id).slice(0, 1); }; node.append(image);
  } else node.textContent = (char(id)?.name ?? id).slice(0, 1);
  return node;
}
function formatNumber(value, key) { return `${value}${percentStats.has(key) ? "%" : ""}`; }
function baseStats(item, data) { return { ...(item?.stats ?? {}), ...(data?.stats ?? {}) }; }
function filteredRoster() {
  const query = dom.search.value.trim().toLowerCase();
  return roster.characters.filter((item) => !query || `${item.name} ${item.title}`.toLowerCase().includes(query));
}
function renderList() {
  const visible = filteredRoster();
  dom.count.textContent = `${visible.length} / ${roster.characters.length}`;
  dom.list.replaceChildren();
  for (const item of visible) {
    const button = document.createElement("button"); button.type = "button"; button.className = `editor-character-button ${selectedId === item.id ? "active" : ""}`;
    button.append(portrait(item.id));
    const copy = document.createElement("span"); copy.innerHTML = `<strong>${item.name}</strong><small>${item.title} · ${item.element ?? "未标注"}</small>`; button.append(copy);
    button.addEventListener("click", () => { selectedId = item.id; renderList(); renderEditor(); }); dom.list.append(button);
  }
}
function renderEditor() {
  const item = char(selectedId);
  if (!item) { dom.empty.hidden = false; dom.content.hidden = true; return; }
  dom.empty.hidden = true; dom.content.hidden = false;
  const data = publicData(item.id); const current = getCharacterOverride(overrides, item.id); const stats = baseStats(item, data);
  dom.portrait.replaceChildren(); const portraitData = publicData(item.id); if (portraitData?.iconUrl) { const image = document.createElement("img"); image.src = portraitData.iconUrl; image.alt = item.name; dom.portrait.append(image); } else dom.portrait.textContent = item.name.slice(0, 1);
  dom.kicker.textContent = `${item.rarity} · ${item.element ?? "未标注"} · ${item.class ?? "未标注"}`;
  dom.title.textContent = `${item.name} · ${item.title}`; dom.subtitle.textContent = data?.profileEn || "当前角色暂无公开简介。";
  dom.stats.replaceChildren();
  for (const key of editorStatKeys) {
    const base = stats[key]; if (base == null && current.equipment?.[key] == null) continue;
    const row = document.createElement("div"); row.className = "stat-editor-row";
    const label = document.createElement("div"); label.innerHTML = `<strong>${statLabels[key]}</strong><small>基础 ${formatNumber(base ?? 0, key)}</small>`;
    const input = document.createElement("input"); input.type = "number"; input.step = "any"; input.value = current.equipment?.[key] ?? 0; input.setAttribute("aria-label", `${statLabels[key]}装备加成`);
    const total = document.createElement("strong"); total.className = "stat-total"; total.textContent = formatNumber(getStatTotal(base, input.value), key);
    input.addEventListener("input", () => { total.textContent = formatNumber(getStatTotal(base, input.value), key); });
    input.addEventListener("change", () => { overrides = upsertCharacterOverride(overrides, item.id, (old) => ({ ...old, equipment: { ...old.equipment, [key]: Number(input.value) || 0 } })); saveOverrides(); });
    row.append(label, input, total); dom.stats.append(row);
  }
  dom.skills.replaceChildren();
  if (!data?.skills?.length) { const note = document.createElement("p"); note.className = "no-detail"; note.textContent = "该角色暂无可编辑的公开技能条目。"; dom.skills.append(note); return; }
  for (const skill of data.skills) {
    const key = skillOverrideKey(data.slug, skill); const custom = current.skills?.[key] ?? {}; const normalizedSkill = normalized.skills.find((candidate) => candidate.ownerSlug === data.slug && candidate.type === (skill.type === "ultimate" ? "hyper" : skill.type) && candidate.name === skill.name);
    const card = document.createElement("article"); card.className = "skill-editor-card";
    const heading = document.createElement("div"); heading.className = "skill-editor-heading"; const icon = document.createElement("img"); icon.src = skill.iconUrl; icon.alt = skill.name; const headingCopy = document.createElement("div"); headingCopy.innerHTML = `<strong>${skill.name}</strong><small>${skill.banner || skill.type} · ${normalizedSkill?.target ?? "目标未识别"}</small>`; heading.append(icon, headingCopy);
    const fields = document.createElement("div"); fields.className = "skill-editor-fields";
    const nameLabel = document.createElement("label"); nameLabel.textContent = "中文技能名"; const nameInput = document.createElement("input"); nameInput.value = custom.nameZh ?? ""; nameInput.placeholder = "例如：月影斩"; nameLabel.append(nameInput);
    const descLabel = document.createElement("label"); descLabel.textContent = "中文技能描述"; const descInput = document.createElement("textarea"); descInput.value = custom.descriptionZh ?? ""; descInput.placeholder = "输入技能效果、持续回合和触发条件……"; descLabel.append(descInput);
    const update = () => { overrides = upsertCharacterOverride(overrides, item.id, (old) => ({ ...old, skills: { ...old.skills, [key]: { nameZh: nameInput.value, descriptionZh: descInput.value } } })); saveOverrides(); };
    nameInput.addEventListener("change", update); descInput.addEventListener("change", update); fields.append(nameLabel, descLabel); card.append(heading, fields); dom.skills.append(card);
  }
}
function exportData() {
  const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "star-savior-character-overrides.json"; anchor.click(); URL.revokeObjectURL(url);
}
function importData(file) {
  const reader = new FileReader(); reader.onload = () => { try { overrides = sanitizeOverrides(JSON.parse(reader.result)); saveOverrides(); renderEditor(); } catch { dom.status.textContent = "导入失败：文件不是有效的编辑数据 JSON。"; } }; reader.readAsText(file);
}
dom.search.addEventListener("input", renderList);
dom.reset.addEventListener("click", () => { if (!selectedId || !window.confirm("清除当前角色的装备加成和中文技能覆盖？")) return; delete overrides.characters[selectedId]; saveOverrides(); renderEditor(); });
dom.export.addEventListener("click", exportData); dom.import.addEventListener("click", () => dom.importInput.click()); dom.importInput.addEventListener("change", () => { if (dom.importInput.files[0]) importData(dom.importInput.files[0]); dom.importInput.value = ""; });
Promise.all([
  fetch("/data/roster.asia-2026-09-17.json").then((response) => response.json()),
  fetch("/data/tychara.characters.json").then((response) => response.json()),
  fetch("/data/skills.normalized.json").then((response) => response.json())
]).then(([loadedRoster, loadedTychara, loadedNormalized]) => {
  roster = loadedRoster; tychara = loadedTychara; normalized = loadedNormalized; overrides = loadOverrides(); dom.status.textContent = `亚服 · ${roster.patch} · 修改保存在本机`; renderList(); dom.app.setAttribute("aria-busy", "false");
}).catch((error) => { dom.status.textContent = `载入失败：${error.message}`; });
