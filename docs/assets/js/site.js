/* Brazilian mammal sequencing priorities: map, table and sequence downloads.
   All data are static JSON files in data/, written by 5_Website.Rmd. */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants

  const CATEGORY_ORDER = ["Highest priority", "Near priority", "Research priority", "Watch priority"];
  const SHORT = {
    "Highest priority": "Highest", "Near priority": "Near",
    "Research priority": "Research", "Watch priority": "Watch", "None": "Not a priority"
  };
  const GROUP = {
    "Highest priority": "conservation", "Near priority": "conservation",
    "Research priority": "research", "Watch priority": "watch"
  };
  // scico "lipari", as in Fig. 5
  const RAMP = ["#031326", "#13385a", "#47587a", "#6b5f76", "#8e616c",
                "#bc6461", "#e5715e", "#f69c73", "#f8c892", "#fdf5da"];

  const state = { group: "all", persp: "either", selectedKey: null };
  let species = [], byId = new Map(), grid = null, meta = null;
  let map, cellLayer, highlight, table, riverGroup, cityGroup, locMarker;
  let gridAllPromise = null;
  const seqCache = new Map();

  // ---------------------------------------------------------------------------
  // Helpers

  const $ = (sel, root = document) => root.querySelector(sel);
  const isPriority = (cat) => cat && cat !== "None";
  const fmt = (x, d = 3) => (x === null || x === undefined || Number.isNaN(x)) ? "" : Number(x).toFixed(d);
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function speciesMatches(sp, group, persp) {
    const test = (cat) => isPriority(cat) && (group === "all" || GROUP[cat] === group);
    if (persp === "global") return test(sp.gc);
    if (persp === "local") return test(sp.lc);
    return test(sp.gc) || test(sp.lc);
  }

  function rampColour(t) {
    // Squared scale, as in Fig. 5, to highlight hotspots
    const u = Math.min(1, Math.max(0, t)) ** 2;
    const pos = u * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(pos));
    const f = pos - i;
    const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
    return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
  }
  function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }

  function chip(perspective, cat) {
    const p = perspective === "global" ? "g" : "l";
    const label = perspective === "global" ? "Global" : "Local";
    const cls = isPriority(cat) ? GROUP[cat] : "none";
    return `<span class="chip ${p} ${cls}" title="${label} perspective: ${escapeHtml(cat === "None" ? "not a priority" : cat.toLowerCase())}">${label}<b>${escapeHtml(SHORT[cat] ?? cat)}</b></span>`;
  }

  function links(sp) {
    const out = [];
    if (sp.w) out.push(`<a href="${escapeHtml(sp.w)}" target="_blank" rel="noopener">Wikipedia</a>`);
    if (sp.gb) out.push(`<a href="https://www.gbif.org/species/${sp.gb}" target="_blank" rel="noopener">GBIF</a>`);
    return out.join("");
  }

  // Species photo (credited, links to the original) or the placeholder
  const NO_PHOTO = "assets/img/no-photo.svg";
  function thumb(sp, size = 44) {
    if (sp.im) {
      return `<a class="thumb" href="${escapeHtml(sp.ip || sp.im)}" target="_blank" rel="noopener" title="${escapeHtml(sp.ic || "")}">` +
        `<img src="${escapeHtml(sp.im)}" alt="Photo of ${escapeHtml(sp.b)}" width="${size}" height="${size}" loading="lazy" ` +
        `onerror="this.onerror=null;this.src='${NO_PHOTO}';this.alt=''"></a>`;
    }
    return `<span class="thumb none" title="No openly licensed photo available"><img src="${NO_PHOTO}" alt="" width="${size}" height="${size}"></span>`;
  }

  async function getJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Start

  Promise.all([
    getJSON("data/meta.json"),
    getJSON("data/species.json"),
    getJSON("data/grid.json"),
    getJSON("data/brazil.geojson"),
    getJSON("data/biomes.geojson")
  ]).then(([m, sp, g, brazil, biomes]) => {
    meta = m; species = sp.species; grid = g;
    species.forEach((s) => byId.set(s.id, s));
    fillMeta();
    buildSummary();
    buildMap(brazil, biomes);
    buildTable();
    buildSequenceForm();
  }).catch((err) => {
    console.error(err);
    $("#panel-empty").innerHTML = `<h3>The data could not be loaded</h3><p>${escapeHtml(err.message)}. Reload the page; if the problem persists, download the tables from the Zenodo archive.</p>`;
  });

  function fillMeta() {
    // Values may be plain strings or one-element lists (if meta.json was edited by hand)
    const val = (x) => String((Array.isArray(x) ? x[0] : x) ?? "").trim();
    try {
      const doi = val(meta.doi), repo = val(meta.repository);
      const zen = doi.startsWith("10.") ? `https://doi.org/${doi}` : "#";
      ["#zenodo-link", "#zenodo-link-2"].forEach((s) => { $(s).href = zen; });
      ["#repo-link", "#repo-link-2"].forEach((s) => { $(s).href = /^https?:/.test(repo) ? repo : "#"; });
      $("#version-note").textContent = `Data version ${val(meta.version)}, generated ${val(meta.generated)}.`;
    } catch (err) {
      console.error(err);   // the links are not essential; never block the page
    }
  }

  function buildSummary() {
    const rows = [
      ["Highest priority", ["Highest priority"]],
      ["Near priority", ["Near priority"]],
      ["Research priority", ["Research priority"]],
      ["Watch priority", ["Watch priority"]]
    ];
    const tbody = $("#summary-table tbody");
    tbody.innerHTML = rows.map(([label, cats]) => {
      const g = species.filter((s) => cats.includes(s.gc)).length;
      const l = species.filter((s) => cats.includes(s.lc)).length;
      return `<tr><th scope="row">${label}</th><td>${g}</td><td>${l}</td></tr>`;
    }).join("");
    const nPriority = species.filter((s) => isPriority(s.gc) || isPriority(s.lc));
    const noMap = nPriority.filter((s) => !s.rm).length;
    $("#range-note").textContent =
      `${nPriority.length} species are a priority from at least one perspective. ${noMap} of them have no range map and are not shown on the map.`;
  }

  // ---------------------------------------------------------------------------
  // Map

  function buildMap(brazil, biomes) {
    map = L.map("map", {
      zoomSnap: 0.25, minZoom: 3, maxZoom: 9, attributionControl: true,
      scrollWheelZoom: false
    });
    map.attributionControl.setPrefix(false);
    map.attributionControl.addAttribution("Ranges: Marsh et al. 2022; biomes: IBGE 2019");

    // Panes: land fill, grid cells, rivers, biome and country lines, then cities on top
    map.createPane("land").style.zIndex = 390;
    map.createPane("cells").style.zIndex = 400;
    map.createPane("rivers").style.zIndex = 405;
    map.createPane("lines").style.zIndex = 410;
    map.createPane("places").style.zIndex = 420;
    ["land", "cells", "rivers", "lines", "places"].forEach((p) => (map.getPane(p).style.pointerEvents = "none"));

    const outline = L.geoJSON(brazil, { pane: "land", style: { stroke: false, fillColor: "#E2E8E3", fillOpacity: 1 }, interactive: false }).addTo(map);
    map.fitBounds(outline.getBounds(), { padding: [12, 12] });
    map.setMaxBounds(outline.getBounds().pad(0.6));

    const ext = gridExtent();
    cellLayer = L.imageOverlay(paintCells(), ext.bounds, { pane: "cells", className: "cells", interactive: false }).addTo(map);
    L.geoJSON(biomes, { pane: "lines", style: { color: "#FFFFFF", weight: 0.9, opacity: 0.6, fill: false }, interactive: false }).addTo(map);
    L.geoJSON(brazil, { pane: "lines", style: { color: "#1E2B26", weight: 1.2, fill: false }, interactive: false }).addTo(map);
    riverGroup = L.layerGroup().addTo(map);
    cityGroup = L.layerGroup().addTo(map);
    addReferenceLayers();

    map.on("click", (e) => selectCellAt(e.latlng));
    map.on("focus", () => map.scrollWheelZoom.enable());
    map.on("blur", () => map.scrollWheelZoom.disable());

    document.querySelectorAll("#ctl-group input, #ctl-persp input").forEach((el) =>
      el.addEventListener("change", () => {
        state.group = $("#ctl-group input:checked").value;
        state.persp = $("#ctl-persp input:checked").value;
        cellLayer.setUrl(paintCells());
        if (state.selectedKey) showCell(state.selectedKey);
      }));

    $("#cell-clear").addEventListener("click", clearSelection);
    $("#cell-sequences").addEventListener("click", () => {
      const ll = state.latlng;
      if (!ll) return;
      setLocation(ll.lat, ll.lng);
      $("#sequences-section").scrollIntoView();
    });
  }

  // Major rivers and reference cities, for orientation (optional files)
  function addReferenceLayers() {
    Promise.all([getJSON("data/rivers.geojson"), getJSON("data/cities.geojson")]).then(([rivers, cities]) => {
      riverGroup.addLayer(L.geoJSON(rivers, {
        pane: "rivers", interactive: false,
        style: { color: "#9CC9E8", weight: 1.3, opacity: 0.75, lineCap: "round", lineJoin: "round" }
      }));

      L.geoJSON(cities, {
        interactive: false,
        pointToLayer: (f, ll) => L.circleMarker(ll, {
          pane: "places", radius: 3.5, weight: 1.5, color: "#1E2B26", fillColor: "#FFFFFF", fillOpacity: 1, interactive: false
        }).bindTooltip(escapeHtml(f.properties.name), {
          permanent: true, direction: "right", offset: [3, 0], className: "city-label", pane: "places"
        })
      }).addTo(cityGroup);

      const toggle = $("#ref-toggle");
      toggle.hidden = false;
      toggle.querySelector("input").addEventListener("change", (e) => {
        [riverGroup, cityGroup].forEach((g) => e.target.checked ? g.addTo(map) : g.remove());
      });
    }).catch(() => { /* Older data folders have no rivers or cities; the map works without them */ });
  }

  function cellKey(latlng) {
    const p = L.CRS.EPSG3857.project(latlng);
    return `${Math.floor((p.x - grid.xmin) / grid.res)}_${Math.floor((p.y - grid.ymin) / grid.res)}`;
  }

  function gridExtent() {
    const xmax = grid.xmin + grid.ncol * grid.res, ymax = grid.ymin + grid.nrow * grid.res;
    const sw = L.CRS.EPSG3857.unproject(L.point(grid.xmin, grid.ymin));
    const ne = L.CRS.EPSG3857.unproject(L.point(xmax, ymax));
    return { bounds: L.latLngBounds(sw, ne) };
  }

  function cellCount(ids) {
    let n = 0;
    for (const id of ids) if (speciesMatches(byId.get(id), state.group, state.persp)) n++;
    return n;
  }

  function paintCells() {
    const canvas = document.createElement("canvas");
    canvas.width = grid.ncol; canvas.height = grid.nrow;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(grid.ncol, grid.nrow);
    const counts = {};
    let max = 0;
    for (const [key, ids] of Object.entries(grid.cells)) {
      const n = cellCount(ids);
      counts[key] = n; if (n > max) max = n;
    }
    for (const [key, n] of Object.entries(counts)) {
      const [c, r] = key.split("_").map(Number);
      const y = grid.nrow - 1 - r;
      const i = (y * grid.ncol + c) * 4;
      // Cells without species of this layer get the lowest colour of the ramp, as in Fig. 5
      const rgb = rampColour(max ? n / max : 0);
      img.data.set([rgb[0], rgb[1], rgb[2], 255], i);
    }
    ctx.putImageData(img, 0, 0);
    $("#legend-max").textContent = max;
    return canvas.toDataURL("image/png");
  }

  function selectCellAt(latlng) {
    const key = cellKey(latlng);
    if (!(key in grid.cells)) return;
    const [c, r] = key.split("_").map(Number);
    state.selectedKey = key;

    const sw = L.CRS.EPSG3857.unproject(L.point(grid.xmin + c * grid.res, grid.ymin + r * grid.res));
    const ne = L.CRS.EPSG3857.unproject(L.point(grid.xmin + (c + 1) * grid.res, grid.ymin + (r + 1) * grid.res));
    if (highlight) highlight.remove();
    highlight = L.rectangle([sw, ne], { pane: "lines", color: "#FFFFFF", weight: 2.5, fill: false, interactive: false }).addTo(map);
    showCell(key, latlng);
  }

  function clearSelection() {
    state.selectedKey = null;
    if (highlight) { highlight.remove(); highlight = null; }
    $("#panel-cell").hidden = true;
    $("#panel-empty").hidden = false;
  }

  function showCell(key, latlng) {
    const ids = grid.cells[key] || [];
    const list = ids.map((id) => byId.get(id)).filter((s) => speciesMatches(s, state.group, state.persp));
    const best = (s) => Math.min(...[s.gc, s.lc].map((c) => isPriority(c) ? CATEGORY_ORDER.indexOf(c) : 9));
    list.sort((a, b) => best(a) - best(b) || Math.max(b.bg, b.bl) - Math.max(a.bg, a.bl));

    if (latlng) state.latlng = latlng;
    const ll = state.latlng;
    $("#cell-title").textContent = `${list.length} priority species in this cell`;
    $("#cell-meta").textContent = ll ? `Cell centred near ${Math.abs(ll.lat).toFixed(2)}° ${ll.lat < 0 ? "S" : "N"}, ${Math.abs(ll.lng).toFixed(2)}° W. Shown for the current map layer.` : "";

    let html = "", lastGroup = null;
    for (const s of list) {
      const g = CATEGORY_ORDER[best(s)];
      if (g !== lastGroup) { html += `<li class="group-heading">${g}</li>`; lastGroup = g; }
      html += `<li class="sp-item">${thumb(s, 48)}<div>
        <div><span class="sp-name">${escapeHtml(s.b)}</span>${s.c ? ` <span class="sp-common">${escapeHtml(s.c)}</span>` : ""}</div>
        <div class="sp-line">${chip("global", s.gc)}${chip("local", s.lc)}<span>${escapeHtml(s.o)}</span></div>
        <div class="sp-line sp-links">${links(s)}<button type="button" class="link-button" data-show="${s.id}">Show in table</button></div>
      </div></li>`;
    }
    if (!list.length) html = `<li>No species of the selected category occur in this cell. Choose another category or perspective above the map.</li>`;
    $("#cell-species").innerHTML = html;
    $("#cell-species").querySelectorAll("[data-show]").forEach((b) =>
      b.addEventListener("click", () => showInTable(Number(b.dataset.show))));

    $("#panel-empty").hidden = true;
    $("#panel-cell").hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Table

  function buildTable() {
    const orders = [...new Set(species.map((s) => s.o))].sort();
    const catValues = ["Highest priority", "Near priority", "Research priority", "Watch priority", "None"];
    const catList = { values: Object.fromEntries(catValues.map((c) => [c, SHORT[c]])), clearable: true };
    const statusList = (key) => ({ values: [...new Set(species.map((s) => s[key]))].sort(), clearable: true });
    const num = (field, title, d = 3) => ({
      title, field, hozAlign: "right", cssClass: "num", sorter: "number", headerFilter: false,
      formatter: (cell) => fmt(cell.getValue(), d), width: 92
    });
    const catFormatter = (persp) => (cell) => chip(persp, cell.getValue());
    const catSorter = (a, b) => (CATEGORY_ORDER.indexOf(a) + 10 * (a === "None")) - (CATEGORY_ORDER.indexOf(b) + 10 * (b === "None"));

    table = new Tabulator("#priority-table", {
      data: species,
      index: "id",
      layout: "fitDataStretch",
      rowHeight: 58,
      columnDefaults: { vertAlign: "middle" },
      height: "620px",
      placeholder: "No species match these filters.",
      initialSort: [{ column: "bg", dir: "desc" }, { column: "gc", dir: "asc" }],
      columnHeaderVertAlign: "bottom",
      columns: [
        {
          title: "Species", field: "b", frozen: true, minWidth: 270, headerFilter: "input",
          headerFilterPlaceholder: "Filter",
          formatter: (cell) => {
            const s = cell.getRow().getData();
            return `<div class="sp-cell">${thumb(s)}<div class="sp-text"><span class="sp">${escapeHtml(s.b)}</span>` +
              `<span class="sp-links">${links(s)}</span></div></div>`;
          }
        },
        { title: "Common name", field: "c", minWidth: 150, headerFilter: "input", headerFilterPlaceholder: "Filter" },
        { title: "Order", field: "o", headerFilter: "list", headerFilterParams: { values: orders, clearable: true } },
        {
          title: "Category", columns: [
            { title: "Global", field: "gc", formatter: catFormatter("global"), sorter: catSorter, headerFilter: "list", headerFilterParams: catList },
            { title: "Local", field: "lc", formatter: catFormatter("local"), sorter: catSorter, headerFilter: "list", headerFilterParams: catList }
          ]
        },
        {
          title: "Status", columns: [
            { title: "IUCN", field: "iu", headerFilter: "list", headerFilterParams: statusList("iu"), width: 84 },
            { title: "SALVE", field: "sa", headerFilter: "list", headerFilterParams: statusList("sa"), width: 90 }
          ]
        },
        { title: "BPS", columns: [num("bg", "Global"), num("bl", "Local")] },
        { title: "ED₂ (Myr)", columns: [num("eg", "Global", 2), num("el", "Local", 2)] },
        { title: "Extinction probability", columns: [num("ge", "GE₂"), num("le", "LE₂")] },
        num("po", "PO"),
        { title: "Primers with sequences", field: "np", hozAlign: "right", cssClass: "num", sorter: "number", width: 110,
          formatter: (cell) => `${cell.getValue()}/10` }
      ]
    });

    const applyFilters = () => {
      const q = $("#table-search").value.trim().toLowerCase();
      const onlyPriority = $("#priority-only").checked;
      table.setFilter((d) => {
        if (onlyPriority && !isPriority(d.gc) && !isPriority(d.lc)) return false;
        if (q && !(d.b.toLowerCase().includes(q) || (d.c || "").toLowerCase().includes(q))) return false;
        return true;
      });
    };
    table.on("tableBuilt", applyFilters);
    table.on("dataFiltered", (filters, rows) => {
      $("#row-count").textContent = `${rows.length} of ${species.length} species`;
    });
    $("#table-search").addEventListener("input", applyFilters);
    $("#priority-only").addEventListener("change", applyFilters);
    $("#table-download").addEventListener("click", () =>
      table.download("csv", "brazilian_mammal_sequencing_priorities.csv", {}, "active"));
  }

  function showInTable(id) {
    const s = byId.get(id);
    $("#table-search").value = s.b;
    if (!isPriority(s.gc) && !isPriority(s.lc)) $("#priority-only").checked = false;
    $("#table-search").dispatchEvent(new Event("input"));
    $("#list-section").scrollIntoView();
    setTimeout(() => {
      const row = table.getRow(id);
      if (row) { row.scrollTo(); row.getElement().classList.add("flash"); }
    }, 250);
  }

  // ---------------------------------------------------------------------------
  // Sequence downloads

  function buildSequenceForm() {
    const byLocus = {};
    meta.primers.forEach((p) => (byLocus[p.locus] = byLocus[p.locus] || []).push(p));
    $("#primer-groups").innerHTML = Object.entries(byLocus).map(([locus, ps]) => `
      <div class="primer-group">
        <h4>${escapeHtml(locus)}</h4>
        ${ps.map((p) => `<label><input type="checkbox" name="primer" value="${p.id}"><span>${escapeHtml(p.name)}${p.original ? ` <small>${escapeHtml(p.original)}</small>` : ""}</span></label>`).join("")}
      </div>`).join("");

    const orderSel = $("#seq-order");
    [...new Set(species.map((s) => s.o))].sort().forEach((o) => orderSel.insertAdjacentHTML("beforeend", `<option>${escapeHtml(o)}</option>`));

    const form = $("#seq-form");
    form.addEventListener("change", updateCount);
    form.addEventListener("click", (e) => {
      const action = e.target.dataset.select;
      if (!action) return;
      form.querySelectorAll('input[name="primer"]').forEach((cb) => (cb.checked = action === "primers-all"));
      updateCount();
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); download(); });

    // Location
    $("#nomap-n").textContent = species.filter((s) => !s.rm).length;
    let timer;
    const onCoords = () => { clearTimeout(timer); timer = setTimeout(updateCount, 350); };
    // A "lat, lon" pair pasted or typed into the latitude field is split over the two fields
    const splitPair = (el) => {
      const v = el.value;
      if (!v.includes(".")) return;
      const parts = v.trim().split(/\s*[;,]\s*|\s+(?=[-−+\d])/).filter(Boolean);
      if (parts.length === 2) { el.value = parts[0]; $("#seq-lon").value = parts[1]; }
    };
    $("#seq-lat").addEventListener("input", (e) => {
      if (/^insertFrom(Paste|Drop)/.test(e.inputType || "")) splitPair(e.target);
      onCoords();
    });
    $("#seq-lat").addEventListener("change", (e) => { splitPair(e.target); updateCount(); });
    $("#seq-lon").addEventListener("input", onCoords);
    ["#seq-lat", "#seq-lon"].forEach((s) => $(s).addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); splitPair($("#seq-lat")); updateCount(); }
    }));
    $("#seq-loc-clear").addEventListener("click", () => {
      $("#seq-lat").value = ""; $("#seq-lon").value = ""; updateCount();
    });
    $("#seq-species-download").addEventListener("click", downloadSpeciesList);
    updateLocationStatus(null);
  }

  // Fill in a location (from a selected map cell) and select all primers if none are selected
  function setLocation(lat, lon) {
    $("#seq-lat").value = lat.toFixed(4);
    $("#seq-lon").value = lon.toFixed(4);
    const boxes = [...document.querySelectorAll('input[name="primer"]')];
    if (!boxes.some((cb) => cb.checked)) boxes.forEach((cb) => (cb.checked = true));
    updateCount();
  }

  function parseCoord(s, pos, neg) {
    s = s.trim().replace(/[−–]/g, "-");
    if (!s.includes(".")) s = s.replace(",", ".");
    const m = s.match(/^([-+]?\d+(?:\.\d+)?)\s*°?\s*([NSEWnsew])?$/);
    if (!m) return null;
    let v = parseFloat(m[1]);
    const h = (m[2] || "").toUpperCase();
    if (h === neg) v = -Math.abs(v);
    else if (h && h !== pos) return null;
    return v;
  }

  const fmtLatLon = (lat, lon) =>
    `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"}, ${Math.abs(lon).toFixed(2)}° ${lon < 0 ? "W" : "E"}`;

  function parseLocation() {
    const a = $("#seq-lat").value, b = $("#seq-lon").value;
    if (!a.trim() && !b.trim()) return null;
    const lat = parseCoord(a, "N", "S"), lon = parseCoord(b, "E", "W");
    if (lat === null || lon === null) {
      return { error: "Enter both latitude and longitude in decimal degrees, for example −3.10 and −60.02." };
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return { error: "Latitude must be between −90 and 90, and longitude between −180 and 180." };
    }
    const key = cellKey(L.latLng(lat, lon));
    if (!(key in grid.cells)) {
      const hint = lon > 0 && lon < 75 ? " Longitudes west of Greenwich are negative (for example −60.02)." :
                   lat > 6 && lat < 34 ? " Latitudes south of the equator are negative (for example −3.10)." : "";
      return { error: `${fmtLatLon(lat, lon)} is outside Brazil.${hint}`, lat, lon };
    }
    return { lat, lon, key };
  }

  // All species whose range overlaps each cell, stored as bit sets (data/grid_all.json, loaded on first use)
  function loadGridAll() {
    if (!gridAllPromise) {
      gridAllPromise = getJSON("data/grid_all.json").then((g) => ({
        cells: g.cells,
        sets: g.sets.map((b64) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)))
      }));
      gridAllPromise.catch(() => { gridAllPromise = null; });
    }
    return gridAllPromise;
  }

  async function speciesInCell(key) {
    const g = await loadGridAll();
    const bits = g.sets[g.cells[key]];
    const ids = new Set();
    if (bits) species.forEach((s) => { if ((bits[s.id >> 3] >> (s.id & 7)) & 1) ids.add(s.id); });
    return ids;
  }

  function updateLocationMarker(loc) {
    if (locMarker) { locMarker.remove(); locMarker = null; }
    if (loc && loc.key) {
      locMarker = L.marker([loc.lat, loc.lon], {
        icon: L.divIcon({ className: "", html: '<div class="loc-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false, keyboard: false, title: "Location for the sequence download"
      }).addTo(map);
    }
  }

  function updateLocationStatus(loc, inCell) {
    const el = $("#loc-status");
    const lat = $("#seq-lat"), lon = $("#seq-lon");
    el.className = "loc-status";
    [lat, lon].forEach((i) => i.removeAttribute("aria-invalid"));
    if (!loc) {
      el.textContent = "Decimal degrees; south and west are negative. You can also paste both values into the latitude field.";
    } else if (loc.error) {
      el.classList.add("error");
      el.textContent = loc.error;
      [lat, lon].forEach((i) => i.setAttribute("aria-invalid", "true"));
    } else {
      el.classList.add("ok");
      el.innerHTML = inCell
        ? `${escapeHtml(fmtLatLon(loc.lat, loc.lon))}: <b>${inCell.size}</b> species have a range map overlapping this grid cell.`
        : `${escapeHtml(fmtLatLon(loc.lat, loc.lon))} is in Brazil.`;
    }
    $("#seq-species-download").hidden = !(loc && loc.key);
    updateLocationMarker(loc);
  }

  function selection() {
    return {
      primers: [...document.querySelectorAll('input[name="primer"]:checked')].map((cb) => cb.value),
      order: $("#seq-order").value,
      priority: $("#seq-priority").value,
      unambiguous: $("#seq-unambiguous").checked,
      format: $('input[name="format"]:checked').value,
      loc: parseLocation(),
      noMap: $("#seq-nomap").checked
    };
  }

  // inCell: species whose range overlaps the selected cell (null: no location filter)
  function speciesFilter(sel, inCell = null) {
    return (sp) => {
      if (inCell && !inCell.has(sp.id) && !(sel.noMap && !sp.rm)) return false;
      if (sel.order && sp.o !== sel.order) return false;
      if (!sel.priority) return true;
      if (sel.priority === "any") return isPriority(sp.gc) || isPriority(sp.lc);
      const [p, group] = sel.priority.split(":");
      const cat = p === "g" ? sp.gc : sp.lc;
      return isPriority(cat) && GROUP[cat] === group;
    };
  }

  async function cellSpecies(sel) {
    return sel.loc && sel.loc.key ? speciesInCell(sel.loc.key) : null;
  }

  async function loadPrimer(id) {
    if (!seqCache.has(id)) seqCache.set(id, getJSON(`data/sequences/${id}.json`));
    return seqCache.get(id);
  }

  async function selectedRows(sel, inCell) {
    const keep = speciesFilter(sel, inCell);
    const out = [];
    for (const id of sel.primers) {
      const data = await loadPrimer(id);
      for (const [acc, sid, seq, amb] of data.rows) {
        if (sel.unambiguous && amb) continue;
        const sp = byId.get(sid);
        if (sp && keep(sp)) out.push({ primer: id, acc, sp, seq, amb });
      }
    }
    return out;
  }

  let countToken = 0;
  async function updateCount() {
    const sel = selection();
    const button = $("#seq-download");
    const gap = $("#seq-gap");
    const token = ++countToken;
    gap.hidden = true;

    let inCell = null;
    if (sel.loc && sel.loc.error) {
      updateLocationStatus(sel.loc);
      $("#seq-count").textContent = "Correct the location, or clear it to download sequences for all of Brazil.";
      button.disabled = true; return;
    }
    try {
      inCell = await cellSpecies(sel);
    } catch (err) {
      if (token !== countToken) return;
      updateLocationStatus({ error: `The species per grid cell could not be loaded: ${err.message}.` });
      button.disabled = true; return;
    }
    if (token !== countToken) return;
    updateLocationStatus(sel.loc, inCell);

    if (!sel.primers.length) {
      $("#seq-count").textContent = "Select at least one primer.";
      button.disabled = true; return;
    }
    $("#seq-count").textContent = "Counting sequences…";
    try {
      const rows = await selectedRows(sel, inCell);
      if (token !== countToken) return;
      const covered = new Set(rows.map((r) => r.sp.id));
      const where = inCell ? " at this location" : "";
      $("#seq-count").textContent = rows.length
        ? `${rows.length.toLocaleString("en")} sequences from ${covered.size} species${where}, ${sel.primers.length} primer${sel.primers.length > 1 ? "s" : ""}.`
        : `No sequences match this selection${where}. Try another order, priority category or primer.`;
      if (inCell) {
        const expected = species.filter(speciesFilter(sel, inCell));
        const missing = expected.length - covered.size;
        const filtered = sel.order || sel.priority ? " (with the filters above)" : "";
        const what = `${sel.unambiguous ? "unambiguous " : ""}sequence for ${sel.primers.length > 1 ? "these primers" : "this primer"}`;
        gap.textContent = missing > 0
          ? `${missing} of the ${expected.length} species expected here${filtered} have no ${what}; the species list shows which.`
          : `All ${expected.length} species expected here${filtered} have at least one ${what}.`;
        gap.hidden = false;
      }
      button.disabled = rows.length === 0;
    } catch (err) {
      $("#seq-count").textContent = `The sequences could not be loaded: ${err.message}.`;
      button.disabled = true;
    }
  }

  function saveText(text, type, filename) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const csvRow = (values) => values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  const locSuffix = (loc) => loc && loc.key ? `_${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}` : "";

  // Species expected at the location (range map overlaps the cell, plus species
  // without a range map if selected), with the number of sequences per selected primer
  async function downloadSpeciesList() {
    const sel = selection();
    if (!sel.loc || !sel.loc.key) return;
    const inCell = await cellSpecies(sel);
    const keep = speciesFilter(sel, inCell);
    const rows = sel.primers.length ? await selectedRows(sel, inCell) : [];
    const counts = new Map();
    for (const r of rows) {
      const k = `${r.sp.id}|${r.primer}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const primerNames = sel.primers.map((id) => meta.primers.find((p) => p.id === id).name);
    const head = ["species", "common_name", "order", "family", "range_map_overlaps_cell", "global_category", "local_category"]
      .concat(primerNames.map((n) => `sequences_${n}`));
    const list = species.filter(keep).sort((a, b) => a.o.localeCompare(b.o) || a.b.localeCompare(b.b));
    const lines = [csvRow(head)].concat(list.map((s) => csvRow([s.b, s.c, s.o, s.f, s.rm ? "yes" : "no (no range map)", s.gc, s.lc]
      .concat(sel.primers.map((id) => counts.get(`${s.id}|${id}`) || 0)))));
    saveText(lines.join("\n") + "\n", "text/csv", `brazilian_mammals_species_list${locSuffix(sel.loc)}.csv`);
  }

  async function download() {
    const sel = selection();
    if (sel.loc && sel.loc.error) return;
    const rows = await selectedRows(sel, await cellSpecies(sel));
    if (!rows.length) return;
    const locus = (id) => meta.primers.find((p) => p.id === id);
    let text, type, ext;
    if (sel.format === "fasta") {
      text = rows.map((r) => `>${r.acc}|${r.sp.b.replace(/ /g, "_")}|${locus(r.primer).name}|${locus(r.primer).locus}|${r.sp.o}\n${r.seq}`).join("\n") + "\n";
      type = "text/plain"; ext = "fasta";
    } else {
      const head = ["accession", "species", "order", "primer", "locus", "ambiguous", "global_category", "local_category", "sequence"];
      text = [csvRow(head)].concat(rows.map((r) => csvRow([r.acc, r.sp.b, r.sp.o, locus(r.primer).name, locus(r.primer).locus,
        r.amb ? "yes" : "no", r.sp.gc, r.sp.lc, r.seq]))).join("\n") + "\n";
      type = "text/csv"; ext = "csv";
    }
    saveText(text, type, `brazilian_mammal_reference_sequences${locSuffix(sel.loc)}.${ext}`);
  }
})();
