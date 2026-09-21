import {
  applyDraftAction,
  createDraftState,
  getDraftProgress,
  setFirstPicker,
  undoDraftAction
} from "/src/draft/draft-state.mjs";
import { getDraftCandidates, summarizeDraftRisks } from "/src/draft/rule-engine.mjs";

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

const dom = {
  app: document.querySelector("#app"), version: document.querySelector("#version-label"),
  saveState: document.querySelector("#save-state"), undo: document.querySelector("#undo-button"), reset: document.querySelector("#reset-button"),
  phaseKicker: document.querySelector("#phase-kicker"), phaseTitle: document.querySelector("#phase-title"), phaseDetail: document.querySelector("#phase-detail"),
  stageTrack: document.querySelector("#stage-track"), firstPickerButtons: [...document.querySelectorAll("[data-first-picker]")],
  actionSideControl: document.querySelector("#action-side-control"), actionSideButtons: [...document.querySelectorAll("[data-action-side]")],
  search: document.querySelector("#search-input"), element: document.querySelector("#element-filter"), classFilter: document.querySelector("#class-filter"),
  status: document.querySelector("#status-strip"), grid: document.querySelector("#roster-grid"), empty: document.querySelector("#empty-state"),
  allyPicks: document.querySelector("#ally-picks"), enemyPicks: document.querySelector("#enemy-picks"), allyBans: document.querySelector("#ally-bans"), enemyBans: document.querySelector("#enemy-bans"),
  allyCount: document.querySelector("#ally-count"), enemyCount: document.querySelector("#enemy-count"), toast: document.querySelector("#toast"),
  detailModal: document.querySelector("#detail-modal"), detailArt: document.querySelector("#detail-art"), detailKicker: document.querySelector("#detail-kicker"), detailName: document.querySelector("#detail-name"), detailProfile: document.querySelector("#detail-profile"), detailStats: document.querySelector("#detail-stats"), detailSource: document.querySelector("#detail-source"), detailSkills: document.querySelector("#detail-skills"), closeDetail: document.querySelector("#close-detail")
};

let roster;
let knowledgeBase;
let tycharaData;
let normalizedSkills;
let rules;
let state;
let actionSide = "ally";
let toastTimer;

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

function char(id) { return rosterById().get(id); }
function knowledge(id) { return knowledgeByRosterId().get(id); }
function tycharFor(id) {
  const item = char(id);
  if (!item) return null;
  const slug = tycharaSlugOverrides[id] ?? item.name.toLowerCase().replace(/[^a-z]+/g, "");
  return tycharaBySlug().get(slug) ?? null;
}
function normalizedFor(ownerSlug, skill) {
  return normalizedSkills.skills.find((candidate) => candidate.ownerSlug === ownerSlug && candidate.type === (skill.type === "ultimate" ? "hyper" : skill.type) && candidate.name === skill.name) ?? null;
}
function displayName(id) { return char(id)?.name ?? id; }
function titleFor(id) { return char(id)?.title ?? ""; }

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
  const risks = summarizeDraftRisks(state, roster, knowledgeBase);
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
  const source = tycharFor(id)?.iconUrl ?? imageMap[id];
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
  const data = tycharFor(id);
  if (!item || !data) {
    showToast("当前角色暂无 Tychara 详情页资料");
    return;
  }
  dom.detailName.textContent = `${item.name} · ${item.title}`;
  dom.detailKicker.textContent = `${item.rarity} · ${labels.element[item.element] ?? item.element} · ${labels.class[item.class] ?? item.class}`;
  dom.detailProfile.textContent = data.profileEn || "Tychara 公开角色页未提供简介。";
  dom.detailSource.textContent = `资料来源：Tychara · ${data.lastUpdated ?? "公开页面"}`;
  dom.detailArt.src = data.fullArtUrl;
  dom.detailArt.alt = `${item.name} 全身像`;
  dom.detailArt.onerror = () => { dom.detailArt.removeAttribute("src"); dom.detailArt.alt = "全身像加载失败"; };
  dom.detailStats.replaceChildren();
  const statLabels = { attack: "攻击", vitality: "生命", defense: "防御", speed: "速度", criticalHitRate: "暴击率", criticalDamage: "暴击伤害", effectHit: "效果命中", effectResistance: "效果抵抗" };
  for (const [key, label] of Object.entries(statLabels)) {
    if (data.stats?.[key] == null) continue;
    const stat = document.createElement("div");
    stat.className = "stat-item";
    stat.innerHTML = `<span>${label}</span><strong>${data.stats[key]}${key.includes("Rate") || key.includes("Damage") || key.includes("Hit") || key.includes("Resistance") ? "%" : ""}</strong>`;
    dom.detailStats.append(stat);
  }
  dom.detailSkills.replaceChildren();
  if (!data.skills?.length) {
    const empty = document.createElement("p");
    empty.className = "no-detail";
    empty.textContent = "该公开页面当前没有可读取的技能条目。";
    dom.detailSkills.append(empty);
  } else {
    for (const skill of data.skills) {
      const normalized = normalizedFor(data.slug, skill);
      const row = document.createElement("article");
      row.className = "skill-row";
      const icon = document.createElement("img");
      icon.src = skill.iconUrl;
      icon.alt = skill.name;
      row.append(icon);
      const copy = document.createElement("div");
      const tags = normalized?.tags?.length ? ` · ${normalized.tags.join(" / ")}` : "";
      const cooldown = normalized?.cooldown == null ? "冷却未从基础描述读取" : `冷却 ${normalized.cooldown} 回合`;
      copy.innerHTML = `<strong>${skill.name}</strong><small>${skill.banner || skill.type} · 目标 ${normalized?.target ?? "unknown"} · ${cooldown}${tags}</small><p>${skill.descriptionEn || "暂无英文说明。"}</p>`;
      row.append(copy);
      dom.detailSkills.append(row);
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
    const matchesQuery = !query || `${item.name} ${item.title}`.toLowerCase().includes(query);
    return matchesQuery && (dom.element.value === "all" || item.element === dom.element.value) && (dom.classFilter.value === "all" || item.class === dom.classFilter.value);
  });
}

function renderRoster() {
  const candidates = getDraftCandidates(state, roster, knowledgeBase);
  resolveActionSide(candidates);
  const legalIds = new Set(candidates.filter((candidate) => candidate.side === actionSide).map((candidate) => candidate.rosterId));
  const visible = filteredCharacters();
  dom.grid.replaceChildren();
  dom.empty.hidden = visible.length > 0;
  for (const item of visible) {
    const data = knowledge(item.id);
    const publicData = tycharFor(item.id);
    const hasPublicSkills = Boolean(publicData?.skills?.length);
    const hasStructuredSkills = Boolean(data?.skills?.length);
    const card = document.createElement("article");
    const canAct = legalIds.has(item.id);
    card.className = `roster-card ${hasPublicSkills || hasStructuredSkills ? "known" : ""} ${canAct ? "" : "disabled"}`;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "card-action";
    action.disabled = !canAct;
    action.title = canAct ? `记录${state.phase === "ban" ? "禁用" : "选择"}：${item.name}` : "当前阶段不可操作";
    action.innerHTML = `<div class="card-top"><span class="rarity">${item.rarity}</span><span>${labels.element[item.element] ?? item.element}</span></div>`;
    action.append(portrait(item.id));
    const dataLabel = hasStructuredSkills ? "结构化技能" : hasPublicSkills ? "公开技能" : "资料占位";
    action.insertAdjacentHTML("beforeend", `<strong class="card-name">${item.name}</strong><span class="card-title">${item.title}</span><span class="card-meta"><span>${labels.class[item.class] ?? item.class}</span><span>${hasPublicSkills || hasStructuredSkills ? `<i class="knowledge-dot"></i>${dataLabel}` : dataLabel}</span></span>`);
    action.addEventListener("click", () => recordAction(item.id));
    card.append(action);
    const detail = document.createElement("button");
    detail.type = "button";
    detail.className = "card-detail";
    detail.textContent = "i";
    detail.title = `查看 ${item.name} 的全身像与技能`;
    detail.setAttribute("aria-label", `查看 ${item.name} 的全身像与技能`);
    detail.addEventListener("click", () => showDetail(item.id));
    card.append(detail);
    dom.grid.append(card);
  }
  renderStatus(candidates);
}

function render() {
  const candidates = getDraftCandidates(state, roster, knowledgeBase);
  renderPhase();
  renderTeams();
  renderRoster();
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
  dom.firstPickerButtons.forEach((button) => button.addEventListener("click", () => changeFirstPicker(button.dataset.firstPicker)));
  dom.actionSideButtons.forEach((button) => button.addEventListener("click", () => { actionSide = button.dataset.actionSide; renderRoster(); }));
  [dom.search, dom.element, dom.classFilter].forEach((control) => control.addEventListener("input", renderRoster));
  dom.undo.addEventListener("click", () => { state = undoDraftAction(state); persist(); render(); });
  dom.reset.addEventListener("click", resetDraft);
  dom.closeDetail.addEventListener("click", closeDetail);
  document.querySelector("[data-close-detail]").addEventListener("click", closeDetail);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== dom.search) { event.preventDefault(); dom.search.focus(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (!dom.undo.disabled) dom.undo.click(); }
  });
}

async function boot() {
  [roster, knowledgeBase, tycharaData, normalizedSkills, rules] = await Promise.all([
    fetch("/data/roster.asia-2026-09-17.json").then((response) => response.json()),
    fetch("/data/knowledge-base.json").then((response) => response.json()),
    fetch("/data/tychara.characters.json").then((response) => response.json()),
    fetch("/data/skills.normalized.json").then((response) => response.json()),
    fetch("/data/draft-rules.asia-ranked.json").then((response) => response.json())
  ]);
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
