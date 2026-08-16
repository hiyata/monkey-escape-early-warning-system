const STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
];

const STORAGE_KEY = "meews_community_reports";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

let map, markerLayer;
let allIncidents = [];

async function loadIncidents(){
  const res = await fetch("data/incidents.json");
  const base = await res.json();
  const community = loadCommunityReports();
  return [...base, ...community];
}

function loadCommunityReports(){
  try{
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  }catch(e){
    return [];
  }
}

function saveCommunityReport(report){
  const list = loadCommunityReports();
  list.push(report);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function initMap(){
  map = L.map("map", {scrollWheelZoom:false}).setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 18
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function colorFor(incident){
  if(incident.tier === "reported") return "#e0a52f";
  if(incident.status === "at_large") return "#e0332f";
  return "#8891a0";
}

function renderMap(incidents){
  markerLayer.clearLayers();
  incidents.forEach(inc => {
    const color = colorFor(inc);
    const circle = L.circle([inc.lat, inc.lng], {
      radius: (inc.radiusKm || 10) * 1000,
      color: color,
      fillColor: color,
      fillOpacity: 0.18,
      weight: inc.status === "at_large" ? 2 : 1,
      dashArray: inc.tier === "reported" ? "4,4" : null
    }).addTo(markerLayer);

    const marker = L.circleMarker([inc.lat, inc.lng], {
      radius: 6,
      color: "#fff",
      weight: 1,
      fillColor: color,
      fillOpacity: 1
    }).addTo(markerLayer);

    const popupHtml = `
      <h3>${escapeHtml(inc.title)}</h3>
      <p>${inc.city}, ${inc.state} — ${formatDateRange(inc)}</p>
      <p>${escapeHtml(inc.summary)}</p>
      <p><strong>${(inc.tier||"").toUpperCase()}</strong> · ${CATEGORY_LABELS[inc.category] || "Escape"} · ${(inc.status||"").replace("_"," ").toUpperCase()} · ${inc.count || 1} monkey(s)</p>
      ${inc.sourceUrl ? `<p><a href="${inc.sourceUrl}" target="_blank" rel="noopener">Source: ${escapeHtml(inc.sourceName || "link")}</a></p>` : ""}
    `;
    marker.bindPopup(popupHtml);
    circle.bindPopup(popupHtml);
  });
}

function formatDateRange(inc){
  const start = inc.dateStart;
  const end = inc.dateEnd;
  if(!end || end === start) return start;
  return `${start} → ${end}`;
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function computeThreatLevel(incidents){
  const activeMajor = incidents.filter(i => i.status === "at_large" && i.severity === "major").length;
  const activeAny = incidents.filter(i => i.status === "at_large").length;
  const recentReported = incidents.filter(i => i.tier === "reported").length;

  if(activeMajor > 0) return {level:"severe", label:"SEVERE — MULTIPLE PRIMATES AT LARGE"};
  if(activeAny > 0) return {level:"high", label:"HIGH — PRIMATE(S) CURRENTLY AT LARGE"};
  if(recentReported > 3) return {level:"elevated", label:"ELEVATED — UNVERIFIED SIGHTING CLUSTER"};
  if(recentReported > 0) return {level:"guarded", label:"GUARDED — ISOLATED REPORTS UNDER REVIEW"};
  return {level:"low", label:"LOW — NO PRIMATES CURRENTLY AT LARGE"};
}

function renderThreatMeter(incidents){
  const {level, label} = computeThreatLevel(incidents);
  const el = document.getElementById("threatValue");
  el.textContent = label;
  el.className = "threat-value level-" + level;
}

function renderStatLine(incidents){
  const confirmed = incidents.filter(i => i.tier === "confirmed").length;
  const reported = incidents.filter(i => i.tier === "reported").length;
  const total = incidents.reduce((sum,i) => sum + (i.count||1), 0);
  const years = allIncidents.map(i => i.dateStart.slice(0,4)).filter(Boolean).sort();
  const earliest = years[0] || "2015";
  document.getElementById("statLine").textContent =
    `Tracking ${confirmed} confirmed incident${confirmed===1?"":"s"} and ${reported} community report${reported===1?"":"s"} since ${earliest} · ${total} monkeys logged total`;
}

const TICKER_PX_PER_SEC = 45; // constant reading speed regardless of how much text is in the feed

function renderTicker(incidents){
  const items = [...incidents]
    .sort((a,b) => new Date(b.dateStart) - new Date(a.dateStart))
    .slice(0, 12)
    .map(i => `${(i.category||"").toUpperCase() || (i.tier||"").toUpperCase()}: ${i.title} — ${i.city}, ${i.state} (${i.dateStart})`);
  const text = items.length ? items.join("     ///     ") : "NO INCIDENTS IN DATABASE";
  const track = document.getElementById("tickertapeTrack");
  track.textContent = "🐒 " + text + "     ///     🐒 " + text;

  // Recompute animation duration from actual rendered width so the scroll speed
  // (px/sec) stays constant as the feed grows, instead of a fixed duration
  // that gets unreadably fast once there are many incidents.
  track.style.animation = "none";
  const width = track.scrollWidth;
  track.style.animation = "";
  const duration = Math.max(30, width / TICKER_PX_PER_SEC);
  track.style.animationDuration = duration + "s";
}

function populateFilters(incidents){
  const yearSel = document.getElementById("yearFilter");
  const years = [...new Set(incidents.map(i => i.dateStart.slice(0,4)))].sort();
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y; opt.textContent = y;
    yearSel.appendChild(opt);
  });

  const monthSel = document.getElementById("monthFilter");
  MONTHS.forEach((m, idx) => {
    const opt = document.createElement("option");
    opt.value = String(idx+1).padStart(2,"0");
    opt.textContent = m;
    monthSel.appendChild(opt);
  });

  const stateSel = document.getElementById("rState");
  STATES.forEach(([abbr, name]) => {
    const opt = document.createElement("option");
    opt.value = abbr; opt.textContent = `${name} (${abbr})`;
    stateSel.appendChild(opt);
  });
}

const CATEGORY_LABELS = {
  escape: "Escape",
  attack: "Attack / Bite",
  sighting: "Feral Sighting",
  lab_incident: "Lab Incident",
  trade_legal: "Trade / Legal"
};

function activeCategoryFilters(){
  return [...document.querySelectorAll(".category-filter:checked")].map(el => el.value);
}

function applyFilters(){
  const year = document.getElementById("yearFilter").value;
  const month = document.getElementById("monthFilter").value;
  const showConfirmed = document.getElementById("showConfirmed").checked;
  const showReported = document.getElementById("showReported").checked;
  const activeCategories = activeCategoryFilters();

  const filtered = allIncidents.filter(i => {
    const [iy, im] = i.dateStart.split("-");
    if(year !== "all" && iy !== year) return false;
    if(month !== "all" && im !== month) return false;
    if(i.tier === "confirmed" && !showConfirmed) return false;
    if(i.tier === "reported" && !showReported) return false;
    if(!activeCategories.includes(i.category || "escape")) return false;
    return true;
  });

  renderMap(filtered);
  renderIncidentList(filtered);
  renderStatLine(filtered);
}

function renderIncidentList(incidents){
  const list = document.getElementById("incidentList");
  list.innerHTML = "";
  const sorted = [...incidents].sort((a,b) => new Date(b.dateStart) - new Date(a.dateStart));

  if(sorted.length === 0){
    list.innerHTML = `<p style="color:var(--text-dim);font-size:12px;">No incidents match this filter.</p>`;
    return;
  }

  sorted.forEach(inc => {
    const card = document.createElement("div");
    card.className = `incident-card tier-${inc.tier} severity-${inc.severity||"minor"}`;
    card.innerHTML = `
      <span class="badge ${inc.tier}">${(inc.tier||"").toUpperCase()}</span>
      <span class="badge category-${inc.category||"escape"}">${CATEGORY_LABELS[inc.category] || "Escape"}</span>
      <span class="badge ${inc.status}">${(inc.status||"").replace("_"," ").toUpperCase()}</span>
      ${inc.severity === "major" ? '<span class="badge major">MAJOR</span>' : ""}
      <h3>${escapeHtml(inc.title)}</h3>
      <div class="meta">${inc.city}, ${inc.state} · ${formatDateRange(inc)} · ${inc.count||1} monkey(s)</div>
      <div class="meta">${escapeHtml(inc.summary)}</div>
    `;
    card.addEventListener("click", () => {
      map.setView([inc.lat, inc.lng], 8);
    });
    list.appendChild(card);
  });
}

function wireReportForm(){
  const backdrop = document.getElementById("reportModalBackdrop");
  const openBtn = document.getElementById("reportBtn");
  const closeBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelReport");
  const form = document.getElementById("reportForm");

  const open = () => { backdrop.classList.add("open"); };
  const close = () => { backdrop.classList.remove("open"); };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);
  backdrop.addEventListener("click", e => { if(e.target === backdrop) close(); });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const city = document.getElementById("rCity").value.trim();
    const state = document.getElementById("rState").value;
    const date = document.getElementById("rDate").value;
    const count = parseInt(document.getElementById("rCount").value, 10) || 1;
    const desc = document.getElementById("rDesc").value.trim();
    const name = document.getElementById("rName").value.trim() || "Anonymous";
    const category = document.getElementById("rCategory").value;

    const coords = approxCoordsForState(state);

    const report = {
      id: "community-" + Date.now(),
      title: `Community Report: ${city}, ${state}`,
      dateStart: date,
      dateEnd: date,
      city, state,
      lat: coords.lat + (Math.random()-0.5)*0.4,
      lng: coords.lng + (Math.random()-0.5)*0.4,
      tier: "reported",
      status: "at_large",
      category,
      count,
      severity: "minor",
      radiusKm: 15,
      summary: `${desc} (Submitted by ${name}. Unverified — for entertainment purposes.)`,
      sourceName: "Community submission",
      sourceUrl: ""
    };

    saveCommunityReport(report);
    allIncidents.push(report);
    populateYearOptionIfNeeded(date.slice(0,4));
    applyFilters();
    renderThreatMeter(allIncidents);
    renderTicker(allIncidents);
    form.reset();
    close();
  });
}

function populateYearOptionIfNeeded(year){
  const yearSel = document.getElementById("yearFilter");
  const exists = [...yearSel.options].some(o => o.value === year);
  if(!exists){
    const opt = document.createElement("option");
    opt.value = year; opt.textContent = year;
    yearSel.appendChild(opt);
  }
}

// Rough state-center coordinates for placing community reports without a geocoder
const STATE_CENTERS = {
  AL:[32.8,-86.8],AK:[64.2,-149.4],AZ:[34.0,-111.6],AR:[34.9,-92.4],CA:[37.2,-119.4],
  CO:[38.9,-105.5],CT:[41.6,-72.7],DE:[39.0,-75.4],FL:[28.6,-82.4],GA:[32.9,-83.4],
  HI:[20.8,-156.3],ID:[44.4,-114.6],IL:[40.0,-89.2],IN:[39.9,-86.2],IA:[42.0,-93.5],
  KS:[38.5,-98.4],KY:[37.5,-85.3],LA:[31.0,-92.0],ME:[45.4,-69.2],MD:[39.0,-76.7],
  MA:[42.3,-71.8],MI:[44.3,-85.6],MN:[46.3,-94.3],MS:[32.7,-89.7],MO:[38.5,-92.5],
  MT:[47.0,-109.6],NE:[41.5,-99.8],NV:[39.3,-116.6],NH:[43.7,-71.6],NJ:[40.1,-74.7],
  NM:[34.4,-106.1],NY:[42.9,-75.5],NC:[35.6,-79.4],ND:[47.5,-100.5],OH:[40.4,-82.8],
  OK:[35.5,-97.5],OR:[44.0,-120.5],PA:[40.9,-77.7],RI:[41.7,-71.5],SC:[33.9,-80.9],
  SD:[44.4,-100.2],TN:[35.9,-86.4],TX:[31.5,-99.3],UT:[39.3,-111.7],VT:[44.0,-72.7],
  VA:[37.5,-78.8],WA:[47.4,-120.5],WV:[38.6,-80.6],WI:[44.6,-89.9],WY:[43.0,-107.5]
};
function approxCoordsForState(abbr){
  const c = STATE_CENTERS[abbr] || [39.5,-98.35];
  return {lat:c[0], lng:c[1]};
}

(async function start(){
  initMap();
  allIncidents = await loadIncidents();
  populateFilters(allIncidents);
  wireReportForm();
  document.getElementById("yearFilter").addEventListener("change", applyFilters);
  document.getElementById("monthFilter").addEventListener("change", applyFilters);
  document.getElementById("showConfirmed").addEventListener("change", applyFilters);
  document.getElementById("showReported").addEventListener("change", applyFilters);
  document.querySelectorAll(".category-filter").forEach(el => el.addEventListener("change", applyFilters));

  renderThreatMeter(allIncidents);
  renderStatLine(allIncidents);
  renderTicker(allIncidents);
  applyFilters();
})();
