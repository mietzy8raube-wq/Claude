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
  const badge = () => document.getElementById("dataBadge");
  function setBadge() {
    const b = badge(); if (!b) return;
    b.classList.toggle("live", status === "live" || status === "file"); b.classList.toggle("err", status === "error" || status === "login");
    b.textContent = status === "live" ? "Live · GF Tracker" : status === "demo" ? "Beispieldaten · GF Tracker" : status === "file" ? `Sicherung · ${fileName}` : status === "login" ? "Nicht angemeldet" : status === "error" ? "Verbindung unterbrochen" : "Verbinde …";
    b.title = data ? `Tracker-Daten vom ${new Date(data.at).toLocaleString("de-DE")} · übrige Programme: Beispieldaten` : "Datenquellen anzeigen";
  }

  async function load() {
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
    setBadge(); W.renderKpis(); if (window.GFTLevel) window.GFTLevel.update();
    const sel = W.selected; if (sel && W.byId[sel] && (W.byId[sel].type === "loc" || ["tracker", "sources"].includes(sel) || W.byId[sel].type === "step" || W.byId[sel].type === "proc")) W.renderDetail(sel);
  }

  const issueRows = (list) => list.map((i) => `<li><a class="trow" href="${esc(rel(i.url))}" target="_blank" rel="noopener"><span class="dot ${i.sla ? "bad" : i.overdue ? "warn" : "ok"}"></span><span>${esc(i.key)} · ${esc(i.summary)}<small>${esc(i.status)} · ${PRIO[i.prio] || esc(i.prio)}${i.assignee ? ` · ${esc(i.assignee)}` : " · nicht zugewiesen"}${i.sla ? " · SLA verletzt" : i.overdue ? " · überfällig" : ""}</small></span></a></li>`).join("");
  const facts = (s) => `<dl class="facts"><dt>Offen</dt><dd>${s.open}</dd><dt>SLA verletzt</dt><dd>${s.sla}</dd><dt>Überfällig</dt><dd>${s.overdue}</dd><dt>Hohe Priorität</dt><dd>${s.high}</dd><dt>Nicht zugewiesen</dt><dd>${s.unassigned}</dd><dt>Termine heute</dt><dd>${s.today}</dd></dl>`;
  const appLink = (h) => (STATIC ? `${TRACKER}${h}` : `/${h}`); // Seite läuft im Tracker selbst: relative Verweise
  const rel = (u) => (data && u.startsWith(data.appUrl) ? u.slice(data.appUrl.length) || "/" : u);
  const teamLinks = (teams) => teams.map((t) => `<li><a class="trow" href="${esc(appLink(`#/filters?jql=${encodeURIComponent(`team = "${t}" AND statusCategory != Done ORDER BY priority DESC`)}`))}" target="_blank" rel="noopener"><span class="dot ok"></span><span>Team ${esc(t)}<small>offene Vorgänge im Tracker</small></span></a></li>`).join("");

  window.GFTLive = { get data() { return data; }, get label() { return status === "demo" ? "Beispieldaten" : status === "file" ? "Aus Sicherung" : "Live · GF Tracker"; } };
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
    ready() {
      const top = document.getElementById("top");
      if (top && !document.querySelector(".gft-back")) { const a = document.createElement("a"); a.className = "gft-back"; a.href = STATIC ? TRACKER : "/"; a.innerHTML = "←<span> GF Tracker</span>"; a.title = "Zurück zum Tracker"; top.insertBefore(a, top.firstChild); }
      setBadge(); load().then(() => { const m = location.hash.match(/^#level=([\w-]+)/); if (m && window.GFTLevel) window.GFTLevel.open(m[1]); });
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
      if (entry.type === "loc" && data.sites[id]) {
        const s = data.sites[id];
        body.insertAdjacentHTML("beforeend", `<section class="gft-live"><p class="h"><span>GF Tracker · ${STATIC ? esc(window.GFTLive.label) : "live"}</span><a href="${esc(appLink("#/your-work"))}" target="_blank" rel="noopener">Tracker öffnen ↗</a></p>
          ${facts(s)}${s.top.length ? `<p class="h">Wichtigste offene Vorgänge</p><ul class="links" style="margin-bottom:12px">${issueRows(s.top)}</ul>` : '<p class="hint">Keine offenen Vorgänge an diesem Standort.</p>'}
          ${s.teams.length ? `<p class="h">Teams an diesem Standort</p><ul class="links">${teamLinks(s.teams)}</ul>` : '<p class="hint">Noch kein Team zugeordnet (im Tracker unter Teams → Standort).</p>'}</section>`);
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
