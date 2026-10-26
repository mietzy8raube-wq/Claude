// Systemlandschaft: die 3D-Übersicht „Digitale Welt“ (landscape/digitale-welt.html, aus dem GF-Suite-Prototyp)
// läuft als Seite des Trackers unter /landschaft und zeigt dort echte Tracker-Daten statt Beispielen.
// Die Quelldatei bleibt unverändert, damit neue Stände des Prototyps einfach übernommen werden können;
// beim Start wird sie hier angepasst: three.js lokal statt CDN, Skript als eigene Datei (CSP ohne Inline-Skripte),
// GF Tracker als Programm in der Systemebene und Einhängepunkte für public/landschaft/live.js und level.js (Prozess-Level).
import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SITE = "hq"; // Teams ohne Standort erscheinen in der Zentrale

/** Ersetzt genau ein Vorkommen; schlägt laut fehl, wenn sich die Quelle geändert hat. */
function patch(src, find, repl, what) {
  const n = src.split(find).length - 1;
  if (n !== 1) throw new Error(`Systemlandschaft: Anpassung „${what}“ passt nicht (${n}× gefunden). Wurde landscape/digitale-welt.html aktualisiert?`);
  return src.replace(find, () => repl);
}

export function buildLandscape(srcFile) {
  let src = fs.readFileSync(srcFile, "utf8");
  // Schriften von Google weglassen (Systemschrift greift), three.js aus /vendor
  src = src.replace(/<link rel="preconnect"[^>]*>\s*/g, "").replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, "");
  src = patch(src, '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>', '<script src="/vendor/three/three.min.js"></script>', "three.js");
  src = patch(src, '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js"></script>', '<script src="/vendor/three/OrbitControls.js"></script>', "OrbitControls");
  src = patch(src, '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/geometries/RoundedBoxGeometry.js"></script>', '<script src="/vendor/three/RoundedBoxGeometry.js"></script>', "RoundedBoxGeometry");
  src = patch(src, 'Beispieldaten</button>', 'Verbinde …</button>', "Datenstand");

  const start = src.lastIndexOf("<script>"); const end = src.indexOf("</script>", start);
  if (start < 0 || end < 0) throw new Error("Systemlandschaft: Hauptskript nicht gefunden.");
  let js = src.slice(start + 8, end);
  js = patch(js, "const SYSTEMS = [", `const SYSTEMS = [
  { id: 'tracker', name: 'GF Tracker', kind: 'Vorgänge & Service', role: 'Störungen, Wartungen, Aufgaben und Projekte – live angebunden', status: 'ok', real: true },`, "Programm GF Tracker");
  js = patch(js, "const SOURCES = {", `const SOURCES = {
  tracker: { conn: 'live', phase: 1, feeds: 'Offene Vorgänge je Standort, SLA, Termine, Servicestände, Ereignisse', way: 'GF Tracker, /api/landscape (angemeldet, mit Sichtbereich)' },`, "Datenquelle GF Tracker");
  js = patch(js, "const LINKS = [", `const LINKS = [
  { id: 'lt1', from: 'tracker', to: 'm365', name: 'E-Mail, Teams & Kalender', desc: 'Der GF Tracker legt Vorgänge aus E-Mails an, meldet sich in Teams und gleicht Servicetermine mit Outlook ab (sobald unter Integrationen eingerichtet).', status: 'check', rate: 3, dir: 'both' },
  { id: 'lt2', from: 'factorial', to: 'tracker', name: 'Abwesenheiten', desc: 'Urlaub und Abwesenheit aus Factorial fließen in die automatische Zuweisung (sobald eingerichtet).', status: 'check', rate: 1, dir: 'fwd' },`, "Informationsbezüge GF Tracker");
  js = patch(js, "function renderKpis() {", "function renderKpis() { renderKpis0(); if (window.DWHooks && window.DWHooks.kpis) window.DWHooks.kpis(kpis); }\nfunction renderKpis0() {", "Kennzahlen");
  js = patch(js, "function renderDetail(id) {", "function renderDetail(id) { renderDetail0(id); if (id && byId[id] && window.DWHooks && window.DWHooks.detail) window.DWHooks.detail(id, byId[id], detail); }\nfunction renderDetail0(id) {", "Details");
  js = patch(js, "AGENTS.forEach(a => { objects[a.id].group.visible = layerState.agent; });", "AGENTS.forEach(a => { objects[a.id].group.visible = layerState.agent; }); if (window.DWHooks && window.DWHooks.visibility) window.DWHooks.visibility(layerState, mode);", "Sichtbarkeit");
  js = patch(js, "function renderProjList() {", "function renderProjList() { renderProjList0(); if (window.DWHooks && window.DWHooks.projList) window.DWHooks.projList(document.getElementById('projlist'), projFilter); }\nfunction renderProjList0() {", "Vorhabenliste");
  js = patch(js, "function tick() {", "function tick() { if (window.DWPaused) { requestAnimationFrame(tick); return; } // Prozess-Level offen: Welt ruht", "Pause");
  js = patch(js, "if (location.protocol === 'file:') window.__dw", `window.DW = { LOCATIONS, SYSTEMS, PROCESSES, GROUPS, scene, addLabel, tag, labels, layerState, applyVisibility, PLATE_Y, C, M, mat, byId, objects, select, pushEvent, popAt, renderKpis, renderDetail, renderLocList, get selected() { return selected; } };
if (window.DWHooks && window.DWHooks.ready) window.DWHooks.ready();
if (location.protocol === 'file:') window.__dw`, "Schnittstelle");

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="icon" href="/icons/icon-64.png"><style>body{margin:0}</style></head><body>
${src.slice(0, start)}<script src="/landschaft/live.js"></script>
<script src="/landschaft/world.js"></script>
<script src="/landschaft/level.js"></script>${src.slice(end + 9)}</body></html>`;
  return { html, js };
}

let cache = null;
export function landscapeAssets(root) {
  const f = path.join(root, "landscape", "digitale-welt.html");
  const mt = fs.statSync(f).mtimeMs;
  if (!cache || cache.mt !== mt) cache = { mt, ...buildLandscape(f) };
  return cache;
}

/** Zusammenfassung für die 3D-Übersicht aus den (bereits auf den Sichtbereich beschränkten) Vorgängen. */
export function landscapeData({ S, issues, projects, teams, users, sprints = [], appUrl, company, user, now = Date.now() }) {
  const P = new Map(projects.map((p) => [p.id, p])); const T = new Map(teams.map((t) => [t.id, t])); const U = new Map(users.map((u) => [u.id, u]));
  const key = (i) => `${P.get(i.projectId)?.key || "?"}-${i.no}`;
  const link = (i) => `${appUrl}/#/your-work?issue=${encodeURIComponent(key(i))}`;
  const SITES = S.SITES; const known = new Set(SITES.map((s) => s.id));
  const siteOf = (i) => { const t = T.get(i.teamId) || T.get(P.get(i.projectId)?.teamId); return t?.site && known.has(t.site) ? t.site : DEFAULT_SITE; };
  const today = new Date(now); const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const blank = () => ({ open: 0, overdue: 0, sla: 0, unassigned: 0, today: 0, high: 0, top: [] });
  const totals = blank(); delete totals.top;
  const sites = Object.fromEntries(SITES.map((s) => [s.id, { name: s.name, teams: teams.filter((t) => (known.has(t.site) ? t.site : DEFAULT_SITE) === s.id).map((t) => t.name), ...blank() }]));
  const service = {}; const svcAge = 2 * 864e5; const projStat = new Map();
  // Einzelne Service-Vorgänge für die Prozess-Level (Spielsteine je Station)
  const statusSince = (i) => i.history.reduce((m, h) => (h.field === "Status" && h.at > m ? h.at : m), "") || i.createdAt;
  const flowItems = []; let done7 = 0, doneToday = 0;
  const flowItem = (i, p, sla) => flowItems.push({ key: key(i), summary: i.summary, status: i.status, statusName: S.statusInfo(p, i.status).name, type: i.type, prio: i.priority,
    assignee: U.get(i.assigneeId)?.name || null, sla: !!sla, ageH: Math.round((now - new Date(statusSince(i)).getTime()) / 36e5), url: link(i), site: siteOf(i) });
  const events = [];
  // Projekte: Fahnen in der 3D-Welt und je ein Level (Stationen = Status des Projekts, Spielsteine = offene Vorgänge)
  const siteOfTeam = (t) => (t?.site && known.has(t.site) ? t.site : DEFAULT_SITE);
  const projOf = (p) => {
    let ps = projStat.get(p.id); if (ps) return ps;
    const t = T.get(p.teamId);
    ps = { id: p.id, key: p.key, name: p.name, color: p.color || "#2f6bff", type: p.type, desc: p.desc || "", site: siteOfTeam(t), team: t?.name || null, lead: U.get(p.leadId)?.name || null,
      open: 0, done: 0, overdue: 0, sla: 0, unassigned: 0, done7: 0, staleH: p.type === "service" ? 48 : 168, items: [], epics: [], sprint: null,
      statuses: S.workflowFor(p).filter((x) => x.cat !== "done").map((x) => ({ id: x.id, name: x.name, cat: x.cat })), url: `${appUrl}/#/p/${encodeURIComponent(p.key)}` };
    projStat.set(p.id, ps); return ps;
  };
  const epicCount = new Map(); const epics = [];
  for (const i of issues) {
    const p = P.get(i.projectId); if (!p) continue;
    if (i.type === "EPIC") { epics.push(i); continue; }
    if (i.epicId) { const c = epicCount.get(i.epicId) || { open: 0, done: 0 }; S.statusInfo(p, i.status).cat === "done" ? c.done++ : c.open++; epicCount.set(i.epicId, c); }
  }
  for (const e of epics) {
    const p = P.get(e.projectId); const c = epicCount.get(e.id) || { open: 0, done: 0 }; const n = c.open + c.done;
    projOf(p).epics.push({ key: key(e), summary: e.summary, due: e.dueDate || null, done: S.statusInfo(p, e.status).cat === "done", pct: n ? Math.round(c.done / n * 100) : 0, url: link(e) });
  }
  for (const sp of sprints) {
    const p = P.get(sp.projectId); if (!p || sp.state !== "active") continue;
    const list = issues.filter((i) => i.sprintId === sp.id && i.type !== "EPIC"); const dn = list.filter((i) => S.statusInfo(p, i.status).cat === "done").length;
    projOf(p).sprint = { name: sp.name, goal: sp.goal || "", end: sp.end || null, total: list.length, done: dn };
  }
  for (const i of issues) {
    const p = P.get(i.projectId); if (!p || i.type === "EPIC") continue;
    const cat = S.statusInfo(p, i.status).cat;
    const ps = projOf(p);
    for (const h of i.history) if (h.field === "Status" || h.to === "erstellt") events.push({ at: h.at, i, h, p });
    if (cat === "done") {
      ps.done++; if (i.resolvedAt && now - new Date(i.resolvedAt).getTime() < 7 * 864e5) ps.done7++;
      if (p.type === "service") {
        const r = i.resolvedAt ? now - new Date(i.resolvedAt).getTime() : Infinity; if (r < 7 * 864e5) done7++; if (i.resolvedAt && i.resolvedAt.slice(0, 10) === ymd) doneToday++;
        if (i.status === "RESOLVED") { const s = (service.RESOLVED ||= { n: 0, old: 0 }); s.n++; if (now - new Date(statusSince(i)).getTime() > svcAge) s.old++; flowItem(i, p, false); }
      }
      continue;
    }
    ps.open++;
    const st = sites[siteOf(i)];
    const overdue = !!i.dueDate && i.dueDate < ymd;
    const r = S.slaCompute(i, p, "resolve"), f = S.slaCompute(i, p, "first"); const sla = !!((r && !r.stopped && r.breached) || (f && !f.stopped && f.breached));
    if (overdue) ps.overdue++; if (sla) ps.sla++; if (!i.assigneeId) ps.unassigned++;
    ps.items.push({ key: key(i), summary: i.summary, status: i.status, statusName: S.statusInfo(p, i.status).name, type: i.type, prio: i.priority, assignee: U.get(i.assigneeId)?.name || null,
      sla, overdue, ageH: Math.round((now - new Date(statusSince(i)).getTime()) / 36e5), url: link(i), site: siteOf(i) });
    const appt = !!i.appointmentAt && i.appointmentAt.slice(0, 10) === ymd; const high = i.priority === "HIGH" || i.priority === "HIGHEST";
    for (const x of [totals, st]) { x.open++; if (overdue) x.overdue++; if (sla) x.sla++; if (!i.assigneeId) x.unassigned++; if (appt) x.today++; if (high) x.high++; }
    st.top.push({ key: key(i), summary: i.summary, status: S.statusInfo(p, i.status).name, prio: i.priority, assignee: U.get(i.assigneeId)?.name || null, due: i.dueDate || null, sla, overdue, url: link(i),
      w: (sla ? 8 : 0) + (overdue ? 4 : 0) + (S.PRIOS[i.priority]?.rank || 0) });
    if (p.type === "service") { const s = (service[i.status] ||= { n: 0, old: 0 }); s.n++; if (now - new Date(statusSince(i)).getTime() > svcAge) s.old++; flowItem(i, p, sla); }
  }
  for (const s of Object.values(sites)) { s.top = s.top.sort((a, b) => b.w - a.w).slice(0, 8).map(({ w, ...x }) => x); }
  events.sort((a, b) => b.at.localeCompare(a.at));
  const ev = events.slice(0, 15).map(({ at, i, h, p }) => {
    const isNew = h.to === "erstellt";
    return { id: h.id || `${i.id}:${at}`, at, site: siteOf(i), key: key(i), url: link(i),
      st: isNew && (i.priority === "HIGHEST" || i.type === "INCIDENT") ? "warn" : "ok",
      text: isNew ? `${key(i)} neu: ${i.summary}` : `${key(i)} → ${h.to}: ${i.summary}` };
  });
  return {
    at: new Date(now).toISOString(), appUrl, company, user: user ? { name: user.name, role: user.role } : null,
    sites, totals, service, events: ev,
    flow: { items: flowItems.sort((a, b) => (b.sla - a.sla) || (b.ageH - a.ageH)).slice(0, 240), done7, doneToday,
      open: flowItems.filter((x) => x.status !== "RESOLVED").length, sla: flowItems.filter((x) => x.sla).length },
    projects: [...projStat.values()].map((x) => ({ ...x, pct: x.open + x.done ? Math.round(x.done / (x.open + x.done) * 100) : 0,
      items: x.items.sort((a, b) => (b.sla - a.sla) || (b.overdue - a.overdue) || (b.ageH - a.ageH)).slice(0, 200), epics: x.epics.sort((a, b) => (a.due || "9").localeCompare(b.due || "9")) })),
    defaultSite: DEFAULT_SITE,
  };
}
