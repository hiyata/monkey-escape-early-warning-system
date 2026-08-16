const CATEGORY_LABELS = {
  escape: "Escape",
  attack: "Attack / Bite",
  sighting: "Feral Sighting",
  lab_incident: "Lab Incident",
  trade_legal: "Trade / Legal"
};

// Validated 5-slot categorical palette (dark-surface, OKLab CVD-checked) —
// fixed hue-per-category, never reassigned by rank/sort order.
const CATEGORY_COLORS = {
  escape: "#3987e5",
  attack: "#d95926",
  sighting: "#199e70",
  lab_incident: "#c98500",
  trade_legal: "#d55181"
};
const CATEGORY_ORDER = ["escape", "attack", "sighting", "lab_incident", "trade_legal"];

const YEAR_BAR_COLOR = "#e0a52f";  // amber — single-series magnitude, no identity clash needed
const STATE_BAR_COLOR = "#3f8ae0"; // blue — single-series magnitude

const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, parent = null){
  const node = document.createElementNS(SVG_NS, tag);
  for(const [k,v] of Object.entries(attrs)) node.setAttribute(k, v);
  if(parent) parent.appendChild(node);
  return node;
}

const tooltip = document.getElementById("tooltip");
function showTooltip(evt, valueText, labelText){
  tooltip.innerHTML = "";
  const v = document.createElement("span"); v.className = "tt-value"; v.textContent = valueText;
  const l = document.createElement("span"); l.className = "tt-label"; l.textContent = labelText;
  tooltip.appendChild(v); tooltip.appendChild(l);
  tooltip.hidden = false;
  moveTooltip(evt);
}
function moveTooltip(evt){
  const x = (evt.clientX ?? 0) + 14;
  const y = (evt.clientY ?? 0) + 14;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}
function hideTooltip(){ tooltip.hidden = true; }

/**
 * Renders a simple column (vertical bar) chart.
 * data: [{label, value, color}]
 */
function renderColumnChart(containerId, data, {maxBarWidth = 24, gap = 6, chartHeight = 220} = {}){
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const padTop = 24, padBottom = 34, padLeft = 8, padRight = 8;
  const slotWidth = Math.max(maxBarWidth + gap, Math.min(70, 700 / data.length));
  const barWidth = Math.min(maxBarWidth, slotWidth - gap);
  const width = data.length * slotWidth + padLeft + padRight;
  const plotHeight = chartHeight - padTop - padBottom;
  const maxVal = Math.max(1, ...data.map(d => d.value));

  const svg = el("svg", {viewBox: `0 0 ${width} ${chartHeight}`, width: "100%", height: chartHeight, role: "img", "aria-label": containerId + " chart"});
  container.appendChild(svg);

  // gridlines at 0/25/50/75/100% of max
  const steps = 4;
  for(let s = 0; s <= steps; s++){
    const y = padTop + plotHeight - (plotHeight * s / steps);
    el("line", {x1: padLeft, x2: width - padRight, y1: y, y2: y, class: "chart-gridline"}, svg);
  }

  data.forEach((d, i) => {
    const x = padLeft + i * slotWidth + (slotWidth - barWidth) / 2;
    const barHeight = maxVal > 0 ? (d.value / maxVal) * plotHeight : 0;
    const y = padTop + plotHeight - barHeight;

    const bar = el("rect", {
      x, y, width: barWidth, height: Math.max(barHeight, 1),
      rx: 4, ry: 4, fill: d.color, class: "chart-bar", tabindex: "0"
    }, svg);

    bar.addEventListener("pointermove", e => { showTooltip(e, String(d.value), d.label); });
    bar.addEventListener("pointerenter", e => { showTooltip(e, String(d.value), d.label); });
    bar.addEventListener("pointerleave", hideTooltip);
    bar.addEventListener("focus", e => {
      const rect = bar.getBoundingClientRect();
      showTooltip({clientX: rect.left, clientY: rect.top}, String(d.value), d.label);
    });
    bar.addEventListener("blur", hideTooltip);

    if(d.value > 0 && barHeight > 14){
      const label = el("text", {x: x + barWidth/2, y: y - 6, "text-anchor": "middle", class: "chart-value-label"}, svg);
      label.textContent = d.value;
    }

    const axisLabel = el("text", {x: x + barWidth/2, y: chartHeight - padBottom + 16, "text-anchor": "middle", class: "chart-axis-label"}, svg);
    axisLabel.textContent = d.label;
  });
}

/**
 * Renders a horizontal ranking bar chart.
 * data: [{label, value, color}] — already sorted by caller
 */
function renderRowChart(containerId, data, {barThickness = 18, gap = 10, rowLabelWidth = 90} = {}){
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const padLeft = rowLabelWidth, padRight = 50, padTop = 8, padBottom = 8;
  const rowHeight = barThickness + gap;
  const height = data.length * rowHeight + padTop + padBottom;
  const width = 640;
  const plotWidth = width - padLeft - padRight;
  const maxVal = Math.max(1, ...data.map(d => d.value));

  const svg = el("svg", {viewBox: `0 0 ${width} ${height}`, width: "100%", height, role: "img", "aria-label": containerId + " chart"});
  container.appendChild(svg);

  data.forEach((d, i) => {
    const y = padTop + i * rowHeight;
    const barWidth = maxVal > 0 ? (d.value / maxVal) * plotWidth : 0;

    const rowLabel = el("text", {x: padLeft - 10, y: y + barThickness/2 + 4, "text-anchor": "end", class: "chart-axis-label"}, svg);
    rowLabel.textContent = d.label;

    const bar = el("rect", {
      x: padLeft, y, width: Math.max(barWidth, 1), height: barThickness,
      rx: 4, ry: 4, fill: d.color, class: "chart-bar", tabindex: "0"
    }, svg);

    bar.addEventListener("pointermove", e => { showTooltip(e, String(d.value), d.label); });
    bar.addEventListener("pointerenter", e => { showTooltip(e, String(d.value), d.label); });
    bar.addEventListener("pointerleave", hideTooltip);
    bar.addEventListener("focus", e => {
      const rect = bar.getBoundingClientRect();
      showTooltip({clientX: rect.left, clientY: rect.top}, String(d.value), d.label);
    });
    bar.addEventListener("blur", hideTooltip);

    const valueLabel = el("text", {x: padLeft + barWidth + 8, y: y + barThickness/2 + 4, class: "chart-value-label"}, svg);
    valueLabel.textContent = d.value;
  });
}

function renderLegend(containerId, entries){
  const container = document.getElementById(containerId);
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  entries.forEach(({label, color}) => {
    const item = document.createElement("div");
    item.className = "chart-legend-item";
    const swatch = document.createElement("span");
    swatch.className = "chart-legend-swatch";
    swatch.style.background = color;
    const text = document.createElement("span");
    text.textContent = label;
    item.appendChild(swatch);
    item.appendChild(text);
    legend.appendChild(item);
  });
  container.appendChild(legend);
}

function renderTable(containerId, headers, rows){
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    r.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

function wireTableToggles(){
  document.querySelectorAll(".table-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      const nowHidden = !target.hidden;
      target.hidden = nowHidden;
      btn.textContent = nowHidden ? "View as table" : "View as chart";
      const chartWrap = target.previousElementSibling;
      if(chartWrap && chartWrap.classList.contains("chart-svg-wrap")){
        chartWrap.hidden = !nowHidden;
      }
    });
  });
}

function renderStatTiles(incidents){
  const container = document.getElementById("statTiles");
  const total = incidents.length;
  const totalMonkeys = incidents.reduce((s,i) => s + (i.count||1), 0);
  const years = incidents.map(i => i.dateStart.slice(0,4)).filter(Boolean).sort();
  const span = years.length ? `${years[0]}–${years[years.length-1]}` : "—";
  const stateCounts = {};
  incidents.forEach(i => { stateCounts[i.state] = (stateCounts[i.state]||0) + 1; });
  const topState = Object.entries(stateCounts).sort((a,b) => b[1]-a[1])[0];
  const confirmed = incidents.filter(i => i.tier === "confirmed").length;

  const tiles = [
    {label: "Total Incidents Logged", value: total},
    {label: "Total Monkeys Involved", value: totalMonkeys},
    {label: "Years Covered", value: span},
    {label: "Most Active State", value: topState ? `${topState[0]}` : "—", small: topState ? `${topState[1]} incidents` : ""},
    {label: "Confirmed Tier", value: `${confirmed}`, small: `of ${total} total`},
  ];

  container.innerHTML = "";
  tiles.forEach(t => {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    const label = document.createElement("div");
    label.className = "stat-label";
    label.textContent = t.label;
    const value = document.createElement("div");
    value.className = "stat-value";
    value.textContent = t.value;
    if(t.small){
      const small = document.createElement("small");
      small.textContent = " " + t.small;
      value.appendChild(small);
    }
    tile.appendChild(label);
    tile.appendChild(value);
    container.appendChild(tile);
  });
}

async function init(){
  const res = await fetch("data/incidents.json?v=" + Date.now(), {cache: "no-store"});
  const incidents = await res.json();

  renderStatTiles(incidents);

  // Incidents per year — include every year in range, even zero-count ones, so the trend reads honestly.
  const years = incidents.map(i => parseInt(i.dateStart.slice(0,4), 10));
  const minYear = Math.min(...years), maxYear = Math.max(...years);
  const yearCounts = {};
  incidents.forEach(i => { const y = i.dateStart.slice(0,4); yearCounts[y] = (yearCounts[y]||0) + 1; });
  const yearData = [];
  for(let y = minYear; y <= maxYear; y++){
    yearData.push({label: String(y), value: yearCounts[String(y)] || 0, color: YEAR_BAR_COLOR});
  }
  renderColumnChart("yearChart", yearData);
  renderTable("yearTable", ["Year", "Incidents"], yearData.map(d => [d.label, d.value]));

  // Incidents by category — fixed order, fixed color per category (identity, not rank)
  const catCounts = {};
  incidents.forEach(i => { const c = i.category || "escape"; catCounts[c] = (catCounts[c]||0) + 1; });
  const catData = CATEGORY_ORDER.map(c => ({
    label: CATEGORY_LABELS[c], value: catCounts[c] || 0, color: CATEGORY_COLORS[c]
  }));
  renderColumnChart("categoryChart", catData);
  renderLegend("categoryChart", CATEGORY_ORDER.map(c => ({label: CATEGORY_LABELS[c], color: CATEGORY_COLORS[c]})));
  renderTable("categoryTable", ["Category", "Incidents"], catData.map(d => [d.label, d.value]));

  // Top states
  const stateCounts = {};
  incidents.forEach(i => { stateCounts[i.state] = (stateCounts[i.state]||0) + 1; });
  const stateData = Object.entries(stateCounts)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 10)
    .map(([state, count]) => ({label: state, value: count, color: STATE_BAR_COLOR}));
  renderRowChart("stateChart", stateData);
  renderTable("stateTable", ["State", "Incidents"], stateData.map(d => [d.label, d.value]));

  wireTableToggles();
}

init();
