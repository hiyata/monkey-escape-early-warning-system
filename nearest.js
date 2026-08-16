const TYPE_LABELS = {
  zoo: "Zoo",
  sanctuary: "Sanctuary",
  research_facility: "Research Facility"
};

let map, resultLayer;
let facilities = [];

function initMap(){
  map = L.map("nearestMap").setView([39.5, -98.35], 4);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxZoom: 18
  }).addTo(map);
  resultLayer = L.layerGroup().addTo(map);
}

// Haversine great-circle distance in miles
function distanceMiles(lat1, lng1, lat2, lng2){
  const R = 3958.8; // Earth radius in miles
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function geocode(address){
  // Photon (komoot) is used instead of Nominatim directly: Nominatim's public
  // instance doesn't reliably send CORS headers for browser-based requests,
  // while Photon is built for client-side use and supports it consistently.
  const url = "https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(address);
  const res = await fetch(url, {headers: {"Accept": "application/json"}});
  if(!res.ok) throw new Error("Geocoding service unavailable");
  const data = await res.json();
  const feature = data.features && data.features[0];
  if(!feature) throw new Error("Could not find that address. Try being more specific (add city/state).");
  const [lng, lat] = feature.geometry.coordinates;
  const p = feature.properties;
  const label = [p.name, p.city || p.district, p.state, p.country].filter(Boolean).join(", ");
  return {lat, lng, label};
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderResults(userLoc, ranked){
  const list = document.getElementById("resultsList");
  list.innerHTML = "";
  ranked.slice(0, 8).forEach((f, idx) => {
    const card = document.createElement("div");
    card.className = "result-card" + (idx === 0 ? " nearest" : "");
    card.innerHTML = `
      <div class="result-rank">${idx === 0 ? "NEAREST" : "#" + (idx+1)}</div>
      <span class="badge type-${f.type}">${TYPE_LABELS[f.type] || f.type}</span>
      <h3>${escapeHtml(f.name)}</h3>
      <div class="result-meta">${escapeHtml(f.city)}, ${escapeHtml(f.state)}</div>
      <div class="result-distance">${f.distance.toFixed(1)} <small>miles away</small></div>
    `;
    card.addEventListener("click", () => {
      map.setView([f.lat, f.lng], 10);
    });
    list.appendChild(card);
  });
}

function renderMap(userLoc, ranked){
  resultLayer.clearLayers();

  L.circleMarker([userLoc.lat, userLoc.lng], {
    radius: 8, color: "#fff", weight: 2, fillColor: "#3f8ae0", fillOpacity: 1
  }).addTo(resultLayer).bindPopup("Your location");

  ranked.slice(0, 8).forEach((f, idx) => {
    const isNearest = idx === 0;
    const marker = L.circleMarker([f.lat, f.lng], {
      radius: isNearest ? 8 : 6,
      color: "#fff",
      weight: 1,
      fillColor: isNearest ? "#e0332f" : "#8891a0",
      fillOpacity: 1
    }).addTo(resultLayer);
    marker.bindPopup(`<h3>${escapeHtml(f.name)}</h3><p>${escapeHtml(f.city)}, ${escapeHtml(f.state)} — ${f.distance.toFixed(1)} miles</p>`);

    if(isNearest){
      L.polyline([[userLoc.lat, userLoc.lng], [f.lat, f.lng]], {
        color: "#e0332f", weight: 2, dashArray: "6,6", opacity: 0.7
      }).addTo(resultLayer);
    }
  });

  const bounds = L.latLngBounds([[userLoc.lat, userLoc.lng], [ranked[0].lat, ranked[0].lng]]);
  map.fitBounds(bounds, {padding: [40, 40], maxZoom: 10});
}

function setStatus(msg, isError){
  const el = document.getElementById("finderStatus");
  el.textContent = msg;
  el.className = "finder-status" + (isError ? " error" : "");
}

async function handleSubmit(e){
  e.preventDefault();
  const address = document.getElementById("addressInput").value.trim();
  if(!address) return;

  const btn = document.getElementById("findBtn");
  btn.disabled = true;
  setStatus("Looking up address...", false);
  document.getElementById("resultsList").innerHTML = "";

  try{
    const userLoc = await geocode(address);
    const ranked = facilities
      .map(f => ({...f, distance: distanceMiles(userLoc.lat, userLoc.lng, f.lat, f.lng)}))
      .sort((a,b) => a.distance - b.distance);

    setStatus(`Nearest to: ${userLoc.label}`, false);
    renderResults(userLoc, ranked);
    renderMap(userLoc, ranked);
  }catch(err){
    setStatus(err.message || "Something went wrong. Try again.", true);
  }finally{
    btn.disabled = false;
  }
}

async function init(){
  initMap();
  const res = await fetch("data/facilities.json?v=" + Date.now(), {cache: "no-store"});
  facilities = await res.json();
  document.getElementById("finderForm").addEventListener("submit", handleSubmit);
}

init();
