"use strict";

/* =====================================================================
   생산순서 최적화 방법 비교 — 화면 로직
   - results.csv(파이썬 export_for_web.py 결과)를 읽어서 표/그래프를 그린다.
   - 서버 없이 브라우저에서만 동작한다. (GitHub Pages 가능)
   ===================================================================== */

/* ---------- 상수 ---------- */
const REQUIRED = ["변형", "날짜", "최대 사용 칸 수"];
const FIELD = {
  scenario: "시나리오", method: "변형", date: "날짜",
  maxcells: "최대 사용 칸 수", avgcells: "평균 사용 칸 수(시간가중)",
  dd: "DD 처리 완료(h)", pd: "PD 처리 완료(h)", all: "전체 처리 완료(h)",
  obj3: "Obj3_완료시각합(h)", r50: "50%처리가능순번", idle: "피커유휴(h)",
};

const DESC = {
  baseline: "교수님이 주신 순서 (SKU 코드 오름차순)",
  R1: "SKU 코드 오름차순 (baseline과 동일)",
  R2: "그날 수량이 많은 SKU 먼저",
  R3: "그날 수량이 적은 SKU 먼저",
  R4: "생산시간이 짧은 SKU 먼저",
  R5: "많은 주문에 걸린 SKU 먼저",
  R6: "칸을 적게 쓰는 SKU 먼저",
  R7: "무작위 (바닥 기준)",
  V0: "그리디 기본형: 바로 완성되는 주문 수 → 동점은 코드순",
  V1: "그리디: 동점이면 생산시간 짧은 것",
  V2: "그리디: 동점이면 더 많은 주문에 걸린 것",
  V3: "그리디: 동점이면 칸을 적게 쓰는 것",
  V4: "그리디: 완성되는 DD 주문 2점, PD 주문 1점",
  V5: "그리디: 완성 직전 주문에도 1/(남은 SKU 수) 점수",
  L1: "V5에서 출발해 SKU 자리를 옮겨보며 개선 (언덕 오르기)",
  L2: "유전 알고리즘 (L1과 같은 채점 횟수)",
};

const GROUP_LABEL = { base: "기준", R: "규칙 정렬", V: "그리디", L: "탐색", X: "기타" };
const GROUP_ORDER = ["base", "R", "V", "L", "X"];
const PALETTE = {
  base: ["#111111"],
  R: ["#8a9099", "#a5abb3", "#bfc4cb", "#6d737b", "#cdd1d6", "#7b8189", "#b2b7be"],
  V: ["#c96f3b", "#e08a4f", "#f0a56e", "#a85a2c", "#d9a27a", "#f2c19c"],
  L: ["#1f6f8b", "#3b9ab5"],
  X: ["#7a5c99", "#9b7fb8", "#b9a2cf"],
};
const PRESET_CODES = ["baseline", "R2", "V0", "V2", "V5", "L2"];   // '대표' 버튼
const WD = ["일", "월", "화", "수", "목", "금", "토"];

/* ---------- 작은 유틸 ---------- */
function num(v) {
  if (v === undefined || v === null) return NaN;
  const s = String(v).trim();
  if (s === "" || s.toLowerCase() === "nan") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
const finite = (a) => a.filter(Number.isFinite);
const mean = (a) => { const b = finite(a); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : NaN; };
const maxOf = (a) => { const b = finite(a); return b.length ? Math.max(...b) : NaN; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (v, d) => Number.isFinite(v)
  ? v.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

function methodCode(name) { return String(name).split("_")[0]; }
function groupOf(name) {
  const c = methodCode(name);
  if (c === "baseline") return "base";
  if (/^R\d/.test(c)) return "R";
  if (/^V\d/.test(c)) return "V";
  if (/^L\d/.test(c)) return "L";
  return "X";
}
function sortMethods(list) {
  return [...list].sort((a, b) =>
    (GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b))) ||
    a.localeCompare(b, "ko", { numeric: true }));
}
function buildColors(methods) {
  const idx = {}, colors = {};
  for (const m of sortMethods(methods)) {
    const g = groupOf(m);
    idx[g] = idx[g] || 0;
    const pal = PALETTE[g];
    colors[m] = pal[idx[g] % pal.length];
    idx[g]++;
  }
  return colors;
}
function weekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
const shortDate = (s) => s.slice(5);                         // 2026-07-06 -> 07-06

/* ---------- CSV 읽기 ---------- */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = []; let row = [], cur = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c === "\r") { /* 무시 */ }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function decodeBuffer(buf) {
  let t = new TextDecoder("utf-8").decode(buf);
  if (!t.includes("변형") || t.includes("\uFFFD")) {          // 엑셀에서 저장한 CSV(cp949) 대응
    try {
      const k = new TextDecoder("euc-kr").decode(buf);
      if (k.includes("변형")) t = k;
    } catch (e) { /* 무시 */ }
  }
  return t;
}

function normalizeRows(table) {
  if (!table.length) return { rows: [], error: "빈 파일입니다." };
  const header = table[0].map((h) => h.trim());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], error: `필수 열이 없습니다: ${missing.join(", ")}. ` +
      `export_for_web.py 로 만든 results.csv 인지 확인하세요. (찾은 열: ${header.slice(0, 6).join(", ")}…)` };
  }
  const col = {};
  for (const [k, name] of Object.entries(FIELD)) col[k] = header.indexOf(name);
  const rows = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i];
    const get = (k) => (col[k] >= 0 ? r[col[k]] : undefined);
    const method = String(get("method") ?? "").trim();
    const date = String(get("date") ?? "").trim().slice(0, 10);
    if (!method || !date) continue;
    rows.push({
      scenario: (String(get("scenario") ?? "").trim()) || "기본",
      method, date,
      maxcells: num(get("maxcells")), avgcells: num(get("avgcells")),
      dd: num(get("dd")), pd: num(get("pd")), all: num(get("all")),
      obj3: num(get("obj3")), r50: num(get("r50")), idle: num(get("idle")),
    });
  }
  return rows.length ? { rows } : { rows: [], error: "읽을 수 있는 데이터 행이 없습니다." };
}

/* ---------- 집계 / 순위 ---------- */
const STATS = [
  { key: "maxOfMax", label: "월최대칸", d: 0, fn: (r) => maxOf(r.map((x) => x.maxcells)) },
  { key: "meanMax", label: "평균최대칸", d: 1, fn: (r) => mean(r.map((x) => x.maxcells)) },
  { key: "meanAvg", label: "평균칸(시간가중)", d: 1, fn: (r) => mean(r.map((x) => x.avgcells)) },
  { key: "dd", label: "DD완료(h)", d: 2, fn: (r) => mean(r.map((x) => x.dd)) },
  { key: "pd", label: "PD완료(h)", d: 2, fn: (r) => mean(r.map((x) => x.pd)) },
  { key: "all", label: "전체완료(h)", d: 2, fn: (r) => mean(r.map((x) => x.all)) },
  { key: "obj3", label: "Obj3(h)", d: 0, fn: (r) => mean(r.map((x) => x.obj3)) },
  { key: "r50", label: "50%순번", d: 1, fn: (r) => mean(r.map((x) => x.r50)) },
  { key: "idle", label: "피커유휴(h)", d: 1, fn: (r) => mean(r.map((x) => x.idle)) },
  { key: "over", label: "한도초과일수", d: 0, fn: (r, ctx) => r.filter((x) => x.maxcells > ctx.cap).length },
];
const STAT = Object.fromEntries(STATS.map((s) => [s.key, s]));
const DAY_METRICS = [
  { key: "maxcells", label: "최대 사용 칸 수", d: 0 },
  { key: "avgcells", label: "평균 사용 칸 수(시간가중)", d: 1 },
  { key: "dd", label: "DD 처리 완료(h)", d: 2 },
  { key: "pd", label: "PD 처리 완료(h)", d: 2 },
  { key: "all", label: "전체 처리 완료(h)", d: 2 },
  { key: "obj3", label: "Obj3 (완료시각 합, h)", d: 0 },
  { key: "r50", label: "50% 처리 가능 순번", d: 0 },
  { key: "idle", label: "피커 유휴(h)", d: 1 },
];

function aggregate(rows, { scenario, methods, dates, cap }) {
  const dset = new Set(dates), mset = new Set(methods), by = new Map();
  for (const r of rows) {
    if (r.scenario !== scenario || !mset.has(r.method) || !dset.has(r.date)) continue;
    if (!by.has(r.method)) by.set(r.method, []);
    by.get(r.method).push(r);
  }
  const out = [];
  for (const [method, rs] of by) {
    const stats = {};
    for (const s of STATS) stats[s.key] = s.fn(rs, { cap });
    out.push({ method, n: new Set(rs.map((x) => x.date)).size, stats });
  }
  return out;
}

function rankMethods(aggs, criteria) {
  const cmp = (a, b) => {
    for (const k of criteria) {
      const x = a.stats[k], y = b.stats[k];
      const xn = Number.isNaN(x), yn = Number.isNaN(y);
      if (xn && yn) continue;
      if (xn) return 1;
      if (yn) return -1;
      if (Math.abs(x - y) > 1e-9) return x - y;
    }
    return a.method.localeCompare(b.method, "ko", { numeric: true });
  };
  return [...aggs].sort(cmp).map((a, i) => ({ ...a, rank: i + 1 }));
}

function perDay(rows, { scenario, method, dates, metric }) {
  const map = new Map();
  for (const r of rows) if (r.scenario === scenario && r.method === method) map.set(r.date, r[metric]);
  return dates.map((d) => (map.has(d) ? map.get(d) : NaN));
}

/* ---------- SVG 그래프 ---------- */
function niceTicks(min, max, n = 5) {
  if (!(max > min)) return [min];
  const raw = (max - min) / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

function barSVG(items, { cap = null, d = 0 } = {}) {
  const W = 960, L = 210, R = 90, rowH = 30, top = 30, bottom = 30;
  const H = top + items.length * rowH + bottom;
  const vals = finite(items.map((i) => i.value));
  const maxV = Math.max(...vals, cap || 0, 1) * 1.08;
  const x = (v) => L + (W - L - R) * (v / maxV);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="방법별 비교 막대그래프">`;
  for (const t of niceTicks(0, maxV, 5)) {
    s += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - bottom}"/>` +
         `<text class="tick" x="${x(t)}" y="${H - bottom + 18}" text-anchor="middle">${fmt(t, 0)}</text>`;
  }
  items.forEach((it, i) => {
    const y = top + i * rowH, w = Number.isFinite(it.value) ? Math.max(x(it.value) - L, 0) : 0;
    s += `<text class="lbl${it.isBase ? " base" : ""}" x="${L - 10}" y="${y + rowH / 2 + 5}" text-anchor="end">${esc(it.name)}</text>` +
         `<rect x="${L}" y="${y + 5}" width="${w}" height="${rowH - 10}" rx="3" fill="${it.color}"><title>${esc(it.name)}: ${fmt(it.value, d)}</title></rect>` +
         `<text class="val" x="${L + w + 8}" y="${y + rowH / 2 + 5}">${fmt(it.value, d)}</text>`;
  });
  if (cap && cap > 0 && cap < maxV) {
    s += `<line class="cap" x1="${x(cap)}" x2="${x(cap)}" y1="${top}" y2="${H - bottom}"/>` +
         `<text class="captxt" x="${x(cap)}" y="${top - 10}" text-anchor="middle">선반 한도 ${fmt(cap, 0)}칸</text>`;
  }
  return s + "</svg>";
}

function lineSVG(series, dates, { cap = null, d = 0 } = {}) {
  const W = 960, H = 400, L = 62, R = 24, T = 18, B = 62;
  const all = finite(series.flatMap((s) => s.values));
  if (!all.length) return `<p class="empty">표시할 값이 없습니다.</p>`;
  let lo = Math.min(...all), hi = Math.max(...all);
  if (cap && cap > 0) { lo = Math.min(lo, cap); hi = Math.max(hi, cap); }
  const pad = (hi - lo || 1) * 0.08;
  lo = Math.max(0, lo - pad); hi = hi + pad;
  const x = (i) => L + (dates.length > 1 ? (W - L - R) * (i / (dates.length - 1)) : (W - L - R) / 2);
  const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 추이 선그래프">`;
  for (const t of niceTicks(lo, hi, 5)) {
    s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>` +
         `<text class="tick" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t, d > 0 && hi - lo < 20 ? 1 : 0)}</text>`;
  }
  const every = Math.ceil(dates.length / 14);
  dates.forEach((dt, i) => {
    if (i % every) return;
    s += `<text class="tick" transform="translate(${x(i)},${H - B + 16}) rotate(-40)" text-anchor="end">${shortDate(dt)}(${WD[weekday(dt)]})</text>`;
  });
  if (cap && cap > 0) {
    s += `<line class="cap" x1="${L}" x2="${W - R}" y1="${y(cap)}" y2="${y(cap)}"/>` +
         `<text class="captxt" x="${W - R - 4}" y="${y(cap) - 6}" text-anchor="end">선반 한도 ${fmt(cap, 0)}칸</text>`;
  }
  for (const se of series) {
    let path = "", pen = false;
    se.values.forEach((v, i) => {
      if (!Number.isFinite(v)) { pen = false; return; }
      path += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true;
    });
    s += `<path d="${path}" fill="none" stroke="${se.color}" stroke-width="${se.isBase ? 3 : 2}" ${se.isBase ? 'stroke-dasharray="6 4"' : ""}/>`;
    se.values.forEach((v, i) => {
      if (Number.isFinite(v)) s += `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${se.color}"><title>${esc(se.name)} · ${dates[i]} · ${fmt(v, d)}</title></circle>`;
    });
  }
  return s + "</svg>";
}

/* Node(테스트)에서 불러 쓸 수 있게 내보내기 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseCSV, normalizeRows, aggregate, rankMethods, perDay, groupOf, sortMethods,
                     buildColors, decodeBuffer, STATS, barSVG, lineSVG, methodCode, weekday, niceTicks };
}

/* =====================================================================
   화면 (브라우저에서만)
   ===================================================================== */
if (typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", initUI);
}

function initUI() {
  const $ = (s) => document.querySelector(s);
  const S = {
    rows: [], scenarios: [], scenario: "", allMethods: [], allDates: [],
    selMethods: new Set(), selDates: new Set(), colors: {},
    crit: ["maxOfMax", "meanMax", "dd"], cap: 200,
    barMetric: "maxOfMax", barSort: "rank", lineMetric: "maxcells", hidden: new Set(),
    isSample: false, source: "",
  };

  /* ----- 데이터 넣기 ----- */
  function setData(text, source, isSample) {
    const parsed = normalizeRows(parseCSV(text));
    const msg = $("#loadMsg");
    if (parsed.error) { msg.className = "load-msg err"; msg.textContent = parsed.error; return false; }
    S.rows = parsed.rows; S.isSample = !!isSample; S.source = source;
    S.scenarios = [...new Set(S.rows.map((r) => r.scenario))];
    S.scenario = S.scenarios[0];
    S.allMethods = sortMethods([...new Set(S.rows.map((r) => r.method))]);
    S.allDates = [...new Set(S.rows.map((r) => r.date))].sort();
    S.colors = buildColors(S.allMethods);
    S.selDates = new Set(S.allDates);
    S.selMethods = new Set(S.allMethods.filter((m) => PRESET_CODES.includes(methodCode(m))));
    if (S.selMethods.size < 2) S.selMethods = new Set(S.allMethods);
    S.hidden = new Set();
    msg.className = "load-msg ok";
    msg.textContent = `${source} — ${S.rows.length.toLocaleString()}행, 방법 ${S.allMethods.length}개, 날짜 ${S.allDates.length}일, 시나리오 ${S.scenarios.length}개`;
    buildControls(); render();
    return true;
  }

  async function loadFile(file) {
    const buf = await file.arrayBuffer();
    setData(decodeBuffer(buf), file.name, false);
  }

  async function autoLoad() {
    try {
      const res = await fetch("data/results.csv", { cache: "no-store" });
      if (res.ok) { setData(decodeBuffer(await res.arrayBuffer()), "data/results.csv", false); return; }
    } catch (e) { /* file:// 등에서는 실패 → 아래 샘플 */ }
    if (typeof window.SAMPLE_CSV === "string") { setData(window.SAMPLE_CSV, "샘플 데이터", true); return; }
    $("#loadMsg").className = "load-msg err";
    $("#loadMsg").textContent = "데이터가 없습니다. 위 상자에 results.csv 를 끌어다 놓으세요.";
    $("#main").classList.add("nodata");
  }

  /* ----- 컨트롤 만들기 ----- */
  function optionList(items, sel) {
    return items.map((o) => `<option value="${esc(o.key)}"${o.key === sel ? " selected" : ""}>${esc(o.label)}</option>`).join("");
  }

  function buildControls() {
    $("#main").classList.remove("nodata");
    const sc = $("#scenario");
    sc.innerHTML = S.scenarios.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    sc.value = S.scenario;
    $("#scenarioWrap").hidden = S.scenarios.length < 2;

    [1, 2, 3].forEach((n, i) => { $("#crit" + n).innerHTML = optionList(STATS, S.crit[i]); });
    $("#barMetric").innerHTML = optionList(STATS, S.barMetric);
    $("#lineMetric").innerHTML = optionList(DAY_METRICS, S.lineMetric);
    $("#cap").value = S.cap;

    const mbox = $("#methodBox");
    mbox.innerHTML = "";
    for (const g of GROUP_ORDER) {
      const list = S.allMethods.filter((m) => groupOf(m) === g);
      if (!list.length) continue;
      const wrap = document.createElement("div");
      wrap.className = "mgroup";
      wrap.innerHTML = `<div class="mgroup-h">${GROUP_LABEL[g]}</div>` + list.map((m) =>
        `<label class="chk" title="${esc(DESC[methodCode(m)] || "")}">` +
        `<input type="checkbox" data-m="${esc(m)}"${S.selMethods.has(m) ? " checked" : ""}>` +
        `<span class="dot" style="background:${S.colors[m]}"></span>${esc(m)}</label>`).join("");
      mbox.appendChild(wrap);
    }
    mbox.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
      inp.checked ? S.selMethods.add(inp.dataset.m) : S.selMethods.delete(inp.dataset.m);
      render();
    }));

    const dbox = $("#dateBox");
    dbox.innerHTML = S.allDates.map((d) =>
      `<label class="chk small"><input type="checkbox" data-d="${d}"${S.selDates.has(d) ? " checked" : ""}>` +
      `${shortDate(d)} <em>${WD[weekday(d)]}</em></label>`).join("");
    dbox.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", () => {
      inp.checked ? S.selDates.add(inp.dataset.d) : S.selDates.delete(inp.dataset.d);
      render();
    }));
  }

  function syncChecks() {
    document.querySelectorAll("#methodBox input").forEach((i) => { i.checked = S.selMethods.has(i.dataset.m); });
    document.querySelectorAll("#dateBox input").forEach((i) => { i.checked = S.selDates.has(i.dataset.d); });
  }

  /* ----- 그리기 ----- */
  function render() {
    if (!S.rows.length) return;
    const dates = S.allDates.filter((d) => S.selDates.has(d));
    const methods = S.allMethods.filter((m) => S.selMethods.has(m));
    const aggs = aggregate(S.rows, { scenario: S.scenario, methods, dates, cap: S.cap });
    const ranked = rankMethods(aggs, S.crit);
    const base = ranked.find((r) => groupOf(r.method) === "base");
    const c1 = STAT[S.crit[0]];

    $("#subtitle").textContent =
      `시나리오: ${S.scenario} · 날짜 ${dates.length}일 · 방법 ${ranked.length}개 · 판정 기준: ` +
      S.crit.map((k) => STAT[k].label).join(" → ");
    const banner = $("#banner");
    banner.hidden = !S.isSample;
    banner.textContent = "샘플 데이터입니다. 임시 크기표로 만든 값이라 실제 결과가 아니에요. data/results.csv 를 올리면 이 표시는 사라져요.";

    /* KPI */
    const kp = $("#kpis");
    if (!ranked.length) {
      kp.innerHTML = `<div class="kpi wide"><b>선택한 조건에 맞는 데이터가 없어요</b><span>방법과 날짜를 하나 이상 선택하세요.</span></div>`;
    } else {
      const best = ranked[0];
      const delta = base && Number.isFinite(base.stats[c1.key]) && base.stats[c1.key] !== 0 && best !== base
        ? (best.stats[c1.key] - base.stats[c1.key]) / base.stats[c1.key] * 100 : null;
      const overB = base ? base.stats.over : null, overT = ranked[0].stats.over, nd = dates.length;
      kp.innerHTML =
        `<div class="kpi"><span>1위 방법</span><b>${esc(best.method)}</b><small>${c1.label} ${fmt(best.stats[c1.key], c1.d)}</small></div>` +
        `<div class="kpi"><span>baseline 대비 (${c1.label})</span><b class="${delta !== null && delta < 0 ? "good" : ""}">${delta === null ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(1) + "%"}</b>` +
        `<small>${base ? "baseline " + fmt(base.stats[c1.key], c1.d) : "baseline 미선택"}</small></div>` +
        `<div class="kpi"><span>선반 ${fmt(S.cap, 0)}칸 초과 일수</span><b>${fmt(overT, 0)} / ${nd}일</b>` +
        `<small>${overB === null ? "baseline 미선택" : "baseline " + fmt(overB, 0) + " / " + nd + "일"}</small></div>` +
        `<div class="kpi"><span>비교 대상</span><b>${ranked.length}개 방법</b><small>${dates.length}일 · ${esc(S.scenario)}</small></div>`;
    }

    /* 표 */
    const cols = ["maxOfMax", "meanMax", "meanAvg", "dd", "pd", "all", "obj3", "r50", "over"];
    const th = (k) => { const i = S.crit.indexOf(k); return `<th class="num${i >= 0 ? " crit" : ""}">${STAT[k].label}${i >= 0 ? `<sup>${i + 1}</sup>` : ""}</th>`; };
    $("#rankTable").innerHTML =
      `<thead><tr><th>순위</th><th>방법</th>${cols.map(th).join("")}<th class="num">날짜수</th><th class="num">baseline 대비<sup>${c1.label}</sup></th></tr></thead><tbody>` +
      ranked.map((r) => {
        const b = base && base !== r && base.stats[c1.key] ? (r.stats[c1.key] - base.stats[c1.key]) / base.stats[c1.key] * 100 : null;
        return `<tr class="${groupOf(r.method) === "base" ? "is-base" : ""}"><td>${r.rank}</td>` +
          `<td title="${esc(DESC[methodCode(r.method)] || "")}"><span class="dot" style="background:${S.colors[r.method]}"></span>${esc(r.method)}</td>` +
          cols.map((k) => `<td class="num${S.crit.includes(k) ? " crit" : ""}">${fmt(r.stats[k], STAT[k].d)}</td>`).join("") +
          `<td class="num${r.n !== dates.length ? " warn" : ""}">${r.n}</td>` +
          `<td class="num ${b !== null && b < 0 ? "good" : ""}">${b === null ? "—" : (b > 0 ? "+" : "") + b.toFixed(1) + "%"}</td></tr>`;
      }).join("") + "</tbody>";

    /* 막대 그래프 */
    const bm = STAT[S.barMetric];
    let items = ranked.map((r) => ({ name: r.method, value: r.stats[bm.key], color: S.colors[r.method], isBase: groupOf(r.method) === "base" }));
    if (S.barSort === "value") items.sort((a, b) => (Number.isNaN(a.value) - Number.isNaN(b.value)) || a.value - b.value);
    const capOn = S.barMetric === "maxOfMax" || S.barMetric === "meanMax";
    $("#barChart").innerHTML = items.length ? barSVG(items, { cap: capOn ? S.cap : null, d: bm.d }) : "";

    /* 선 그래프 */
    const lm = DAY_METRICS.find((m) => m.key === S.lineMetric);
    const series = ranked.filter((r) => !S.hidden.has(r.method)).map((r) => ({
      name: r.method, color: S.colors[r.method], isBase: groupOf(r.method) === "base",
      values: perDay(S.rows, { scenario: S.scenario, method: r.method, dates, metric: lm.key }),
    }));
    $("#lineChart").innerHTML = ranked.length ? lineSVG(series, dates, { cap: lm.key === "maxcells" ? S.cap : null, d: lm.d }) : "";
    $("#legend").innerHTML = ranked.map((r) =>
      `<button type="button" class="leg${S.hidden.has(r.method) ? " off" : ""}" data-m="${esc(r.method)}">` +
      `<span class="dot" style="background:${S.colors[r.method]}"></span>${esc(r.method)}</button>`).join("");
    $("#legend").querySelectorAll(".leg").forEach((b) => b.addEventListener("click", () => {
      S.hidden.has(b.dataset.m) ? S.hidden.delete(b.dataset.m) : S.hidden.add(b.dataset.m);
      render();
    }));

    /* 주의 문구 */
    const notes = [
      "판정 기준은 설정의 1→2→3순위 순서대로 값이 낮은 방법이 앞서요. 결과를 보기 전에 정해두는 게 좋아요.",
      "생산시간이 임의 값이라 절대 시간보다 baseline 대비 비율로 읽는 게 안전해요.",
      "탐색(L1, L2)은 판정 기준과 같은 점수를 직접 줄이는 방법이라 그 지표에서 유리해요. 그리디로 충분한지 보는 용도예요.",
      `선반 한도(${fmt(S.cap, 0)}칸)는 회의에서 나온 실제 선반 개수이고, 시뮬레이터 코드에는 없는 값이에요.`,
    ];
    const uneven = ranked.some((r) => r.n !== dates.length);
    if (uneven) notes.push("날짜수가 선택한 날짜 수와 다른 방법이 있어요(표에서 주황색). 방법끼리 평균을 그대로 비교하면 안 돼요.");
    $("#notes").innerHTML = "<h2>읽을 때 주의</h2><ul>" + notes.map((n) => `<li>${esc(n)}</li>`).join("") + "</ul>";
  }

  /* ----- 이벤트 ----- */
  $("#scenario").addEventListener("change", (e) => { S.scenario = e.target.value; render(); });
  [1, 2, 3].forEach((n, i) => $("#crit" + n).addEventListener("change", (e) => { S.crit[i] = e.target.value; render(); }));
  $("#cap").addEventListener("input", (e) => { const v = Number(e.target.value); S.cap = Number.isFinite(v) && v >= 0 ? v : 200; render(); });
  $("#barMetric").addEventListener("change", (e) => { S.barMetric = e.target.value; render(); });
  $("#barSort").addEventListener("change", (e) => { S.barSort = e.target.value; render(); });
  $("#lineMetric").addEventListener("change", (e) => { S.lineMetric = e.target.value; render(); });

  const setMethods = (fn) => { S.selMethods = new Set(S.allMethods.filter(fn)); syncChecks(); render(); };
  $("#mPreset").addEventListener("click", () => setMethods((m) => PRESET_CODES.includes(methodCode(m))));
  $("#mAll").addEventListener("click", () => setMethods(() => true));
  $("#mNone").addEventListener("click", () => setMethods(() => false));
  $("#mNoRandom").addEventListener("click", () => setMethods((m) => methodCode(m) !== "R7"));
  const setDates = (fn) => { S.selDates = new Set(S.allDates.filter(fn)); syncChecks(); render(); };
  $("#dAll").addEventListener("click", () => setDates(() => true));
  $("#dMon").addEventListener("click", () => setDates((d) => weekday(d) === 1));
  $("#dWeek").addEventListener("click", () => setDates((d) => weekday(d) >= 1 && weekday(d) <= 5));
  $("#dNone").addEventListener("click", () => setDates(() => false));

  $("#fileInput").addEventListener("change", (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ""; });
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) loadFile(f); });

  $("#btnPresent").addEventListener("click", () => document.body.classList.add("present"));
  $("#btnExit").addEventListener("click", () => document.body.classList.remove("present"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.body.classList.remove("present"); });

  autoLoad();
}
