/* Brazilian mammal sequencing priorities: map, table and sequence downloads.
   All data are static JSON files in data/, written by 5_Website.Rmd.
   Interface text is in assets/js/i18n.js (English and Portuguese). */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants and state

  const CATEGORY_ORDER = ["Highest priority", "Near priority", "Research priority", "Watch priority"];
  const CAT_KEY = {
    "Highest priority": "highest", "Near priority": "near",
    "Research priority": "research", "Watch priority": "watch", "None": "none"
  };
  const GROUP = {
    "Highest priority": "conservation", "Near priority": "conservation",
    "Research priority": "research", "Watch priority": "watch"
  };
  // scico "lipari", as in Fig. 5
  const RAMP = ["#031326", "#13385a", "#47587a", "#6b5f76", "#8e616c",
                "#bc6461", "#e5715e", "#f69c73", "#f8c892", "#fdf5da"];
  const RANGE_RGBA = [255, 210, 63, 235];
  const NO_PHOTO = "assets/img/no-photo.svg";

  const state = { group: "all", persp: "either", selectedKey: null, latlng: null, rangeId: null };
  let lang = "en";
  let species = [], byId = new Map(), grid = null, meta = null, loaded = false;
  let map, cellLayer, rangeLayer, highlight, table, riverGroup, cityGroup, locMarker;
  let gridAllPromise = null, summariesPromise = null, gcCode = "";
  const seqCache = new Map();

  // ---------------------------------------------------------------------------
  // Helpers

  const $ = (sel, root = document) => root.querySelector(sel);
  const isPriority = (cat) => cat && cat !== "None";
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Values in meta.json may be plain strings or one-element lists (if edited by hand)
  const val = (x) => String((Array.isArray(x) ? x[0] : x) ?? "").trim();

  function t(key, vars = {}) {
    const dict = window.I18N || {};
    const s = (dict[lang] && dict[lang][key]) ?? (dict.en && dict.en[key]) ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  }
  const locale = () => (lang === "pt" ? "pt-BR" : "en");
  const nf = (n) => Number(n).toLocaleString(locale());
  const dec = (x, d) => {
    const s = Number(x).toFixed(d);
    return lang === "pt" ? s.replace(".", ",") : s;
  };
  const fmt = (x, d = 3) => (x === null || x === undefined || Number.isNaN(x)) ? "" : dec(x, d);
  const catFull = (cat) => t(`cat_${CAT_KEY[cat]}`);
  const catShort = (cat) => t(`short_${CAT_KEY[cat] || "none"}`);

  function speciesMatches(sp, group, persp) {
    const test = (cat) => isPriority(cat) && (group === "all" || GROUP[cat] === group);
    if (persp === "global") return test(sp.gc);
    if (persp === "local") return test(sp.lc);
    return test(sp.gc) || test(sp.lc);
  }

  function rampColour(x) {
    // Squared scale, as in Fig. 5, to highlight hotspots
    const u = Math.min(1, Math.max(0, x)) ** 2;
    const pos = u * (RAMP.length - 1);
    const i = Math.min(RAMP.length - 2, Math.floor(pos));
    const f = pos - i;
    const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
    return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
  }
  function hex(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }

  function chip(perspective, cat) {
    const p = perspective === "global" ? "g" : "l";
    const label = perspective === "global" ? t("chip_global") : t("chip_local");
    const cls = isPriority(cat) ? GROUP[cat] : "none";
    const title = t("chip_title", { persp: label.toLowerCase(), cat: isPriority(cat) ? catFull(cat).toLowerCase() : t("not_priority") });
    return `<span class="chip ${p} ${cls}" title="${escapeHtml(title)}">${label}<b>${escapeHtml(catShort(cat))}</b></span>`;
  }

  function links(sp) {
    const out = [];
    const wiki = lang === "pt" && sp.wp ? sp.wp : sp.w;
    if (wiki) out.push(`<a href="${escapeHtml(wiki)}" target="_blank" rel="noopener">Wikipedia</a>`);
    if (sp.gb) out.push(`<a href="https://www.gbif.org/species/${sp.gb}" target="_blank" rel="noopener">GBIF</a>`);
    out.push(`<button type="button" class="link-button" data-range="${sp.id}">${t("map_link")}</button>`);
    return out.join("");
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  async function getJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Language

  function initialLang() {
    const fromHash = new URLSearchParams(location.hash.slice(1)).get("lang");
    if (fromHash === "pt" || fromHash === "en") return fromHash;
    try { const s = localStorage.getItem("lang"); if (s === "pt" || s === "en") return s; } catch (e) { /* storage blocked */ }
    return (navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en";
  }

  function applyStatic() {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll("[data-i18n-label]").forEach((el) => { el.label = t(el.dataset.i18nLabel); });
    document.querySelectorAll(".lang-switch [data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  }

  function setLang(l) {
    if (l === lang && loaded) return;
    lang = l;
    try { localStorage.setItem("lang", l); } catch (e) { /* storage blocked */ }
    applyStatic();
    if (!loaded) return;
    fillMeta();
    buildStats();
    buildSummary();
    fillLanguageDependent();
    createTable();
    if (state.selectedKey) showCell(state.selectedKey);
    if (state.rangeId !== null) showRange(state.rangeId, { fit: false });
    else $("#legend-title").textContent = t("legend_title");
    updateCount();
    buildCitations();
    loadCounter();
    writeHash();
    track(`language/${l}`, `Language: ${l}`);
  }

  document.querySelectorAll(".lang-switch [data-lang]").forEach((b) =>
    b.addEventListener("click", () => setLang(b.dataset.lang)));

  lang = initialLang();
  applyStatic();

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
    loaded = true;
    setupAnalytics();
    fillMeta();
    buildStats();
    buildSummary();
    fillLanguageDependent();
    buildMap(brazil, biomes);
    setupTableToolbar();
    createTable();
    setupPhotoPreview();
    buildSequenceForm();
    setupFind();
    setupShare();
    setupCite();
    loadCounter();
    applyHashState(true);
    window.addEventListener("hashchange", () => { if (location.hash.includes("=")) applyHashState(false); });
  }).catch((err) => {
    console.error(err);
    $("#panel-empty").innerHTML = `<h3>${t("data_error_title")}</h3><p>${escapeHtml(t("data_error", { msg: err.message }))}</p>`;
  });

  function fillMeta() {
    try {
      const doi = val(meta.doi), repo = val(meta.repository);
      const zen = doi.startsWith("10.") ? `https://doi.org/${doi}` : "#";
      document.querySelectorAll(".zenodo-link").forEach((a) => { a.href = zen; });
      document.querySelectorAll(".repo-link").forEach((a) => { a.href = /^https?:/.test(repo) ? repo : "#"; });
      $("#version-note").textContent = t("version_note", { v: val(meta.version), d: val(meta.generated) });
    } catch (err) {
      console.error(err);   // the links are not essential; never block the page
    }
  }

  // Texts that contain numbers from the data
  function fillLanguageDependent() {
    const noMap = species.filter((s) => !s.rm).length;
    $("#about-ranges").textContent = t("about_ranges", { n: noMap });
    $("#nomap-label").textContent = t("nomap", { n: noMap });
  }

  function buildStats() {
    const loci = new Set(meta.primers.map((p) => p.locus)).size;
    const noSeq = species.filter((s) => s.np === 0).length;
    const nPriority = species.filter((s) => isPriority(s.gc) || isPriority(s.lc)).length;
    const items = [
      [nf(species.length), t("stat_species")],
      [nf(meta.primers.length), t("stat_primers", { loci })],
      [nf(noSeq), t("stat_nosq")],
      [nf(nPriority), t("stat_priority")]
    ];
    $("#stats").innerHTML = items.map(([n, label]) => `<li><b>${n}</b><span>${escapeHtml(label)}</span></li>`).join("");
  }

  function buildSummary() {
    const tbody = $("#summary-table tbody");
    tbody.innerHTML = CATEGORY_ORDER.map((cat) => {
      const g = species.filter((s) => s.gc === cat).length;
      const l = species.filter((s) => s.lc === cat).length;
      return `<tr><th scope="row">${catFull(cat)}</th><td>${g}</td><td>${l}</td></tr>`;
    }).join("");
    const nPriority = species.filter((s) => isPriority(s.gc) || isPriority(s.lc));
    const noMap = nPriority.filter((s) => !s.rm).length;
    $("#range-note").textContent = t("range_note", { n: nPriority.length, m: noMap });
  }

  // ---------------------------------------------------------------------------
  // Shareable links: the view is kept in the address (#lang=pt&cat=research&persp=local&cell=..&sp=..)

  function writeHash() {
    if (!loaded) return;
    const p = new URLSearchParams();
    if (lang !== "en") p.set("lang", lang);
    if (state.group !== "all") p.set("cat", state.group);
    if (state.persp !== "either") p.set("persp", state.persp);
    if (state.selectedKey) p.set("cell", state.selectedKey);
    if (state.rangeId !== null && byId.has(state.rangeId)) p.set("sp", byId.get(state.rangeId).b.replace(/ /g, "_"));
    const h = p.toString();
    history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
  }

  function applyHashState(initial) {
    const p = new URLSearchParams(location.hash.slice(1));
    const l = p.get("lang");
    if ((l === "pt" || l === "en") && l !== lang) setLang(l);

    const cat = p.get("cat"), persp = p.get("persp");
    const groupIn = document.querySelector(`#ctl-group input[value="${cat || "all"}"]`);
    const perspIn = document.querySelector(`#ctl-persp input[value="${persp || "either"}"]`);
    if (groupIn) groupIn.checked = true;
    if (perspIn) perspIn.checked = true;
    state.group = $("#ctl-group input:checked").value;
    state.persp = $("#ctl-persp input:checked").value;
    cellLayer.setUrl(paintCells());

    const spName = (p.get("sp") || "").replace(/_/g, " ").toLowerCase();
    const sp = spName ? species.find((s) => s.b.toLowerCase() === spName) : null;
    const cell = p.get("cell");
    if (sp) showRange(sp.id, { fit: !(cell && cell in grid.cells) });
    else if (!initial) clearRange();

    if (cell && cell in grid.cells) {
      const [c, r] = cell.split("_").map(Number);
      const ll = L.CRS.EPSG3857.unproject(L.point(grid.xmin + (c + 0.5) * grid.res, grid.ymin + (r + 0.5) * grid.res));
      selectCellAt(ll);
      if (!sp) map.setView(ll, Math.max(map.getZoom(), 6));
    } else if (!initial) {
      clearSelection();
    }
    if (initial && (sp || cell)) $("#map-section").scrollIntoView();
  }

  function setupShare() {
    $("#share-view").addEventListener("click", async () => {
      writeHash();
      const url = location.href;
      if (await copyText(url)) toast(t("link_copied"));
      else window.prompt(t("copy_failed", { url: "" }), url);
      track("copy-link", "Copy link to view");
    });
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

    // Panes: land fill, grid cells, species range, rivers, biome and country lines, then cities on top
    map.createPane("land").style.zIndex = 390;
    map.createPane("cells").style.zIndex = 400;
    map.createPane("range").style.zIndex = 402;
    map.createPane("rivers").style.zIndex = 405;
    map.createPane("lines").style.zIndex = 410;
    map.createPane("places").style.zIndex = 420;
    ["land", "cells", "range", "rivers", "lines", "places"].forEach((p) => (map.getPane(p).style.pointerEvents = "none"));

    const outline = L.geoJSON(brazil, { pane: "land", style: { stroke: false, fillColor: "#E2E8E3", fillOpacity: 1 }, interactive: false }).addTo(map);
    map.fitBounds(outline.getBounds(), { padding: [12, 12] });
    map.setMaxBounds(outline.getBounds().pad(0.6));
    state.home = outline.getBounds();

    cellLayer = L.imageOverlay(paintCells(), gridExtent().bounds, { pane: "cells", className: "cells", interactive: false }).addTo(map);
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
        writeHash();
      }));

    $("#cell-clear").addEventListener("click", clearSelection);
    $("#cell-sequences").addEventListener("click", () => {
      const ll = state.latlng;
      if (!ll) return;
      setLocation(ll.lat, ll.lng);
      $("#sequences-section").scrollIntoView();
    });
    $("#range-clear").addEventListener("click", () => { clearRange(); map.fitBounds(state.home, { padding: [12, 12] }); });

    // "Map" / "Show range" buttons anywhere on the page
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-range]");
      if (!b) return;
      showRange(Number(b.dataset.range), { fit: true });
      $("#map-section").scrollIntoView();
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

  function cellBounds(c, r) {
    const sw = L.CRS.EPSG3857.unproject(L.point(grid.xmin + c * grid.res, grid.ymin + r * grid.res));
    const ne = L.CRS.EPSG3857.unproject(L.point(grid.xmin + (c + 1) * grid.res, grid.ymin + (r + 1) * grid.res));
    return L.latLngBounds(sw, ne);
  }

  function gridExtent() {
    return { bounds: cellBounds(0, 0).extend(cellBounds(grid.ncol - 1, grid.nrow - 1)) };
  }

  function cellCount(ids) {
    let n = 0;
    for (const id of ids) if (speciesMatches(byId.get(id), state.group, state.persp)) n++;
    return n;
  }

  function newCanvas() {
    const canvas = document.createElement("canvas");
    canvas.width = grid.ncol; canvas.height = grid.nrow;
    const ctx = canvas.getContext("2d");
    return { canvas, ctx, img: ctx.createImageData(grid.ncol, grid.nrow) };
  }
  const pixel = (key) => {
    const [c, r] = key.split("_").map(Number);
    return ((grid.nrow - 1 - r) * grid.ncol + c) * 4;
  };

  function paintCells() {
    const { canvas, ctx, img } = newCanvas();
    const counts = {};
    let max = 0;
    for (const [key, ids] of Object.entries(grid.cells)) {
      const n = cellCount(ids);
      counts[key] = n; if (n > max) max = n;
    }
    for (const [key, n] of Object.entries(counts)) {
      // Cells without species of this layer get the lowest colour of the ramp, as in Fig. 5
      const rgb = rampColour(max ? n / max : 0);
      img.data.set([rgb[0], rgb[1], rgb[2], 255], pixel(key));
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
    if (highlight) highlight.remove();
    highlight = L.rectangle(cellBounds(c, r), { pane: "lines", color: "#FFFFFF", weight: 2.5, fill: false, interactive: false }).addTo(map);
    showCell(key, latlng);
    writeHash();
  }

  function clearSelection() {
    state.selectedKey = null;
    if (highlight) { highlight.remove(); highlight = null; }
    $("#panel-cell").hidden = true;
    $("#panel-empty").hidden = false;
    writeHash();
  }

  function fmtLatLon(lat, lon) {
    return `${dec(Math.abs(lat), 2)}° ${lat < 0 ? "S" : "N"}, ${dec(Math.abs(lon), 2)}° ${lon < 0 ? (lang === "pt" ? "O" : "W") : (lang === "pt" ? "L" : "E")}`;
  }

  function showCell(key, latlng) {
    const ids = grid.cells[key] || [];
    const list = ids.map((id) => byId.get(id)).filter((s) => speciesMatches(s, state.group, state.persp));
    const best = (s) => Math.min(...[s.gc, s.lc].map((c) => isPriority(c) ? CATEGORY_ORDER.indexOf(c) : 9));
    list.sort((a, b) => best(a) - best(b) || Math.max(b.bg, b.bl) - Math.max(a.bg, a.bl));

    if (latlng) state.latlng = latlng;
    const ll = state.latlng;
    $("#cell-title").textContent = t("cell_title", { n: list.length });
    $("#cell-meta").textContent = ll ? t("cell_meta", { coords: fmtLatLon(ll.lat, ll.lng) }) : "";

    let html = "", lastGroup = null;
    for (const s of list) {
      const g = CATEGORY_ORDER[best(s)];
      if (g !== lastGroup) { html += `<li class="group-heading">${catFull(g)}</li>`; lastGroup = g; }
      html += `<li class="sp-item">${thumb(s, 48)}<div>
        <div><span class="sp-name">${escapeHtml(s.b)}</span>${s.c ? ` <span class="sp-common">${escapeHtml(s.c)}</span>` : ""}</div>
        <div class="sp-line">${chip("global", s.gc)}${chip("local", s.lc)}<span>${escapeHtml(s.o)}</span></div>
        <div class="sp-line sp-links">${links(s)}<button type="button" class="link-button" data-show="${s.id}">${t("show_in_table")}</button></div>
      </div></li>`;
    }
    if (!list.length) html = `<li>${t("cell_none")}</li>`;
    $("#cell-species").innerHTML = html;
    $("#cell-species").querySelectorAll("[data-show]").forEach((b) =>
      b.addEventListener("click", () => showInTable(Number(b.dataset.show))));

    $("#panel-empty").hidden = true;
    $("#panel-cell").hidden = false;
  }

  // ---------------------------------------------------------------------------
  // Species range on the map (from the species per grid cell in data/grid_all.json)

  async function showRange(id, { fit = true } = {}) {
    const sp = byId.get(id);
    if (!sp) return;
    state.rangeId = id;
    if (rangeLayer) { rangeLayer.remove(); rangeLayer = null; }
    const bar = $("#range-bar");
    bar.hidden = false;

    if (!sp.rm) {
      $("#range-text").innerHTML = t("range_none", { name: escapeHtml(sp.b) });
      cellLayer.setOpacity(1);
      $("#legend-title").textContent = t("legend_title");
      writeHash();
      return;
    }

    const g = await loadGridAll();
    if (state.rangeId !== id) return;
    const { canvas, ctx, img } = newCanvas();
    let n = 0, bounds = null;
    for (const [key, idx] of Object.entries(g.cells)) {
      const bits = g.sets[idx];
      if (!bits || !((bits[id >> 3] >> (id & 7)) & 1)) continue;
      img.data.set(RANGE_RGBA, pixel(key));
      const [c, r] = key.split("_").map(Number);
      const b = cellBounds(c, r);
      bounds = bounds ? bounds.extend(b) : b;
      n++;
    }
    ctx.putImageData(img, 0, 0);
    rangeLayer = L.imageOverlay(canvas.toDataURL("image/png"), gridExtent().bounds,
      { pane: "range", className: "cells", interactive: false }).addTo(map);
    cellLayer.setOpacity(0.35);
    $("#legend-title").textContent = t("legend_range");
    $("#range-text").innerHTML = t("range_showing", { name: escapeHtml(sp.b), n: nf(n) });
    if (fit && bounds) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
    writeHash();
  }

  function clearRange() {
    state.rangeId = null;
    if (rangeLayer) { rangeLayer.remove(); rangeLayer = null; }
    if (cellLayer) cellLayer.setOpacity(1);
    $("#range-bar").hidden = true;
    $("#legend-title").textContent = t("legend_title");
    $("#species-find").value = "";
    writeHash();
  }

  function setupFind() {
    const opts = species.slice().sort((a, b) => a.b.localeCompare(b.b))
      .map((s) => `<option value="${escapeHtml(s.c ? `${s.b} – ${s.c}` : s.b)}"></option>`).join("");
    $("#species-options").innerHTML = opts;
    const input = $("#species-find");
    const find = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      const name = q.split(" – ")[0];
      const sp = species.find((s) => s.b.toLowerCase() === name) ||
                 species.find((s) => (s.c || "").toLowerCase() === q) ||
                 species.find((s) => s.b.toLowerCase().startsWith(name) || (s.c || "").toLowerCase().includes(q));
      if (sp) { input.value = sp.c ? `${sp.b} – ${sp.c}` : sp.b; showRange(sp.id, { fit: true }); }
      else toast(t("find_none", { q: input.value.trim() }));
    };
    input.addEventListener("change", find);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); find(); } });
  }

  // ---------------------------------------------------------------------------
  // Photos and species cards

  function thumb(sp, size = 44) {
    if (sp.im) {
      return `<a class="thumb" href="${escapeHtml(sp.ip || sp.im)}" target="_blank" rel="noopener" ` +
        `data-id="${sp.id}" data-credit="${escapeHtml(sp.ic || "")}" aria-label="${escapeHtml(t("photo_open", { name: sp.b, credit: sp.ic || "" }))}">` +
        `<img src="${escapeHtml(sp.im)}" alt="${escapeHtml(t("photo_of", { name: sp.b }))}" width="${size}" height="${size}" loading="lazy" ` +
        `onerror="this.onerror=null;this.src='${NO_PHOTO}';this.alt=''"></a>`;
    }
    return `<span class="thumb none" data-id="${sp.id}"><img src="${NO_PHOTO}" alt="${escapeHtml(t("no_photo"))}" width="${size}" height="${size}"></span>`;
  }

  // Wikipedia summaries (data/summaries.json): {"id": [en text, en page, pt text, pt page]},
  // loaded the first time a card opens
  function loadSummaries() {
    if (!summariesPromise) summariesPromise = getJSON("data/summaries.json").catch(() => ({}));
    return summariesPromise;
  }
  function summaryFor(entry) {
    if (!entry) return null;
    const [en, , pt] = entry;
    return lang === "pt" ? (pt || en) : (en || pt);
  }

  // Species card on hover or keyboard focus (devices with a pointer only): the
  // photo uncropped, the name, a short Wikipedia summary and the photo credit
  function setupPhotoPreview() {
    if (!window.matchMedia("(hover: hover)").matches) return;
    const box = document.createElement("div");
    box.className = "photo-preview";
    box.hidden = true;
    box.innerHTML = '<img alt=""><div class="pp-name"></div><p class="pp-bio"></p><div class="pp-credit"></div>';
    document.body.appendChild(box);
    const img = box.querySelector("img"), bio = box.querySelector(".pp-bio");
    let current = null;

    const place = (el) => {
      // Beside the species column (or list item), so the name stays visible
      const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, pad = 12;
      const col = (el.closest(".tabulator-cell, li") || el).getBoundingClientRect();
      let left = col.right + pad;
      if (left + w > window.innerWidth - pad) left = Math.max(pad, col.left - pad - w);
      if (left + w > window.innerWidth - pad || left < 0) left = Math.max(pad, r.right + pad);
      const top = Math.min(Math.max(pad, r.top + r.height / 2 - h / 2), window.innerHeight - h - pad);
      box.style.left = `${left}px`; box.style.top = `${top}px`;
    };

    const show = async (el) => {
      current = el;
      const sp = byId.get(Number(el.dataset.id));
      if (!sp) return;
      const src = el.querySelector("img")?.getAttribute("src");
      const hasPhoto = !!src && !src.endsWith("no-photo.svg");
      const summaries = await loadSummaries();
      if (current !== el) return;                    // the pointer has moved on
      const summary = summaryFor(summaries[sp.id]);
      if (!hasPhoto && !summary) { box.hidden = true; return; }

      img.hidden = !hasPhoto;
      if (hasPhoto) img.src = src;
      box.querySelector(".pp-name").textContent = sp.b;
      bio.hidden = !summary;
      if (summary) bio.innerHTML = `${escapeHtml(summary)} <span class="pp-src">${t("wiki_src")}</span>`;
      const credit = box.querySelector(".pp-credit");
      credit.hidden = !hasPhoto;
      credit.textContent = hasPhoto ? t("photo_credit", { credit: el.dataset.credit || "" }) : "";
      box.hidden = false;
      place(el);
    };
    const hide = () => { current = null; box.hidden = true; };

    document.addEventListener("mouseover", (e) => { const el = e.target.closest(".thumb"); if (el) show(el); });
    document.addEventListener("mouseout", (e) => { if (e.target.closest(".thumb")) hide(); });
    document.addEventListener("focusin", (e) => { const el = e.target.closest(".thumb"); el ? show(el) : hide(); });
    window.addEventListener("scroll", hide, true);
  }

  // ---------------------------------------------------------------------------
  // Table

  function setupTableToolbar() {
    $("#table-search").addEventListener("input", applyTableFilters);
    $("#priority-only").addEventListener("change", applyTableFilters);
    $("#table-download").addEventListener("click", () => {
      table.download("csv", "brazilian_mammal_sequencing_priorities.csv", {}, "active");
      track("download-table", "Download priority table");
    });
  }

  function applyTableFilters() {
    if (!table) return;
    const q = $("#table-search").value.trim().toLowerCase();
    const onlyPriority = $("#priority-only").checked;
    table.setFilter((d) => {
      if (onlyPriority && !isPriority(d.gc) && !isPriority(d.lc)) return false;
      if (q && !(d.b.toLowerCase().includes(q) || (d.c || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }

  // (Re)built when the language changes
  function createTable() {
    if (table) table.destroy();
    const orders = [...new Set(species.map((s) => s.o))].sort();
    const catValues = ["Highest priority", "Near priority", "Research priority", "Watch priority", "None"];
    const catList = { values: Object.fromEntries(catValues.map((c) => [c, catShort(c)])), clearable: true };
    const statusList = (key) => ({ values: [...new Set(species.map((s) => s[key]))].sort(), clearable: true });
    const num = (field, title, d = 3) => ({
      title, field, hozAlign: "right", cssClass: "num", sorter: "number", headerFilter: false,
      formatter: (cell) => fmt(cell.getValue(), d), width: 92
    });
    const catFormatter = (persp) => (cell) => chip(persp, cell.getValue());
    const catSorter = (a, b) => (CATEGORY_ORDER.indexOf(a) + 10 * (a === "None")) - (CATEGORY_ORDER.indexOf(b) + 10 * (b === "None"));
    const filterPh = t("filter");

    table = new Tabulator("#priority-table", {
      data: species,
      index: "id",
      layout: "fitDataStretch",
      rowHeight: 80,
      columnDefaults: { vertAlign: "middle" },
      height: "620px",
      placeholder: t("no_match"),
      initialSort: [{ column: "bg", dir: "desc" }, { column: "gc", dir: "asc" }],
      columnHeaderVertAlign: "bottom",
      columns: [
        {
          title: t("col_species"), field: "b", frozen: true, minWidth: 300, headerFilter: "input",
          headerFilterPlaceholder: filterPh,
          formatter: (cell) => {
            const s = cell.getRow().getData();
            return `<div class="sp-cell">${thumb(s, 64)}<div class="sp-text"><span class="sp">${escapeHtml(s.b)}</span>` +
              `<span class="sp-links">${links(s)}</span></div></div>`;
          }
        },
        { title: t("col_common"), field: "c", minWidth: 150, headerFilter: "input", headerFilterPlaceholder: filterPh },
        { title: t("col_order"), field: "o", headerFilter: "list", headerFilterParams: { values: orders, clearable: true } },
        {
          title: t("col_category"), columns: [
            { title: t("chip_global"), field: "gc", formatter: catFormatter("global"), sorter: catSorter, headerFilter: "list", headerFilterParams: catList },
            { title: t("chip_local"), field: "lc", formatter: catFormatter("local"), sorter: catSorter, headerFilter: "list", headerFilterParams: catList }
          ]
        },
        {
          title: t("col_status"), columns: [
            { title: "IUCN", field: "iu", headerFilter: "list", headerFilterParams: statusList("iu"), width: 84 },
            { title: "SALVE", field: "sa", headerFilter: "list", headerFilterParams: statusList("sa"), width: 90 }
          ]
        },
        { title: "BPS", columns: [num("bg", t("chip_global")), num("bl", t("chip_local"))] },
        { title: t("col_ed"), columns: [num("eg", t("chip_global"), 2), num("el", t("chip_local"), 2)] },
        { title: t("col_ext"), columns: [num("ge", "GE₂"), num("le", "LE₂")] },
        num("po", "PO"),
        { title: t("col_np"), field: "np", hozAlign: "right", cssClass: "num", sorter: "number", width: 110,
          formatter: (cell) => `${cell.getValue()}/10` }
      ]
    });

    table.on("tableBuilt", applyTableFilters);
    table.on("dataFiltered", (filters, rows) => {
      $("#row-count").textContent = t("row_count", { n: rows.length, total: species.length });
    });
  }

  function showInTable(id) {
    const s = byId.get(id);
    $("#table-search").value = s.b;
    if (!isPriority(s.gc) && !isPriority(s.lc)) $("#priority-only").checked = false;
    applyTableFilters();
    $("#list-section").scrollIntoView();
    setTimeout(() => {
      const row = table.getRow(id);
      if (row) { row.scrollTo(); row.getElement().classList.add("flash"); }
    }, 250);
  }

  // ---------------------------------------------------------------------------
  // Citation

  const AUTHORS = [
    ["Luypaert", "Thomas", "T."], ["Farias", "Izeni Pires", "I. P."], ["Hrbek", "Tomas", "T."],
    ["Peres", "Carlos A.", "C. A."], ["Haugaasen", "Torbjørn", "T."]
  ];
  const ARTICLE_TITLE = "Knowledge gaps and sequencing priorities for mammalian eDNA metabarcoding in the world’s largest tropical forest country";

  function buildCitations(fmtName) {
    const fmtSel = fmtName || $(".cite-tabs [aria-selected='true']").dataset.fmt;
    const doi = val(meta.doi), articleDoi = val(meta.article_doi), version = val(meta.version) || "1.0.0";
    const year = "2026";
    const authorsText = AUTHORS.map(([f, , i]) => `${f}, ${i}`).join(", ").replace(/, ([^,]+, [^,]+)$/, " & $1");
    const dataTitle = `Data and code for: ${ARTICLE_TITLE}`;
    const ascii = (s) => s.replace("ø", "{\\o}").replace("’", "'");
    let article, data;

    if (fmtSel === "bibtex") {
      const au = ascii(AUTHORS.map(([f, g]) => `${f}, ${g}`).join(" and "));
      article = `@article{luypaert${year}knowledge,\n  author  = {${au}},\n  title   = {${ascii(ARTICLE_TITLE)}},\n  journal = {Nature Communications},\n  year    = {${year}},\n` +
        (articleDoi ? `  doi     = {${articleDoi}}\n}` : `  note    = {In review}\n}`);
      data = `@misc{luypaert${year}data,\n  author    = {${au}},\n  title     = {${ascii(dataTitle)}},\n  publisher = {Zenodo},\n  version   = {${version}},\n  year      = {${year}},\n  doi       = {${doi}},\n  url       = {https://doi.org/${doi}}\n}`;
    } else if (fmtSel === "ris") {
      const au = AUTHORS.map(([f, g]) => `AU  - ${f}, ${g}`).join("\n");
      article = `TY  - JOUR\n${au}\nTI  - ${ARTICLE_TITLE}\nJO  - Nature Communications\nPY  - ${year}\n` + (articleDoi ? `DO  - ${articleDoi}\n` : "") + "ER  - ";
      data = `TY  - DATA\n${au}\nTI  - ${dataTitle}\nPB  - Zenodo\nET  - ${version}\nPY  - ${year}\nDO  - ${doi}\nUR  - https://doi.org/${doi}\nER  - `;
    } else {
      article = `${authorsText} ${ARTICLE_TITLE}. Nature Communications (${year})` + (articleDoi ? `. https://doi.org/${articleDoi}` : ` (${t("in_review")}).`);
      data = `${authorsText} ${dataTitle} (version ${version}). Zenodo https://doi.org/${doi} (${year}).`;
    }
    $("#cite-article").textContent = article;
    $("#cite-data").textContent = data;
  }

  function setupCite() {
    const dlg = $("#cite-dialog");
    document.querySelectorAll("[data-open-cite]").forEach((b) => b.addEventListener("click", () => {
      buildCitations();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
      track("cite", "Open citation");
    }));
    $("#cite-close").addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));
    dlg.addEventListener("click", (e) => { if (e.target === dlg && dlg.close) dlg.close(); });   // click outside
    document.querySelectorAll(".cite-tabs [data-fmt]").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll(".cite-tabs [data-fmt]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      buildCitations(b.dataset.fmt);
    }));
    document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
      const text = $(`#${b.dataset.copy}`).textContent;
      if (await copyText(text)) toast(t("copied"));
      else { const r = document.createRange(); r.selectNodeContents($(`#${b.dataset.copy}`)); getSelection().removeAllRanges(); getSelection().addRange(r); }
    }));
    buildCitations("text");
  }

  // ---------------------------------------------------------------------------
  // Visitor and download counts (GoatCounter; no cookies, no personal data)

  function setupAnalytics() {
    gcCode = val(meta.goatcounter).replace(/[^a-z0-9-]/gi, "");
    if (!gcCode) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.dataset.goatcounter = `https://${gcCode}.goatcounter.com/count`;
    document.head.appendChild(s);
    $("#about-privacy").hidden = false;
  }

  function track(path, title) {
    try {
      if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path, title, event: true });
    } catch (e) { /* counting must never break the page */ }
  }

  async function loadCounter() {
    const el = $("#counter");
    const show = meta && val(meta.show_counter).toLowerCase() !== "false";
    if (!gcCode || !show) { el.hidden = true; return; }
    const get = async (path) => {
      try {
        const res = await fetch(`https://${gcCode}.goatcounter.com/counter/${encodeURIComponent(path)}.json`);
        return res.ok ? (await res.json()).count : null;
      } catch (e) { return null; }
    };
    const [visits, downloads] = await Promise.all([get("TOTAL"), get("download-sequences")]);
    const parts = [];
    if (visits) parts.push(t("counter_visits", { v: visits }));
    if (downloads) parts.push(t("counter_downloads", { d: downloads }));
    el.textContent = parts.join(" · ");
    el.hidden = parts.length === 0;
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
    updateCount();
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
    const m = s.match(/^([-+]?\d+(?:\.\d+)?)\s*°?\s*([NSEWLOnsewlo])?$/);
    if (!m) return null;
    let v = parseFloat(m[1]);
    let h = (m[2] || "").toUpperCase();
    if (h === "O") h = "W";          // Portuguese: oeste
    if (h === "L") h = "E";          // Portuguese: leste
    if (h === neg) v = -Math.abs(v);
    else if (h && h !== pos) return null;
    return v;
  }

  function parseLocation() {
    const a = $("#seq-lat").value, b = $("#seq-lon").value;
    if (!a.trim() && !b.trim()) return null;
    const lat = parseCoord(a, "N", "S"), lon = parseCoord(b, "E", "W");
    if (lat === null || lon === null) return { error: t("loc_err_both") };
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return { error: t("loc_err_range") };
    const key = cellKey(L.latLng(lat, lon));
    if (!(key in grid.cells)) {
      const hint = lon > 0 && lon < 75 ? t("hint_lon") : lat > 6 && lat < 34 ? t("hint_lat") : "";
      return { error: t("loc_err_out", { coords: fmtLatLon(lat, lon) }) + hint, lat, lon };
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
    if (loc && loc.key && map) {
      locMarker = L.marker([loc.lat, loc.lon], {
        icon: L.divIcon({ className: "", html: '<div class="loc-pin"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false, keyboard: false, title: t("loc_marker")
      }).addTo(map);
    }
  }

  function updateLocationStatus(loc, inCell) {
    const el = $("#loc-status");
    const lat = $("#seq-lat"), lon = $("#seq-lon");
    el.className = "loc-status";
    [lat, lon].forEach((i) => i.removeAttribute("aria-invalid"));
    if (!loc) {
      el.textContent = t("loc_default");
    } else if (loc.error) {
      el.classList.add("error");
      el.textContent = loc.error;
      [lat, lon].forEach((i) => i.setAttribute("aria-invalid", "true"));
    } else {
      el.classList.add("ok");
      el.innerHTML = inCell
        ? t("loc_ok", { coords: escapeHtml(fmtLatLon(loc.lat, loc.lon)), n: nf(inCell.size) })
        : escapeHtml(t("loc_in", { coords: fmtLatLon(loc.lat, loc.lon) }));
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
    if (!loaded || !$("#primer-groups").children.length) return;
    const sel = selection();
    const button = $("#seq-download");
    const gap = $("#seq-gap");
    const token = ++countToken;
    gap.hidden = true;

    let inCell = null;
    if (sel.loc && sel.loc.error) {
      updateLocationStatus(sel.loc);
      $("#seq-count").textContent = t("seq_fix_loc");
      button.disabled = true; return;
    }
    try {
      inCell = await cellSpecies(sel);
    } catch (err) {
      if (token !== countToken) return;
      updateLocationStatus({ error: t("loc_err_load", { msg: err.message }) });
      button.disabled = true; return;
    }
    if (token !== countToken) return;
    updateLocationStatus(sel.loc, inCell);

    if (!sel.primers.length) {
      $("#seq-count").textContent = t("seq_select_primer");
      button.disabled = true; return;
    }
    $("#seq-count").textContent = t("seq_counting");
    try {
      const rows = await selectedRows(sel, inCell);
      if (token !== countToken) return;
      const covered = new Set(rows.map((r) => r.sp.id));
      const where = inCell ? t("seq_where") : "";
      $("#seq-count").textContent = rows.length
        ? t(sel.primers.length > 1 ? "seq_count_n" : "seq_count_1", { n: nf(rows.length), s: nf(covered.size), where, p: sel.primers.length })
        : t("seq_none", { where });
      if (inCell) {
        const expected = species.filter(speciesFilter(sel, inCell));
        const missing = expected.length - covered.size;
        const filtered = sel.order || sel.priority ? t("gap_filtered") : "";
        const what = t(`what_${sel.primers.length > 1 ? "n" : "1"}${sel.unambiguous ? "_u" : ""}`);
        gap.textContent = missing > 0
          ? t("gap_missing", { m: nf(missing), e: nf(expected.length), filtered, what })
          : t("gap_all", { e: nf(expected.length), filtered, what });
        gap.hidden = false;
      }
      button.disabled = rows.length === 0;
    } catch (err) {
      $("#seq-count").textContent = t("seq_err", { msg: err.message });
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
    track("download-species-list", "Download species list for a location");
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
    // One event for the total, one with the details (format, primers, location)
    track("download-sequences", "Download reference sequences");
    track(`download-sequences/${ext}/${sel.primers.map((id) => locus(id).name).join("+")}${sel.loc && sel.loc.key ? "/location" : ""}`,
      "Download reference sequences (details)");
  }
})();
