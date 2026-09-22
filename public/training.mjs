import { buildCatBoostDataset } from "/src/training/catboost-dataset.mjs";
import { createEmptyMatchHistory, sanitizeMatchHistory } from "/src/matches/match-history.mjs";
import { inspectMatchHistory } from "/src/matches/match-quality.mjs";

const storageKey = "star-savior-bp-match-history-v1";
const dom = {
  version: document.querySelector("#training-version"), patch: document.querySelector("#training-patch"), region: document.querySelector("#training-region"), refresh: document.querySelector("#refresh-training"), export: document.querySelector("#export-training"),
  total: document.querySelector("#training-total"), eligible: document.querySelector("#training-eligible"), rows: document.querySelector("#training-rows"), issues: document.querySelector("#training-issues"), qualityCaption: document.querySelector("#quality-caption"), qualityList: document.querySelector("#quality-list"), previewCaption: document.querySelector("#preview-caption"), body: document.querySelector("#training-rows-body"), empty: document.querySelector("#training-empty")
};
let history = createEmptyMatchHistory();
let roster;
let dataset;

function loadHistory() {
  try { history = sanitizeMatchHistory(JSON.parse(localStorage.getItem(storageKey) ?? "{}")); }
  catch { history = createEmptyMatchHistory(); }
}

function optionValues(select, values, current) {
  const previous = current ?? select.value;
  select.replaceChildren(new Option(select === dom.patch ? "全部版本" : "全部服务器", "all"));
  for (const value of values) select.append(new Option(value, value));
  select.value = values.includes(previous) ? previous : "all";
}

function selected(value) { return value === "all" ? undefined : value; }

function renderQuality(report) {
  dom.qualityList.replaceChildren();
  if (report.issues.length === 0) {
    const good = document.createElement("p"); good.className = "quality-good"; good.textContent = "未发现阻塞训练的问题。"; dom.qualityList.append(good);
  } else {
    for (const item of report.issues) {
      const row = document.createElement("div"); row.className = `quality-item ${item.severity}`;
      const title = document.createElement("strong"); title.textContent = item.message;
      const code = document.createElement("small"); code.textContent = `${item.code} · ${item.count} 条`;
      row.append(title, code); dom.qualityList.append(row);
    }
  }
  dom.qualityCaption.textContent = `${report.recordsKept} 条记录已解析，${report.trainingEligible} 条可生成训练样本`;
}

function renderRows() {
  dom.body.replaceChildren();
  const rows = dataset.rows.slice(0, 100);
  for (const item of rows) {
    const tr = document.createElement("tr");
    const cells = [item.phase, `${item.action_type} #${item.stage_index}`, item.action_side === "ally" ? "我方" : "对方", item.action_roster_id, item.visible_ally_picks, item.visible_enemy_picks, item.label === 1 ? "我方胜" : "对方胜", item.draft_id];
    for (const value of cells) { const td = document.createElement("td"); td.textContent = value; tr.append(td); }
    dom.body.append(tr);
  }
  dom.empty.hidden = rows.length > 0;
  dom.previewCaption.textContent = dataset.rows.length > 100 ? `显示前 100 / ${dataset.rows.length} 行` : `${dataset.rows.length} 行`;
}

function render() {
  const patch = selected(dom.patch.value);
  const region = selected(dom.region.value);
  const report = inspectMatchHistory(history, { patch, region, teamSize: 5 });
  dataset = buildCatBoostDataset(history, { patch, region });
  dom.total.textContent = report.recordsKept;
  dom.eligible.textContent = report.trainingEligible;
  dom.rows.textContent = dataset.summary.rows;
  dom.issues.textContent = report.issues.length;
  dom.version.textContent = `${patch ?? "全部版本"} · ${region ?? "全部服务器"}`;
  renderQuality(report);
  renderRows();
}

function exportTraining() {
  const blob = new Blob([dataset.tsv], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `star-savior-catboost-${new Date().toISOString().slice(0, 10)}.tsv`; link.click(); URL.revokeObjectURL(url);
}

async function boot() {
  roster = await fetch("/data/roster.asia-2026-09-17.json").then((response) => response.json());
  loadHistory();
  const patches = [...new Set(history.matches.map((match) => match.patch).filter(Boolean))];
  const regions = [...new Set(history.matches.map((match) => match.region).filter(Boolean))];
  optionValues(dom.patch, patches, roster.patch);
  optionValues(dom.region, regions, roster.region);
  render();
}

dom.patch.addEventListener("change", render);
dom.region.addEventListener("change", render);
dom.refresh.addEventListener("click", () => { loadHistory(); render(); });
dom.export.addEventListener("click", exportTraining);
window.addEventListener("storage", (event) => { if (event.key === storageKey) { loadHistory(); render(); } });
boot().catch((error) => { dom.version.textContent = `载入失败：${error.message}`; });
