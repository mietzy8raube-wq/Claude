"use strict";
// Verbindet die 3D-Übersicht (world.js) mit dem GF Tracker: lädt /api/landscape (nur der eigene Sichtbereich),
// aktualisiert bei jeder Änderung im Tracker (Server-Sent Events) und zeigt die echten Zahlen an Standorten,
// am Programm „GF Tracker“, im Serviceprozess und in den Meldungen.
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PRIO = { HIGHEST: "Höchste", HIGH: "Hoch", MEDIUM: "Mittel", LOW: "Niedrig", LOWEST: "Niedrigste" };
  // Servicestatus im Tracker → Schritt im Prozess „Wartung & Reparatur“ der Übersicht
  const SVC_STEPS = [["OPEN", "Fälligkeit oder Störung", "neu, noch nicht eingeplant"], ["SCHEDULED", "Termin abstimmen", "eingeplant"], ["PARTS", "Einsatz vorbereiten", "warten auf Ersatzteil"],
    ["WORKING", "Einsatz beim Kunden", "in Arbeit"], ["RESOLVED", "Vollständigkeit prüfen", "erledigt, noch nicht abgeschlossen"]];
  let data = null, sig = "", seen = new Set(), status = "connecting", timer = null, failures = 0;

  const style = document.createElement("style");
  style.textContent = `a.trow{color:inherit;text-decoration:none}a.trow:hover{background:var(--petrol-soft)}.gft-live{border-top:1px solid var(--line);margin-top:14px;padding-top:12px}
    .gft-live .h{display:flex;justify-content:space-between;align-items:center}.gft-live .h a{font:600 11px var(--font-body);text-transform:none;letter-spacing:0;color:var(--petrol)}
    .databadge.live{color:#166534;background:#dcfce7}.databadge.live:hover{background:#bbf7d0}.databadge.err{color:#991b1b;background:#fee2e2}
    .gft-back{display:inline-flex;align-items:center;gap:6px;font:600 12px var(--font-body);color:var(--petrol);background:var(--petrol-soft);border-radius:10px;padding:7px 10px;text-decoration:none;white-space:nowrap}
    .gft-back:hover{background:#dbe6ff}
    .gft-play{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:6px 0 14px;padding:11px 14px;border:0;border-radius:12px;cursor:pointer;font:600 13px var(--font-body);color:#fff;
      background:linear-gradient(135deg,#2f6bff,#6a4dff);box-shadow:0 6px 18px rgba(47,107,255,.35);transition:transform .15s,box-shadow .15s}
    .gft-play:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(47,107,255,.42)}@media (max-width:860px){.gft-back span{display:none}.gft-back{padding:7px 9px}#top .brand-txt b{font-size:14px!important}}`;
  document.head.appendChild(style);

  // Einzeldatei (systemlandschaft.html): kein Server – Zahlen werden im Browser aus Beispieldaten
  // oder aus einer geladenen Tracker-Sicherung (JSON) berechnet
  const STATIC = window.GFT_STATIC || null, TRACKER = "gf-suite-tracker.html"; let fileDb = null, fileName = "";
  // Als Fenster der Tracker-HTML geöffnet: Daten kommen laufend aus dem Tracker-Fenster (window.opener)
  const EMBED = !!window.GFT_EMBED; let dbSig = "";
  const trackerDb = () => { try { return window.opener && !window.opener.closed && window.opener.gftLandscapeDb ? window.opener.gftLandscapeDb() : null; } catch { return null; } };
  function dbSignature(d) { // ändert sich bei jeder Änderung an Vorgängen, Projekten, Teams oder Sprints
    let n = 0, m = ""; for (const i of d.issues) { n++; if (i.updatedAt > m) m = i.updatedAt; }
    return [n, m, d.projects.length, d.sprints.length, JSON.stringify(d.teams.map((t) => [t.id, t.site, t.name, t.memberIds.length])), JSON.stringify(d.projects.map((p) => [p.id, p.name, p.teamId, p.color])), JSON.stringify(d.sprints.map((x) => [x.id, x.state]))].join("|");
  }
  const badge = () => document.getElementById("dataBadge");
  function setBadge() {
    const b = badge(); if (!b) return;
    b.classList.toggle("live", status === "live" || status === "file"); b.classList.toggle("err", status === "error" || status === "login" || status === "closed");
    b.textContent = status === "live" ? "Live · GF Tracker" : status === "closed" ? "Tracker-Fenster geschlossen" : status === "demo" ? "Beispieldaten · GF Tracker" : status === "file" ? `Sicherung · ${fileName}` : status === "login" ? "Nicht angemeldet" : status === "error" ? "Verbindung unterbrochen" : "Verbinde …";
    b.title = data ? `Tracker-Daten vom ${new Date(data.at).toLocaleString("de-DE")} · übrige Programme: Beispieldaten` : "Datenquellen anzeigen";
  }

  async function load() {
    if (EMBED) {
      const d = trackerDb(); if (!d) { if (status !== "closed") { status = "closed"; setBadge(); } return; }
      const sg = dbSignature(d); if (sg === dbSig && data) { if (status !== "live") { status = "live"; setBadge(); } return; }
      dbSig = sg; data = STATIC.compute(d); status = "live"; sig = String(Math.random()); apply(); return;
    }
    if (STATIC) { data = STATIC.compute(fileDb); status = fileDb ? "file" : "demo"; sig = String(Math.random()); apply(); return; }
    try {
      const r = await fetch("/api/landscape", { credentials: "same-origin", headers: { "X-GFT": "1" } });
      if (r.status === 401) { status = "login"; setBadge(); return; }
      if (!r.ok) throw new Error(r.status);
      const d = await r.json(); failures = 0; status = "live";
      const s = JSON.stringify({ ...d, at: 0 }); data = d;
      if (s !== sig) { sig = s; apply(); } else setBadge();
    } catch { failures++; status = "error"; setBadge(); }
  }
  const soon = () => { clearTimeout(timer); timer = setTimeout(load, 1500); };

  function apply() {
    const W = window.DW; if (!W || !data) return;
    for (const loc of W.LOCATIONS) { const s = data.sites[loc.id]; if (s) { loc.openTasks = s.open; loc.tracker = s; } }
    const sys = W.SYSTEMS.find((x) => x.id === "tracker");
    if (sys) { sys.status = data.totals.sla ? "warn" : "ok"; sys.statusText = `${data.totals.open} offen${data.totals.sla ? ` · ${data.totals.sla} SLA verletzt` : ""}`; }
    const proc = W.PROCESSES.find((p) => p.id === "wartung");
    if (proc) for (const [st, name, what] of SVC_STEPS) {
      const step = proc.steps.find((s) => s.n === name); if (!step) continue; const v = data.service[st] || { n: 0, old: 0 };
      step.wip = v.n; step.state = v.old >= 3 ? "hot" : v.old ? "slow" : undefined;
      step.open = v.n ? `${v.n} ${what}${v.old ? `, davon ${v.old} seit mehr als 2 Tagen` : ""} (GF Tracker)` : undefined;
    }
    // neue Ereignisse als Meldung (beim ersten Laden nur die letzten drei)
    const fresh = data.events.filter((e) => !seen.has(e.id)); const first = !seen.size;
    data.events.forEach((e) => seen.add(e.id));
    (first ? fresh.slice(0, 3) : fresh.slice(0, 5)).reverse().forEach((e) => W.pushEvent({ st: e.st, text: `GF Tracker: ${e.text}`, go: W.byId[e.site] ? e.site : "tracker" }));
    syncFlags(); setBadge(); W.renderKpis(); if (window.GFTLevel) window.GFTLevel.update();
    const sel = W.selected; if (sel && W.byId[sel] && (W.byId[sel].type === "loc" || W.byId[sel].type === "tproj" || ["tracker", "sources"].includes(sel) || W.byId[sel].type === "step" || W.byId[sel].type === "proc")) W.renderDetail(sel);
  }

  const issueRows = (list) => list.map((i) => `<li><a class="trow" href="${esc(rel(i.url))}" target="_blank" rel="noopener"><span class="dot ${i.sla ? "bad" : i.overdue ? "warn" : "ok"}"></span><span>${esc(i.key)} · ${esc(i.summary)}<small>${esc(i.status)} · ${PRIO[i.prio] || esc(i.prio)}${i.assignee ? ` · ${esc(i.assignee)}` : " · nicht zugewiesen"}${i.sla ? " · SLA verletzt" : i.overdue ? " · überfällig" : ""}</small></span></a></li>`).join("");
  const facts = (s) => `<dl class="facts"><dt>Offen</dt><dd>${s.open}</dd><dt>SLA verletzt</dt><dd>${s.sla}</dd><dt>Überfällig</dt><dd>${s.overdue}</dd><dt>Hohe Priorität</dt><dd>${s.high}</dd><dt>Nicht zugewiesen</dt><dd>${s.unassigned}</dd><dt>Termine heute</dt><dd>${s.today}</dd></dl>`;
  const appLink = (h) => (STATIC ? `${TRACKER}${h}` : `/${h}`); // Seite läuft im Tracker selbst: relative Verweise
  const rel = (u) => (data && u.startsWith(data.appUrl) ? u.slice(data.appUrl.length) || "/" : u);
  const teamLinks = (teams) => teams.map((t) => `<li><a class="trow" href="${esc(appLink(`#/filters?jql=${encodeURIComponent(`team = "${t}" AND statusCategory != Done ORDER BY priority DESC`)}`))}" target="_blank" rel="noopener"><span class="dot ok"></span><span>Team ${esc(t)}<small>offene Vorgänge im Tracker</small></span></a></li>`).join("");

  /* ───── Tracker-Projekte als Fahnen in der 3D-Welt (am Standort des Projekt-Teams) ───── */
  const TFLAG_ANG = [25, -5, 55, 155, 185, 125].map((x) => (x * Math.PI) / 180);
  const tflags = new Map();
  const projState = (p) => (p.sla || p.overdue > 2 ? "bad" : p.overdue || p.statusBlocked ? "warn" : "ok");
  const flagLabel = (p) => `<span class="pb"><i style="width:${p.pct}%"></i></span>${esc(p.key)} · ${esc(p.name)}<b>${p.open} offen</b>`;
  function makeFlag(W, id, p, loc, idx) {
    const T3 = window.THREE; const RR = loc.r || 7.2; const a = TFLAG_ANG[idx % TFLAG_ANG.length]; const rr = RR - 0.55 - Math.floor(idx / TFLAG_ANG.length) * 0.9;
    const x = loc.x + Math.cos(a) * rr, z = loc.z + Math.sin(a) * rr; const H = loc.id === "hq" ? 4.6 : 3.2;
    const g = new T3.Group(); g.position.set(x, W.PLATE_Y, z);
    const pole = new T3.Mesh(new T3.CylinderGeometry(0.04, 0.04, H, 10), W.M.steel); pole.position.y = H / 2; pole.castShadow = true;
    const flagMat = W.mat(new T3.Color(p.color).getHex(), { roughness: 0.55 });
    const flag = new T3.Mesh(new T3.BoxGeometry(1.05, 0.6, 0.05), flagMat); flag.position.set(0.55, H - 0.33, 0); flag.castShadow = true;
    const track = new T3.Mesh(new T3.BoxGeometry(0.9, 0.09, 0.06), new T3.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })); track.position.set(0.55, H - 0.55, 0.005);
    const fill = new T3.Mesh(new T3.BoxGeometry(0.9, 0.09, 0.07), new T3.MeshBasicMaterial({ color: 0xffffff }));
    const foot = new T3.Mesh(new T3.CylinderGeometry(0.18, 0.22, 0.08, 16), W.M.steel); foot.position.y = 0.04;
    const ring = new T3.Mesh(new T3.RingGeometry(0.32, 0.46, 32), new T3.MeshBasicMaterial({ color: W.C.ok, transparent: true, opacity: 0.85, side: T3.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    // kleine Würfel am Fuß: offene Vorgänge (bis 9 sichtbar)
    const cubes = new T3.Group(); const cg = new T3.BoxGeometry(0.16, 0.16, 0.16);
    for (let k = 0; k < 9; k++) { const c = new T3.Mesh(cg, flagMat); c.position.set(-0.42 + (k % 3) * 0.19, 0.09 + Math.floor(k / 3) * 0.17, 0.32); c.castShadow = true; cubes.add(c); }
    g.add(W.tag(pole, id), W.tag(flag, id), track, fill, foot, ring, cubes); W.scene.add(g);
    W.objects[id] = { group: g, anchor: new T3.Vector3(x, W.PLATE_Y + H - 0.3, z), flag };
    const label = W.addLabel(id, "proj tproj", flagLabel(p), new T3.Vector3(x, W.PLATE_Y + H + 0.35, z), "proj");
    return { id, site: loc.id, idx, g, fill, ring, cubes, label, H };
  }
  function syncFlags() {
    const W = window.DW; if (!W || !W.scene || !data || !data.projects) return;
    const perSite = {}; const live = new Set();
    for (const p of data.projects) {
      const id = "tp-" + p.key; live.add(id); p.statusBlocked = p.items.some((i) => i.status === "BLOCKED");
      const loc = W.LOCATIONS.find((l) => l.id === p.site) || W.LOCATIONS[0]; const idx = perSite[loc.id] || 0; perSite[loc.id] = idx + 1;
      W.byId[id] = { type: "tproj", d: { name: p.name, at: loc.id, tracker: p } };
      let f = tflags.get(id);
      if (f && (f.site !== loc.id || f.idx !== idx)) { W.scene.remove(f.g); f.label.el.remove(); W.labels.splice(W.labels.indexOf(f.label), 1); f = null; }
      if (!f) { f = makeFlag(W, id, p, loc, idx); tflags.set(id, f); }
      const st = projState(p); const pct = Math.max(0.001, p.pct / 100);
      f.fill.scale.x = pct; f.fill.position.set(0.1 + 0.45 * pct, f.H - 0.55, 0.01);
      f.ring.material.color.setHex(W.C[st]); f.cubes.children.forEach((c, k) => (c.visible = k < p.open));
      f.label.el.className = `lbl proj tproj ${st}`; f.label.el.innerHTML = flagLabel(p); f.label.el.style.borderLeftColor = p.color; f.label.el.hidden = false; f.g.visible = W.layerState.proj; f.gone = false;
    }
    for (const f of tflags.values()) if (!live.has(f.id)) { f.gone = true; f.g.visible = false; f.label.el.hidden = true; }
    W.applyVisibility();
  }

  window.GFTLive = { get data() { return data; }, get label() { return EMBED ? "Live · GF Tracker" : status === "demo" ? "Beispieldaten" : status === "file" ? "Aus Sicherung" : "Live · GF Tracker"; } };
  function fileButton(top) {
    const b = document.createElement("button"); b.type = "button"; b.className = "gft-back"; b.innerHTML = "⤒<span> Daten laden</span>";
    b.title = "Sicherung aus dem GF Tracker laden (Einstellungen → Sicherung herunterladen, JSON) – bleibt auf diesem Gerät";
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json"; inp.hidden = true;
    inp.addEventListener("change", async () => {
      const f = inp.files[0]; if (!f) return;
      try { const j = JSON.parse(await f.text()); const d = j.data && j.data.issues ? j.data : j; if (!Array.isArray(d.issues) || !Array.isArray(d.projects)) throw new Error();
        fileDb = d; fileName = f.name.replace(/\.json$/i, "").slice(0, 28); seen.clear(); await load(); }
      catch { alert("Diese Datei ist keine Sicherung aus dem GF Tracker (JSON mit Vorgängen und Projekten)."); }
      inp.value = "";
    });
    b.addEventListener("click", () => inp.click()); top.insertBefore(inp, top.children[1]); top.insertBefore(b, top.children[1]);
  }
  const levelBtn = (pid, label) => `<button type="button" class="gft-play" data-level="${esc(pid)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>${label}</button>`;
  const wireLevel = (el) => el.querySelectorAll("[data-level]").forEach((b) => b.addEventListener("click", () => window.GFTLevel && window.GFTLevel.open(b.dataset.level)));
  window.DWHooks = {
    visibility(layers) { for (const f of tflags.values()) f.g.visible = layers.proj && !f.gone; },
    projList(el, filter) {
      if (!el || !data || !data.projects || !data.projects.length || filter === "bau") return;
      el.insertAdjacentHTML("beforeend", `<li class="grp">GF Tracker · ${STATIC ? esc(window.GFTLive.label) : "live"}</li>${data.projects.map((p) => { const st = projState(p);
        return `<li><button type="button" data-tp="tp-${esc(p.key)}"><span class="dot ${st}"></span><span class="who">${esc(p.name)}<em>${esc(p.key)} · ${p.open} offen · ${p.pct} % erledigt</em></span><span class="prog"><span class="pb ${st}"><i style="width:${p.pct}%"></i></span></span></button></li>`; }).join("")}`);
      el.querySelectorAll("[data-tp]").forEach((b) => b.addEventListener("click", () => window.DW.select(b.dataset.tp, true)));
    },
    ready() {
      const top = document.getElementById("top");
      if (top && !document.querySelector(".gft-back")) { const a = document.createElement("a"); a.className = "gft-back"; a.href = STATIC ? TRACKER : "/"; if (EMBED) a.addEventListener("click", (e) => { if (window.opener && !window.opener.closed) { e.preventDefault(); window.opener.focus(); } }); a.innerHTML = "←<span> GF Tracker</span>"; a.title = "Zurück zum Tracker"; top.insertBefore(a, top.firstChild); }
      setBadge(); load().then(() => { const m = location.hash.match(/^#level=([\w-]+)/); if (m && window.GFTLevel) window.GFTLevel.open(m[1]); });
      if (EMBED) { // jede Änderung im Tracker-Fenster erscheint hier nach spätestens einer Sekunde
        setInterval(load, 1000);
        document.addEventListener("click", (e) => { // Verweise auf Vorgänge/Projekte im Tracker-Fenster öffnen
          const a = e.target.closest && e.target.closest("a[href]"); if (!a) return; const h = a.getAttribute("href"); const k = h.indexOf("#/");
          if (k < 0 || !window.opener || window.opener.closed) return; e.preventDefault(); window.opener.location.hash = h.slice(k + 1); window.opener.focus();
        }, true);
        return;
      }
      if (STATIC) { fileButton(top); return; }
      try { const es = new EventSource("/api/events"); es.addEventListener("rev", soon); es.onerror = () => {}; } catch { /* ohne Live-Kanal reicht das Nachladen */ }
      setInterval(load, 60e3);
    },
    kpis(el) {
      if (!data) return;
      const t = data.totals;
      el.insertAdjacentHTML("afterbegin", `<button type="button" class="kpi" data-gft="tracker" title="Offene Vorgänge im GF Tracker"><strong>${t.open}</strong>Vorgänge</button>${t.sla ? `<button type="button" class="kpi bad" data-gft="tracker" title="SLA verletzt"><strong>${t.sla}</strong>SLA</button>` : ""}`);
      el.insertAdjacentHTML("beforeend", `<button type="button" class="kpi" data-level="wartung" title="Prozesse als Level"><strong>▶</strong>Level</button>`); wireLevel(el);
      el.querySelectorAll("[data-gft]").forEach((b) => b.addEventListener("click", () => window.DW.select("tracker", true)));
    },
    detail(id, entry, el) {
      const body = el.querySelector(".dbody"); if (!body) return;
      if (entry.type === "proc" || entry.type === "step") {
        const pr = entry.type === "proc" ? entry.d : entry.d.proc; const h = body.querySelector("h2");
        if (h && pr) { h.insertAdjacentHTML("afterend", levelBtn(pr.id, pr.id === "wartung" ? "Als Level öffnen · live" : "Als Level öffnen")); wireLevel(body); }
      }
      if (!data) { if (entry.type === "loc" || id === "tracker") body.insertAdjacentHTML("beforeend", `<section class="gft-live"><p class="h">GF Tracker</p><p class="hint">${status === "login" ? 'Nicht angemeldet. <a href="/login?next=/landschaft">Anmelden</a>' : "Daten werden geladen …"}</p></section>`); return; }
      if (entry.type === "tproj") {
        const p = entry.d.tracker; const st = projState(p); const site = data.sites[p.site];
        const ms = p.epics.length ? `<p class="h">Meilensteine (Epics)</p><ol class="ms">${p.epics.map((e, k) => `<li class="${e.done || e.pct === 100 ? "done" : k === p.epics.findIndex((x) => !x.done && x.pct < 100) ? "next" : ""}"><span><a href="${esc(rel(e.url))}" target="_blank" rel="noopener" style="color:inherit">${esc(e.summary)}</a> · ${e.pct} %${e.due ? ` · bis ${new Date(e.due).toLocaleDateString("de-DE")}` : ""}</span></li>`).join("")}</ol>` : "";
        const sp = p.sprint ? `<p class="h">Aktueller Sprint</p><dl class="facts"><dt>${esc(p.sprint.name)}</dt><dd>${p.sprint.done} von ${p.sprint.total} erledigt</dd>${p.sprint.goal ? `<dt>Ziel</dt><dd>${esc(p.sprint.goal)}</dd>` : ""}${p.sprint.end ? `<dt>Ende</dt><dd>${new Date(p.sprint.end).toLocaleDateString("de-DE")}</dd>` : ""}</dl>` : "";
        body.insertAdjacentHTML("beforeend", `<div class="eyebrow">Projekt im GF Tracker · ${esc(site ? site.name : "")}</div><h2>${esc(p.name)}</h2><p class="sub">${esc(p.desc || "")}</p>
          ${levelBtn("t-" + p.key, STATIC ? "Als Level öffnen" : "Als Level öffnen · live")}
          <div class="pills"><span class="pill ${st}">${st === "bad" ? "kritisch" : st === "warn" ? "Achtung" : "läuft"}</span><span class="pill ok">${STATIC ? esc(window.GFTLive.label) : "live aus dem Tracker"}</span></div>
          <div class="bigbar ${st}"><i style="width:${p.pct}%"></i></div>
          <dl class="facts"><dt>Offen</dt><dd>${p.open}</dd><dt>Erledigt</dt><dd>${p.done} (${p.pct} %)</dd><dt>Erledigt · 7 Tage</dt><dd>${p.done7}</dd><dt>Überfällig</dt><dd>${p.overdue}</dd><dt>SLA verletzt</dt><dd>${p.sla}</dd><dt>Nicht zugewiesen</dt><dd>${p.unassigned}</dd>${p.lead ? `<dt>Projektleitung</dt><dd>${esc(p.lead)}</dd>` : ""}${p.team ? `<dt>Team</dt><dd>${esc(p.team)}</dd>` : ""}</dl>
          ${sp}${ms}${p.items.length ? `<p class="h">Wichtigste offene Vorgänge</p><ul class="links" style="margin-bottom:12px">${issueRows(p.items.slice(0, 8).map((i) => ({ ...i, status: i.statusName })))}</ul>` : ""}
          <ul class="links"><li><a class="trow" href="${esc(rel(p.url))}" target="_blank" rel="noopener"><span class="dot ok"></span><span>Projekt im Tracker öffnen ↗<small>Board, Liste, Zeitleiste</small></span></a></li></ul>`);
        wireLevel(body); return;
      }
      if (entry.type === "loc" && data.sites[id]) {
        const s = data.sites[id];
        body.insertAdjacentHTML("beforeend", `<section class="gft-live"><p class="h"><span>GF Tracker · ${STATIC ? esc(window.GFTLive.label) : "live"}</span><a href="${esc(appLink("#/your-work"))}" target="_blank" rel="noopener">Tracker öffnen ↗</a></p>
          ${facts(s)}${s.top.length ? `<p class="h">Wichtigste offene Vorgänge</p><ul class="links" style="margin-bottom:12px">${issueRows(s.top)}</ul>` : '<p class="hint">Keine offenen Vorgänge an diesem Standort.</p>'}
          ${data.projects && data.projects.some((p) => p.site === id) ? `<p class="h">Projekte an diesem Standort</p><ul class="links" style="margin-bottom:12px">${data.projects.filter((p) => p.site === id).map((p) => `<li><button type="button" data-tp="tp-${esc(p.key)}"><span class="dot ${projState(p)}"></span><span>${esc(p.name)} (${esc(p.key)})<small>${p.open} offen · ${p.pct} % erledigt${p.overdue ? ` · ${p.overdue} überfällig` : ""}</small></span></button></li>`).join("")}</ul>` : ""}
          ${s.teams.length ? `<p class="h">Teams an diesem Standort</p><ul class="links">${teamLinks(s.teams)}</ul>` : '<p class="hint">Noch kein Team zugeordnet (im Tracker unter Teams → Standort).</p>'}</section>`);
        body.querySelectorAll("[data-tp]").forEach((b) => b.addEventListener("click", () => window.DW.select(b.dataset.tp, true)));
      } else if (id === "tracker") {
        const t = data.totals; const pill = body.querySelector(".pill.demo"); if (pill) pill.textContent = "Eigenentwicklung · im Einsatz";
        body.querySelectorAll("dl.facts dt").forEach((dt) => { if (dt.textContent === "Zugang") dt.nextElementSibling.innerHTML = '<a href="/" target="_blank" rel="noopener">Tracker öffnen ↗</a>'; });
        body.insertAdjacentHTML("beforeend", `<section class="gft-live"><p class="h"><span>${STATIC ? esc(window.GFTLive.label) : "Live"}${data.user ? ` · Sicht: ${esc(data.user.name)}` : ""}</span><a href="${esc(appLink("#/dashboard"))}" target="_blank" rel="noopener">Dashboard ↗</a></p>${facts(t)}
          <p class="h">Je Standort</p><ul class="links" style="margin-bottom:12px">${Object.entries(data.sites).map(([sid, s]) => `<li><button type="button" data-gsite="${sid}"><span class="dot ${s.sla ? "bad" : s.overdue ? "warn" : "ok"}"></span><span>${esc(s.name)}<small>${s.open} offen${s.sla ? ` · ${s.sla} SLA verletzt` : ""}${s.today ? ` · ${s.today} Termine heute` : ""}</small></span></button></li>`).join("")}</ul>
          <p class="h">Service (Wartung & Reparatur)</p><ul class="links" style="margin-bottom:12px">${SVC_STEPS.map(([st, , what]) => { const v = data.service[st] || { n: 0, old: 0 }; return `<li class="trow"><span class="dot ${v.old >= 3 ? "bad" : v.old ? "warn" : "ok"}"></span><span>${v.n} ${esc(what)}<small>${v.old ? `${v.old} seit mehr als 2 Tagen` : "im Fluss"}</small></span></li>`; }).join("")}</ul>
          <p class="h">Projekte</p><ul class="links">${data.projects.map((p) => `<li><a class="trow" href="${esc(appLink(`#/p/${encodeURIComponent(p.key)}`))}" target="_blank" rel="noopener"><span class="dot ok"></span><span>${esc(p.name)} (${esc(p.key)})<small>${p.open} offen · ${p.pct} % erledigt</small></span></a></li>`).join("")}</ul>
          <p class="hint" style="margin-top:12px">Stand ${new Date(data.at).toLocaleTimeString("de-DE")}. Aktualisiert sich bei jeder Änderung im Tracker. Standorte ergeben sich aus dem Team des Vorgangs (Tracker → Teams → Standort).</p></section>`);
        body.querySelectorAll("[data-gsite]").forEach((b) => b.addEventListener("click", () => window.DW.select(b.dataset.gsite, true)));
      } else if (id === "sources") {
        const m = body.querySelector(".msg.warn"); if (m) { m.className = "msg plan"; m.textContent = `Der GF Tracker ist live angebunden (Stand ${new Date(data.at).toLocaleTimeString("de-DE")}): offene Vorgänge je Standort, SLA, Servicestände und Meldungen. Die übrigen Programme laufen noch mit Beispieldaten.`; }
      }
    },
  };
})();
