import {
  applyDraftAction,
  createDraftState,
  getDraftProgress,
  setFirstPicker,
  undoDraftAction
} from "/src/draft/draft-state.mjs";
import { getDraftCandidates, summarizeDraftRisks } from "/src/draft/rule-engine.mjs";
import { getCharacterOverride, getEquipmentModifier, getStatTotal, sanitizeOverrides, skillOverrideKey } from "/src/knowledge/character-overrides.mjs";
import { getDraftRecommendations } from "/src/draft/recommendation-engine.mjs";
import { createEmptyMatchHistory, createMatchRecord, findMatchByDraftId, sanitizeMatchHistory, upsertMatchRecord } from "/src/matches/match-history.mjs";

const imageMap = {
  "asherah-voyager-savior-party": "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_VOYAGER_STRANIS.webp",
  "smile-voyager-savior-party": "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_VOYAGER_SMILE.webp",
  "luna-voyager-savior-party": "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_VOYAGER_ORACLE.webp",
  bell: "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_MAID_BELL.webp",
  "charlotte-monastir-knights": "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_KINGDOM_KNIGHT.webp",
  omega: "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_STARPIERCER_OMEGA.webp",
  lacy: "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_INDEPENDENT_DRAGON.webp",
  tanya: "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_CONSTRUCT_GADGET.webp",
  "claire-candle-square": "https://starsavior-db.pages.dev/images/icons/UFS_NKM_UNIT_S_MAID_SPEAR.webp"
};

const labels = {
  element: { sun: "太阳", moon: "月亮", star: "星辰", order: "秩序", chaos: "混沌" },
  class: { defender: "防御", striker: "强攻", ranger: "游侠", caster: "术师", supporter: "支援", assassin: "刺客" }
};
const stageLabels = ["首轮禁用", "首选 1", "次选 2", "首选 2", "次选 2", "首选 2", "次选 1", "末轮禁用"];
const storageKey = "star-savior-bp-draft-v2";
const characterOverridesStorageKey = "star-savior-bp-character-overrides-v1";
const matchHistoryStorageKey = "star-savior-bp-match-history-v1";

const dom = {
  app: document.querySelector("#app"), version: document.querySelector("#version-label"),
  saveState: document.querySelector("#save-state"), undo: document.querySelector("#undo-button"), reset: document.querySelector("#reset-button"),
  phaseKicker: document.querySelector("#phase-kicker"), phaseTitle: document.querySelector("#phase-title"), phaseDetail: document.querySelector("#phase-detail"),
  stageTrack: document.querySelector("#stage-track"), firstPickerButtons: [...document.querySelectorAll("[data-first-picker]")],
  actionSideControl: document.querySelector("#action-side-control"), actionSideButtons: [...document.querySelectorAll("[data-action-side]")],
  search: document.querySelector("#search-input"), element: document.querySelector("#element-filter"), classFilter: document.querySelector("#class-filter"),
  status: document.querySelector("#status-strip"), recommendations: document.querySelector("#recommendation-panel"), grid: document.querySelector("#roster-grid"), empty: document.querySelector("#empty-state"),
  allyPicks: document.querySelector("#ally-picks"), enemyPicks: document.querySelector("#enemy-picks"), allyBans: document.querySelector("#ally-bans"), enemyBans: document.querySelector("#enemy-bans"),
  allyCount: document.querySelector("#ally-count"), enemyCount: document.querySelector("#enemy-count"), toast: document.querySelector("#toast"),
  detailModal: document.querySelector("#detail-modal"), detailArt: document.querySelector("#detail-art"), detailKicker: document.querySelector("#detail-kicker"), detailName: document.querySelector("#detail-name"), detailProfile: document.querySelector("#detail-profile"), detailStats: document.querySelector("#detail-stats"), detailSource: document.querySelector("#detail-source"), detailSkills: document.querySelector("#detail-skills"), closeDetail: document.querySelector("#close-detail"),
  resultPanel: document.querySelector("#match-result-panel"), resultForm: document.querySelector("#match-result-form"), resultWinnerButtons: [...document.querySelectorAll("[data-result-winner]")], resultStatus: document.querySelector("#result-status"), resultDuration: document.querySelector("#result-duration"), resultNotes: document.querySelector("#result-notes"), resultState: document.querySelector("#match-result-state"), historySummary: document.querySelector("#match-history-summary"), exportHistory: document.querySelector("#export-history-button")
};

let roster;
let knowledgeBase;
let tycharaData;
let esprData;
let normalizedSkills;
let rules;
let state;
let actionSide = "ally";
let toastTimer;
let characterOverrides = sanitizeOverrides({});
let selectedDetailId = null;
let matchHistory = createEmptyMatchHistory();
let selectedWinner = "unknown";
let resultFormDraftId = null;

const rosterById = () => new Map(roster.characters.map((character) => [character.id, character]));
const knowledgeByRosterId = () => new Map(knowledgeBase.characters.filter((character) => character.rosterId).map((character) => [character.rosterId, character]));

const tycharaSlugOverrides = {
  "asherah-voyager-savior-party": "asherah", "asherah-waltz-of-starlight": "asherahwaltzofstarlight",
  "smile-voyager-savior-party": "smile", "smile-sunshine-cat": "smile", "luna-voyager-savior-party": "luna", "luna-white-pearl-trap": "luna",
  bell: "bellrhys", emily: "emilly", "charlotte-monastir-knights": "charlotte", "charlotte-heart-of-monastir": "charlotte",
  "claire-candle-square": "claire", "claire-flawless-blue-rose": "claire", "scarlet-candle-square": "scarlet", "scarlet-little-tyrant": "scarlet",
  "carmen-monastir-knights": "carmen", "carmen-eternal-promise": "carmeneternalpromise", "frey-monastir-knights": "frey", "frey-noble-princess": "freynobleprincess",
  "epindel-house-orlan": "epindel", "epindel-blessing-in-bloom": "epindelblessinginbloom"
};
const tycharaBySlug = () => new Map(tycharaData.characters.map((character) => [character.slug, character]));
const esprByRosterId = () => new Map(esprData.characters.map((character) => [character.rosterId, character]));

function char(id) { return rosterById().get(id); }
function knowledge(id) { return knowledgeByRosterId().get(id); }
function esprFor(id) { return esprByRosterId().get(id) ?? null; }
function tycharFor(id) {
  const item = char(id);
  if (!item) return null;
  const slug = tycharaSlugOverrides[id] ?? item.name.toLowerCase().replace(/[^a-z]+/g, "");
  return tycharaBySlug().get(slug) ?? null;
}
function normalizedFor(ownerSlug, skill) {
  return normalizedSkills.skills.find((candidate) => candidate.ownerSlug === ownerSlug && candidate.type === (skill.type === "ultimate" ? "hyper" : skill.type) && candidate.name === skill.name) ?? null;
}
function displayName(id) { return esprFor(id)?.nameZh ?? char(id)?.name ?? id; }
function titleFor(id) { return esprFor(id)?.factionZh ?? char(id)?.title ?? ""; }

function loadCharacterOverrides() {
  try { characterOverrides = sanitizeOverrides(JSON.parse(localStorage.getItem(characterOverridesStorageKey) ?? "{}")); }
  catch { characterOverrides = sanitizeOverrides({}); }
}

function loadMatchHistory() {
  try { matchHistory = sanitizeMatchHistory(JSON.parse(localStorage.getItem(matchHistoryStorageKey) ?? "{}")); }
  catch { matchHistory = createEmptyMatchHistory(); }
}

function persistMatchHistory() {
  localStorage.setItem(matchHistoryStorageKey, JSON.stringify(matchHistory));
}

function validMatchCount() {
  return matchHistory.matches.filter((match) => match.patch === state.patch && match.region === state.region && match.result.status !== "invalid" && match.result.winner !== "unknown").length;
}

function setSelectedWinner(winner) {
  selectedWinner = winner;
  dom.resultWinnerButtons.forEach((button) => button.classList.toggle("active", button.dataset.resultWinner === winner));
}

function renderMatchResult() {
  const complete = getDraftProgress(state).complete;
  dom.resultPanel.hidden = !complete;
  if (!complete) {
    resultFormDraftId = null;
    return;
  }
  const existing = findMatchByDraftId(matchHistory, state.draftId);
  if (resultFormDraftId !== state.draftId) {
    setSelectedWinner(existing?.result.winner ?? "unknown");
    dom.resultStatus.value = existing?.result.status ?? "completed";
    dom.resultDuration.value = existing?.result.durationSeconds == null ? "" : String(Math.round(existing.result.durationSeconds / 60));
    dom.resultNotes.value = existing?.result.notes ?? "";
    resultFormDraftId = state.draftId;
  } else {
    setSelectedWinner(selectedWinner);
  }
  const validCount = validMatchCount();
  dom.historySummary.textContent = validCount > 0
    ? `本机已有 ${validCount} 局有效结果参与推荐校准；未知结果和无效对局不会计入。`
    : "本机还没有可用于校准的对局结果。";
  dom.resultState.textContent = existing
    ? `已保存 · ${new Date(existing.recordedAt).toLocaleString("zh-CN")}`
    : "尚未保存";
  dom.resultState.classList.toggle("saved", Boolean(existing));
}

function saveMatchResult(event) {
  event.preventDefault();
  if (!getDraftProgress(state).complete) return;
  const durationText = dom.resultDuration.value.trim();
  const durationMinutes = durationText === "" ? null : Number(durationText);
  if (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes < 0)) {
    showToast("对局时长必须是大于或等于 0 的数字");
    return;
  }
  try {
    const record = createMatchRecord(state, {
      winner: selectedWinner,
      status: dom.resultStatus.value,
      durationSeconds: durationMinutes == null ? null : Math.round(durationMinutes * 60),
      notes: dom.resultNotes.value.trim()
    }, characterOverrides);
    matchHistory = upsertMatchRecord(matchHistory, record);
    persistMatchHistory();
    resultFormDraftId = null;
    render();
    showToast("对局结果已保存，并已用于后续推荐校准");
  } catch (error) {
    showToast(`保存失败：${error.message}`);
  }
}

function exportMatchHistory() {
  const blob = new Blob([JSON.stringify(matchHistory, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `star-savior-match-history-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function initialState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.patch === roster.patch && parsed.region === roster.region && parsed.rules?.turnStages?.length === rules.turnStages.length) return parsed;
    } catch { /* ignore stale local state */ }
  }
  return createDraftState({ draftId: `desktop-${Date.now()}`, patch: roster.patch, region: roster.region, rules });
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  dom.saveState.textContent = "本局已保存";
  window.clearTimeout(persist.timer);
  persist.timer = window.setTimeout(() => { dom.saveState.textContent = "本局自动保存"; }, 1100);
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { dom.toast.hidden = true; }, 2600);
}

function stageFor(index = state.stageIndex) { return rules.turnStages?.[index] ?? null; }
function stageActionCount(index) { return state.history.filter((item) => item.stageIndex === index).length; }
function currentStageText() {
  if (getDraftProgress(state).complete) return ["完成", "Draft 已记录完成", "双方阵容与末轮禁用均已完成。"];
  const stage = stageFor();
  if (!stage) return ["准备", "等待 Draft", ""];
  if (stage.id === "opening-ban") return ["同时禁用", "首轮禁用", "双方各禁用 1 名角色。两边动作都记录后进入选人。"];
  if (stage.id === "closing-ban") return ["同时禁用", "末轮禁用", "双方从对方已选角色中各禁用 1 名。"];
  const side = state.currentSide === "ally" ? "我方" : state.currentSide === "enemy" ? "对方" : "待确定";
  return ["轮到操作", `${side}选择 ${stage.count ?? stage.countPerSide ?? 1} 人`, `当前阶段：${stageLabels[state.stageIndex] ?? "Draft"}。`];
}

function renderStageTrack() {
  dom.stageTrack.replaceChildren();
  rules.turnStages.forEach((stage, index) => {
    const item = document.createElement("div");
    item.className = `stage ${index < state.stageIndex ? "done" : ""} ${index === state.stageIndex ? "current" : ""}`;
    const count = stageActionCount(index);
    const total = stage.count ?? ((stage.countPerSide ?? 1) * (stage.sides?.length ?? 1));
    item.innerHTML = `<span class="stage-label">${stageLabels[index]}</span><span class="stage-count">${Math.min(count, total)} / ${total}</span>`;
    dom.stageTrack.append(item);
  });
}

function renderPhase() {
  const [kicker, title, detail] = currentStageText();
  dom.phaseKicker.textContent = kicker;
  dom.phaseTitle.textContent = title;
  dom.phaseDetail.textContent = detail;
  dom.version.textContent = `亚服 · ${roster.patch} · ${state.draftId.slice(0, 14)}`;
  renderStageTrack();
  dom.firstPickerButtons.forEach((button) => button.classList.toggle("active", state.firstPicker === button.dataset.firstPicker));
}

function resolveActionSide(candidates) {
  const legalSides = new Set(candidates.map((candidate) => candidate.side));
  if (state.currentSide) actionSide = state.currentSide;
  else if (!legalSides.has(actionSide)) actionSide = [...legalSides][0] ?? actionSide;
  dom.actionSideControl.hidden = legalSides.size < 2;
  dom.actionSideButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.actionSide === actionSide);
    button.disabled = !legalSides.has(button.dataset.actionSide);
  });
}

function renderStatus(candidates) {
  const risks = summarizeDraftRisks(state, roster, knowledgeBase, { esprData });
  const stage = stageFor();
  const legalSides = [...new Set(candidates.map((candidate) => candidate.side))];
  dom.status.className = "status-strip";
  if (getDraftProgress(state).complete) {
    dom.status.classList.add("success");
    dom.status.textContent = "本局 Draft 已完成，可以导出记录或开始下一局。";
    return;
  }
  if (stage?.side === "first" && !state.firstPicker) {
    dom.status.classList.add("warning");
    dom.status.textContent = "首轮禁用完成后，请记录游戏显示的随机首选方。";
    return;
  }
  if (legalSides.length > 1) {
    dom.status.textContent = `同时阶段：请选择“记录操作方”，再点击角色。当前可记录 ${candidates.length} 个动作。`;
  } else if (legalSides.length === 1) {
    dom.status.textContent = `${legalSides[0] === "ally" ? "我方" : "对方"}可操作角色 ${candidates.length} 个。点击角色立即记录，Ctrl+Z 可撤销。`;
  } else {
    dom.status.classList.add("warning");
    dom.status.textContent = risks[0]?.message ?? "当前没有合法动作。";
  }
}

function portrait(id, small = false) {
  const box = document.createElement("div");
  box.className = `portrait ${small ? "small" : ""}`;
  const source = esprFor(id)?.portraitUrl ?? tycharFor(id)?.iconUrl ?? imageMap[id];
  if (source) {
    const image = document.createElement("img");
    image.src = source;
    image.alt = displayName(id);
    image.loading = "lazy";
    image.onerror = () => { image.remove(); box.textContent = displayName(id).slice(0, 1); };
    box.append(image);
  } else box.textContent = displayName(id).slice(0, 1);
  return box;
}

function showDetail(id) {
  const item = char(id);
  const localized = esprFor(id);
  const data = localized ?? tycharFor(id);
  if (!item || !data) {
    showToast("当前角色暂无公开详情页资料");
    return;
  }
  selectedDetailId = id;
  loadCharacterOverrides();
  const characterOverride = getCharacterOverride(characterOverrides, id);
  dom.detailName.textContent = `${displayName(id)} · ${titleFor(id)}`;
  dom.detailKicker.textContent = `${item.rarity} · ${labels.element[item.element] ?? item.element} · ${labels.class[item.class] ?? item.class}`;
  dom.detailProfile.textContent = localized?.profileZh || data.profileEn || "公开角色页未提供简介。";
  const sourceName = localized ? "ESPR 中文数据库" : "Tychara";
  dom.detailSource.textContent = Object.keys(characterOverride.equipment).length || Object.keys(characterOverride.skills).length
    ? `资料来源：${sourceName} · 已应用本机编辑覆盖`
    : `资料来源：${sourceName} · ${data.lastUpdated ?? "公开页面"}`;
  dom.detailArt.src = localized?.fullArtUrl ?? data.fullArtUrl;
  dom.detailArt.alt = `${displayName(id)} 全身像`;
  dom.detailArt.onerror = () => { dom.detailArt.removeAttribute("src"); dom.detailArt.alt = "全身像加载失败"; };
  dom.detailStats.replaceChildren();
  const statLabels = { attack: "攻击", vitality: "生命（知识库）", hp: "生命", defense: "防御", speed: "速度", criticalHitRate: "暴击率", criticalDamage: "暴击伤害", effectHit: "效果命中", effectResistance: "效果抵抗", hitRate: "命中率" };
  const percentStats = new Set(["criticalHitRate", "criticalDamage", "effectHit", "effectResistance", "hitRate"]);
  const baseStats = { ...(item.stats ?? {}), ...(data.stats ?? {}) };
  for (const [key, label] of Object.entries(statLabels)) {
    if (baseStats[key] == null && characterOverride.equipment?.[key] == null) continue;
    const base = Number(baseStats[key] ?? 0);
    const modifier = getEquipmentModifier(characterOverrides, id, key);
    const total = getStatTotal(base, modifier);
    const unit = percentStats.has(key) ? "%" : "";
    const stat = document.createElement("div");
    stat.className = "stat-item";
    const labelNode = document.createElement("span"); labelNode.textContent = label;
    const valueNode = document.createElement("strong"); valueNode.textContent = `${base}${unit} ${modifier >= 0 ? "+" : ""}${modifier}${unit} = ${total}${unit}`;
    stat.append(labelNode, valueNode);
    dom.detailStats.append(stat);
  }
  dom.detailSkills.replaceChildren();
  if (!data.skills?.length) {
    const empty = document.createElement("p"); empty.className = "no-detail"; empty.textContent = "该公开页面当前没有可读取的技能条目。"; dom.detailSkills.append(empty);
  } else {
    for (const skill of data.skills) {
      const skillIndex = data.skills.indexOf(skill);
      const legacyData = tycharFor(id);
      const fallbackSkill = legacyData?.skills?.[skillIndex];
      const skillName = skill.name ?? skill.nameZh ?? skill.type;
      const normalized = skill.name ? normalizedFor(data.slug, skill) : null;
      const overrideSkill = fallbackSkill ?? { ...skill, name: skillName };
      const custom = characterOverride.skills?.[skillOverrideKey(legacyData?.slug ?? data.slug, overrideSkill)]
        ?? characterOverride.skills?.[skillOverrideKey(data.slug, { ...skill, name: skillName })] ?? {};
      const displaySkillName = custom.nameZh?.trim() ? `${custom.nameZh.trim()}（${skillName}）` : skill.nameZh ?? skill.name ?? skill.type;
      const displayDescription = custom.descriptionZh?.trim() || skill.descriptionZh || skill.descriptionEn || fallbackSkill?.descriptionEn || (skill.levelDescZh === "基本效果" ? "暂无技能说明。" : skill.levelDescZh) || "暂无技能说明。";
      const row = document.createElement("article"); row.className = "skill-row";
      const icon = document.createElement("img"); icon.src = skill.iconUrl; icon.alt = displaySkillName; row.append(icon);
      const copy = document.createElement("div");
      const nameNode = document.createElement("strong"); nameNode.textContent = displaySkillName;
      const metaNode = document.createElement("small");
      const tags = normalized?.tags?.length ? ` · ${normalized.tags.join(" / ")}` : "";
      const cooldown = normalized?.cooldown == null ? "冷却未从基础描述读取" : `冷却 ${normalized.cooldown} 回合`;
      metaNode.textContent = `${skill.banner || skill.type} · 目标 ${normalized?.target ?? "unknown"} · ${cooldown}${tags}`;
      const descriptionNode = document.createElement("p"); descriptionNode.textContent = displayDescription;
      copy.append(nameNode, metaNode, descriptionNode); row.append(copy); dom.detailSkills.append(row);
    }
  }
  dom.detailModal.hidden = false;
  dom.closeDetail.focus();
}
function closeDetail() {
  dom.detailModal.hidden = true;
}

function renderSlots(container, ids, emptyLabel, removedIds = []) {
  container.replaceChildren();
  for (let index = 0; index < 5; index += 1) {
    const id = ids[index];
    const slot = document.createElement("div");
    slot.className = `team-slot ${id ? "filled" : "empty"} ${id && removedIds.includes(id) ? "removed" : ""}`;
    const number = document.createElement("span");
    number.className = "slot-number";
    number.textContent = String(index + 1).padStart(2, "0");
    slot.append(number);
    if (id) {
      slot.append(portrait(id, true));
      const content = document.createElement("div");
      content.className = "slot-content";
      content.innerHTML = `<strong>${displayName(id)}</strong><small>${removedIds.includes(id) ? "末轮已禁用" : titleFor(id)}</small>`;
      slot.append(content);
    } else {
      const content = document.createElement("div");
      content.className = "slot-content";
      content.innerHTML = `<small>${emptyLabel}</small>`;
      slot.append(content);
    }
    container.append(slot);
  }
}

function renderBans(container, ids) {
  container.replaceChildren();
  for (const id of ids) {
    const chip = document.createElement("div");
    chip.className = "ban-chip";
    chip.append(portrait(id, true));
    const name = document.createElement("strong");
    name.textContent = displayName(id);
    chip.append(name);
    container.append(chip);
  }
}

function renderTeams() {
  renderSlots(dom.allyPicks, state.allyPicks, "等待我方选择", state.enemyBans);
  renderSlots(dom.enemyPicks, state.enemyPicks, "等待对方选择", state.allyBans);
  renderBans(dom.allyBans, state.allyBans);
  renderBans(dom.enemyBans, state.enemyBans);
  dom.allyCount.textContent = `${state.allyPicks.length} / 5`;
  dom.enemyCount.textContent = `${state.enemyPicks.length} / 5`;
}

function filteredCharacters() {
  const query = dom.search.value.trim().toLowerCase();
  return roster.characters.filter((item) => {
    const matchesQuery = !query || `${displayName(item.id)} ${titleFor(item.id)} ${item.name} ${item.title}`.toLowerCase().includes(query);
    return matchesQuery && (dom.element.value === "all" || item.element === dom.element.value) && (dom.classFilter.value === "all" || item.class === dom.classFilter.value);
  });
}


function renderRecommendations() {
  if (!dom.recommendations) return;
  const candidates = getDraftCandidates(state, roster, knowledgeBase, { esprData });
  const side = state.currentSide ?? actionSide ?? candidates[0]?.side;
  const items = getDraftRecommendations(state, roster, knowledgeBase, { side, normalizedSkills, tycharaData, esprData, overrides: characterOverrides, matchHistory, limit: 3 });
  dom.recommendations.replaceChildren();
  if (getDraftProgress(state).complete || items.length === 0) { dom.recommendations.hidden = true; return; }
  dom.recommendations.hidden = false;
  const heading = document.createElement("div"); heading.className = "recommendation-heading";
  const title = document.createElement("strong"); title.id = "recommendation-title"; title.textContent = `推荐${state.phase === "ban" ? "禁用" : "选择"} · ${side === "ally" ? "我方" : "对方"}`;
  const note = document.createElement("small"); note.textContent = "规则评分，不代表胜率；点击角色可查看依据数据。"; heading.append(title, note); dom.recommendations.append(heading);
  const list = document.createElement("div"); list.className = "recommendation-list";
  for (const item of items) {
    const card = document.createElement("article"); card.className = "recommendation-card";
    const action = document.createElement("button"); action.type = "button"; action.className = "recommendation-card-action"; action.addEventListener("click", () => showDetail(item.rosterId));
    const name = document.createElement("strong"); name.textContent = displayName(item.rosterId);
    const score = document.createElement("span"); score.className = "recommendation-score"; score.textContent = `${item.score} 分`;
    const role = document.createElement("small"); role.textContent = titleFor(item.rosterId);
    const reasons = document.createElement("ul");
    for (const reason of item.reasons.slice(0, 3)) { const reasonNode = document.createElement("li"); reasonNode.textContent = reason; reasons.append(reasonNode); }
    action.append(name, score, role, reasons); card.append(action);
    if (item.risk) { const risk = document.createElement("small"); risk.className = "recommendation-risk"; risk.textContent = `风险：${item.risk}`; card.append(risk); }
    list.append(card);
  }
  dom.recommendations.append(list);
}

function renderRoster() {
  const candidates = getDraftCandidates(state, roster, knowledgeBase, { esprData });
  resolveActionSide(candidates);
  const legalIds = new Set(candidates.filter((candidate) => candidate.side === actionSide).map((candidate) => candidate.rosterId));
  const visible = filteredCharacters();
  dom.grid.replaceChildren();
  dom.empty.hidden = visible.length > 0;
  for (const item of visible) {
    const data = knowledge(item.id);
    const esprCharacter = esprFor(item.id);
    const publicData = esprCharacter ?? tycharFor(item.id);
    const hasEsprSkills = Boolean(esprCharacter?.skills?.length);
    const hasPublicSkills = Boolean(publicData?.skills?.length);
    const hasStructuredSkills = Boolean(data?.skills?.length);
    const card = document.createElement("article");
    const canAct = legalIds.has(item.id);
    card.className = `roster-card ${hasPublicSkills || hasStructuredSkills ? "known" : ""} ${canAct ? "" : "disabled"}`;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "card-action";
    action.disabled = !canAct;
    action.title = canAct ? `记录${state.phase === "ban" ? "禁用" : "选择"}：${displayName(item.id)}` : "当前阶段不可操作";
    action.innerHTML = `<div class="card-top"><span class="rarity">${item.rarity}</span><span>${labels.element[item.element] ?? item.element}</span></div>`;
    action.append(portrait(item.id));
    const dataLabel = hasStructuredSkills ? "结构化技能" : hasEsprSkills ? "ESPR中文技能" : hasPublicSkills ? "公开技能" : "资料占位";
    action.insertAdjacentHTML("beforeend", `<strong class="card-name">${displayName(item.id)}</strong><span class="card-title">${titleFor(item.id)}</span><span class="card-meta"><span>${labels.class[item.class] ?? item.class}</span><span>${hasPublicSkills || hasStructuredSkills ? `<i class="knowledge-dot"></i>${dataLabel}` : dataLabel}</span></span>`);
    action.addEventListener("click", () => recordAction(item.id));
    card.append(action);
    const detail = document.createElement("button");
    detail.type = "button";
    detail.className = "card-detail";
    detail.textContent = "i";
    detail.title = `查看 ${displayName(item.id)} 的全身像与技能`;
    detail.setAttribute("aria-label", `查看 ${displayName(item.id)} 的全身像与技能`);
    detail.addEventListener("click", () => showDetail(item.id));
    card.append(detail);
    dom.grid.append(card);
  }
  renderStatus(candidates);
}

function render() {
  const candidates = getDraftCandidates(state, roster, knowledgeBase, { esprData });
  renderPhase();
  renderTeams();
  renderRoster();
  renderRecommendations();
  renderMatchResult();
  dom.undo.disabled = state.history.length === 0;
  dom.app.setAttribute("aria-busy", "false");
}

function recordAction(rosterId) {
  try {
    state = applyDraftAction(state, { type: state.phase, side: actionSide, rosterId }, roster);
    persist();
    render();
  } catch (error) {
    showToast(error.message.replace(/^Draft 动作不合法：/, ""));
  }
}

function changeFirstPicker(side) {
  try {
    state = setFirstPicker(state, side);
    actionSide = side;
    persist();
    render();
  } catch (error) { showToast(error.message); }
}

function resetDraft() {
  if (!window.confirm("确定新建一局 Draft 吗？当前记录会被清除。")) return;
  state = createDraftState({ draftId: `desktop-${Date.now()}`, patch: roster.patch, region: roster.region, rules });
  actionSide = "ally";
  persist();
  render();
}

function bindEvents() {
  window.addEventListener("storage", (event) => {
    if (event.key === characterOverridesStorageKey) { loadCharacterOverrides(); if (selectedDetailId && !dom.detailModal.hidden) showDetail(selectedDetailId); }
    if (event.key === matchHistoryStorageKey) { loadMatchHistory(); resultFormDraftId = null; render(); }
  });
  dom.firstPickerButtons.forEach((button) => button.addEventListener("click", () => changeFirstPicker(button.dataset.firstPicker)));
  dom.actionSideButtons.forEach((button) => button.addEventListener("click", () => { actionSide = button.dataset.actionSide; render(); }));
  [dom.search, dom.element, dom.classFilter].forEach((control) => control.addEventListener("input", renderRoster));
  dom.undo.addEventListener("click", () => { state = undoDraftAction(state); persist(); render(); });
  dom.reset.addEventListener("click", resetDraft);
  dom.resultWinnerButtons.forEach((button) => button.addEventListener("click", () => setSelectedWinner(button.dataset.resultWinner)));
  dom.resultForm.addEventListener("submit", saveMatchResult);
  dom.exportHistory.addEventListener("click", exportMatchHistory);
  dom.closeDetail.addEventListener("click", closeDetail);
  document.querySelector("[data-close-detail]").addEventListener("click", closeDetail);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== dom.search) { event.preventDefault(); dom.search.focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (!dom.undo.disabled) dom.undo.click(); }
  });
}

async function boot() {
  [roster, knowledgeBase, tycharaData, esprData, normalizedSkills, rules] = await Promise.all([
    fetch("/data/roster.asia-2026-09-17.json").then((response) => response.json()),
    fetch("/data/knowledge-base.json").then((response) => response.json()),
    fetch("/data/tychara.characters.json").then((response) => response.json()),
    fetch("/data/espr.characters.zh-CN.json").then((response) => response.json()),
    fetch("/data/skills.normalized.json").then((response) => response.json()),
    fetch("/data/draft-rules.asia-ranked.json").then((response) => response.json())
  ]);
  loadCharacterOverrides();
  loadMatchHistory();
  state = initialState();
  bindEvents();
  render();
}

boot().catch((error) => {
  dom.phaseTitle.textContent = "载入失败";
  dom.phaseDetail.textContent = error.message;
  dom.status.className = "status-strip warning";
  dom.status.textContent = "请确认使用 npm run dev 启动本地服务。";
});
