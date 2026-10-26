"use strict";
/* ======================================================================
   GF Tracker – Browser-App. Daten liegen auf dem Server; Änderungen werden
   als Patches synchronisiert und per Server-Sent Events live verteilt.
   Fachlogik (Workflows, SLA, Patch-Verfahren) steckt in shared.js.
   ====================================================================== */
const { TRANSITIONS, transitionsFor, TYPES, PROJECT_TYPES, WORKFLOWS, CAT_LABEL, PRIOS, SLA, REQUEST_TYPES, URGENCY, PALETTE, ROLES, ROLE_INFO, SITES, FULL_ACCESS, userScope, accessContext, canEdit,
  pad, dayKey, today, parseDay, addDays, daysBetween, uid, hashColor, fmtDur, statusInfo, slaCompute, applyTransition, newIssue, diffEntity, applyPatch,
  nextMaintenance, customerSnapshot, customerAddress, maintenanceIssueData } = TrackerShared;

/* ---------- Symbole ---------- */
const ICONS = {
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  bug: '<circle cx="12" cy="12" r="5" fill="currentColor" stroke="none"/>',
  sub: '<path d="M7 4v10h10M13 10l4 4-4 4"/>',
  alert: '<path d="M12 3 2 21h20zM12 10v5M12 18h.01"/>',
  help: '<path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V14M12 18h.01"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  backlog: '<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>',
  timeline: '<path d="M3 6h10M7 12h11M5 18h8"/>',
  chart: '<path d="M3 21h18M6 17V9m5 8V5m5 12v-6m4 6v-3"/>',
  queue: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M2 12h3m14 0h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', play: '<path d="M7 4v16l13-8z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>', star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  home: '<path d="M3 11 12 3l9 8M5 9v12h14V9"/>', folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  filter: '<path d="M3 4h18l-7 9v6l-4 2v-8z"/>', dash: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>', portal: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
};
const icon = (n, cls = "i") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;


/* ---------- Hilfsfunktionen ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDay = (k) => k ? parseDay(k).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
const fmtShort = (k) => parseDay(k).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
const fmtDT = (iso) => iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }) : "–";
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); const r = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  if (Math.abs(m) < 60) return r.format(-m, "minute"); const h = Math.round(m / 60); if (Math.abs(h) < 24) return r.format(-h, "hour"); return r.format(-Math.round(h / 24), "day"); };
const initials = (n) => (n || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const clone = (o) => JSON.parse(JSON.stringify(o));
function toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; const box = $("#toasts"); box.appendChild(el); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => el.remove(), 4000); }

/* ---------- Server-Verbindung & Synchronisierung ----------
   Ablauf: Jede Änderung ruft save() auf. Kurz danach vergleicht flush() den
   lokalen Stand mit dem zuletzt bestätigten Serverstand ("base") und schickt
   nur die Unterschiede als Patch. Der Server führt Änderungen mehrerer Personen
   feldweise zusammen und meldet per Event, dass es Neues gibt; pull() holt dann
   alle Änderungen seit der eigenen Revision. */
const COLLECTIONS = ["users", "teams", "customers", "absences", "projects", "sprints", "issues", "filters", "notifications"];
let db = { users: [], teams: [], customers: [], absences: [], projects: [], sprints: [], issues: [], filters: [], notifications: [], currentUserId: null };
const sync = { rev: 0, base: {}, pending: [], timer: null, inFlight: false, again: false, pulling: false, pullAgain: false, online: true, retry: 0, mail: false, company: "GF Tracker" };
COLLECTIONS.forEach((t) => (sync.base[t] = new Map()));
const LOCAL_KEY = "gft-local";
const localState = (() => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { recent: {} }; } catch { return { recent: {} }; } })();
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(localState)); } catch {} }

/* In Microsoft Teams (Pfad /teams/app) meldet sich die App mit einem Token statt Cookie an – Cookies sind dort oft gesperrt. */
const TEAMS = location.pathname === "/teams/app";
const TEAMS_TOKEN = TEAMS ? (() => { try { return localStorage.getItem("gft-teams-token"); } catch { return null; } })() : null;
const authHeaders = () => (TEAMS_TOKEN ? { "X-GFT-Token": TEAMS_TOKEN } : {});
/** Links auf Dateien/Downloads: in Teams mit Token (Bilder und Downloads können keinen Kopf senden). */
const authUrl = (u) => (TEAMS_TOKEN ? `${u}${u.includes("?") ? "&" : "?"}token=${encodeURIComponent(TEAMS_TOKEN)}` : u);
const LOGIN_URL = TEAMS ? "/teams/tab" : "/login";
async function api(path, { method = "GET", body } = {}) {
  let res;
  try { res = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-GFT": "1", ...authHeaders() }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw Object.assign(new Error("Keine Verbindung zum Server."), { offline: true }); }
  if (res.status === 401 && !path.startsWith("/api/me/password")) { if (TEAMS) { try { localStorage.removeItem("gft-teams-token"); } catch {} } location.href = LOGIN_URL; throw new Error("Nicht angemeldet."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Fehler ${res.status}`), { status: res.status });
  return data;
}
const setBase = (type, obj) => sync.base[type].set(obj.id, clone(obj));
function loadState(st) {
  for (const t of COLLECTIONS) { db[t] = st[t] || []; sync.base[t] = new Map(); db[t].forEach((o) => setBase(t, o)); }
  sync.rev = st.rev; sync.access = st.access || "all"; sync.pending = []; db.archiveInfo = st.archive || { count: 0, days: 0 }; ui.archiveLoaded = !db.archiveInfo.count;
}
/** Startdaten: gemeinsamer, komprimierter Datensatz plus die eigenen Benachrichtigungen. */
async function fetchState() {
  const [base, n] = await Promise.all([api("/api/state?part=base"), api("/api/state?part=notifications")]);
  return { ...base, notifications: n.notifications };
}
/** Stand neu laden: erst eigene Änderungen absenden, dann Startdaten holen und sofort auf den neuesten Stand bringen
    (der gemeinsame Startdatensatz kann bis zu 3 Sekunden alt sein). */
async function reloadState({ flushFirst = true } = {}) {
  if (flushFirst) { clearTimeout(sync.timer); if (!sync.inFlight) await flush(); for (let k = 0; k < 100 && sync.inFlight; k++) await new Promise((r) => setTimeout(r, 50)); }
  loadState(await fetchState()); await pull(); render();
}
/** Archiv (lange erledigte Vorgänge) bei Bedarf nachladen – für Suche, Auswertungen, Kundenhistorie. */
let archivePromise = null;
function ensureArchive() {
  if (ui.archiveLoaded) return Promise.resolve(false);
  if (!archivePromise) {
    toast(`Archiv wird geladen (${db.archiveInfo.count} ältere erledigte Vorgänge) …`);
    archivePromise = api("/api/archive").then((r) => { const have = new Set(db.issues.map((i) => i.id)); for (const i of r.issues) if (!have.has(i.id) && !sync.base.issues.has(i.id)) { db.issues.push(i); sync.base.issues.set(i.id, clone(i)); } ui.archiveLoaded = true; renderSoft(); return true; })
      .catch((e) => { toast(`Archiv konnte nicht geladen werden: ${e.message}`); return false; }).finally(() => { archivePromise = null; });
  }
  return archivePromise;
}
/** Vorschläge unter dem Suchfeld oben: Vorgänge und Kunden, während man tippt. */
function showSuggestions(q) {
  q = q.trim(); const box = $("#gsugg"); if (!box) return; if (q.length < 2) return hideSuggestions();
  const nq = norm(q); const exact = byKey(q);
  const iss = db.issues.filter((i) => i !== exact && textHit(i, q)).sort((a, b) => (isDone(a) - isDone(b)) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, exact ? 5 : 6);
  if (exact) iss.unshift(exact);
  const cus = db.customers.filter((c) => norm(`${c.name} ${c.no} ${c.city} ${(c.contacts || []).map((k) => k.name).join(" ")} ${(c.assets || []).map((a) => a.serial).join(" ")}`).includes(nq)).slice(0, 3);
  box.innerHTML = `${iss.map((i) => `<button data-sugg data-act="sugg-issue" data-id="${i.id}">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><span class="trunc" style="flex:1">${esc(i.summary)}</span>${lozenge(i)}</button>`).join("")}
    ${cus.length ? `<div class="sugg-h">Kunden</div>${cus.map((c) => `<button data-sugg data-act="sugg-goto" data-href="#/customers/${c.id}">${custAvatar({ name: c.name })}<span class="trunc" style="flex:1"><b>${esc(c.name)}</b> <span class="small muted">${esc([c.no, c.city].filter(Boolean).join(" · "))}</span></span></button>`).join("")}` : ""}
    ${!iss.length && !cus.length ? `<div class="sugg-h">Keine Treffer in den geladenen Vorgängen${ui.archiveLoaded ? "" : " – Enter sucht auch im Archiv"}</div>` : ""}
    <button data-sugg data-act="sugg-goto" data-href="#/filters?state=all&text=${encodeURIComponent(q)}" class="sugg-all">${icon("search")} Alle Treffer für „${esc(q)}“ anzeigen</button>`;
  box.hidden = false;
}
function hideSuggestions() { const b = $("#gsugg"); if (b) { b.hidden = true; b.innerHTML = ""; } }
/** Vorgang per Schlüssel – auch wenn er im Archiv liegt. */
async function findByKey(key) {
  const i = byKey(key); if (i) return i;
  try { const r = await api(`/api/issues/by-key/${encodeURIComponent(key.trim().toUpperCase())}`); applyServer({ type: "issues", id: r.issue.id, data: r.issue }); return issue(r.issue.id); } catch { return null; }
}
function save() { clearTimeout(sync.timer); sync.timer = setTimeout(flush, 120); updateSyncBadge(); }
function collectOps() {
  const ops = [];
  for (const t of COLLECTIONS) {
    const base = sync.base[t]; const seen = new Set();
    for (const o of db[t]) {
      seen.add(o.id); const b = base.get(o.id);
      if (!b) { ops.push({ type: t, id: o.id, op: "put", data: clone(o) }); setBase(t, o); continue; }
      const patch = diffEntity(b, o); if (patch) { ops.push({ type: t, id: o.id, op: "patch", patch }); setBase(t, o); }
    }
    for (const id of [...base.keys()]) if (!seen.has(id)) { ops.push({ type: t, id, op: "delete" }); base.delete(id); }
  }
  return ops;
}
/** Übernimmt den Serverstand eines Objekts und legt noch nicht gesendete lokale Änderungen darüber. */
function applyServer(r) {
  const list = db[r.type]; if (!list) return;
  const idx = list.findIndex((o) => o.id === r.id); const base = sync.base[r.type]; const oldBase = base.get(r.id);
  if (r.deleted) { if (idx >= 0) list.splice(idx, 1); base.delete(r.id); if (ui.openIssue === r.id) closeModal(); return; }
  const data = r.data;
  if (r.type === "notifications" && data.userId !== db.currentUserId) { if (idx >= 0) list.splice(idx, 1); base.delete(r.id); return; }
  if (sync.pending.some((op) => op.id === r.id && op.op === "delete")) return;
  if (idx < 0 && oldBase) { base.set(r.id, clone(data)); return; } // lokal gelöscht, Löschung folgt
  if (idx >= 0) { const local = oldBase ? diffEntity(oldBase, list[idx]) : null; list[idx] = local ? applyPatch(data, local) : clone(data); }
  else list.push(clone(data));
  base.set(r.id, clone(data));
}
/** Alle offenen Änderungen jetzt senden und warten, bis der Server sie hat (z. B. vor dem Hochladen zu einem neuen Vorgang). */
async function syncNow() { clearTimeout(sync.timer); if (!sync.inFlight) await flush(); for (let k = 0; k < 200 && (sync.inFlight || sync.pending.length); k++) await new Promise((r) => setTimeout(r, 50)); }
async function flush() {
  if (sync.inFlight) { sync.again = true; return; }
  const ops = collectOps(); if (ops.length) sync.pending.push(...ops);
  if (!sync.pending.length) { updateSyncBadge(); return; }
  sync.inFlight = true; const batch = sync.pending.splice(0, 400);
  try {
    const r = await api("/api/sync", { method: "POST", body: { ops: batch } });
    sync.retry = 0; setOnline(true);
    for (const res of r.results) applyServer(res);
    const err = r.results.find((x) => x.error); if (err) { toast(err.error); renderSoft(); }
  } catch (e) {
    if (e.offline || e.status >= 500 || e.status === 429) { sync.pending.unshift(...batch); setOnline(false); sync.retry = Math.min(sync.retry + 1, 6); setTimeout(flush, 1000 * 2 ** sync.retry); }
    else { toast(e.message); await reloadState({ flushFirst: false }).catch(() => {}); }
  } finally {
    sync.inFlight = false; updateSyncBadge();
    if (sync.again || (sync.pending.length && sync.online)) { sync.again = false; flush(); }
    else if (sync.pullAgain) { sync.pullAgain = false; pull(); }
  }
}
async function pull() {
  if (sync.inFlight || sync.pending.length) { sync.pullAgain = true; return; }
  if (sync.pulling) { sync.pullAgain = true; return; }
  sync.pulling = true;
  try {
    const r = await api(`/api/changes?since=${sync.rev}`);
    if (r.reset) { sync.pulling = false; await reloadState({ flushFirst: false }); return; } // zu lange offline: Stand komplett neu laden
    if (r.access && r.access !== sync.access) { sync.pulling = false; toast("Ihr Sichtbereich wurde geändert – Daten werden neu geladen."); await reloadState({ flushFirst: false }); return; }
    for (const c of r.changes) applyServer(c);
    sync.rev = r.rev; setOnline(true);
    if (r.changes.length) renderSoft();
  } catch (e) { if (e.offline) setOnline(false); }
  finally { sync.pulling = false; if (sync.pullAgain) { sync.pullAgain = false; pull(); } }
}
function connectEvents() {
  const es = new EventSource(authUrl("/api/events"));
  es.addEventListener("rev", (e) => { if (Number(e.data) > sync.rev) pull(); else setOnline(true); });
  es.onerror = () => setOnline(false);
  setInterval(pull, 30e3);
  window.addEventListener("online", () => { setOnline(true); flush(); pull(); });
}
function setOnline(v) { if (sync.online !== v) { sync.online = v; updateSyncBadge(); if (v) flush(); } }
function updateSyncBadge() {
  const el = $("#sync-badge"); if (!el) return;
  const busy = sync.pending.length || sync.inFlight || sync.timer && false;
  el.textContent = !sync.online ? "Offline – Änderungen werden nachgereicht" : busy ? "Speichert…" : "";
  el.className = `chip ${!sync.online ? "red" : "gray"}`; el.hidden = !el.textContent;
}
/** Neu zeichnen – aber nicht, während jemand gerade tippt. */
function renderSoft() {
  const a = document.activeElement;
  if (a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName) && a.id !== "gsearch") { ui.dirty = true; return; }
  render();
}
document.addEventListener("focusout", () => setTimeout(() => { if (ui.dirty && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) { ui.dirty = false; render(); } }, 50));
window.addEventListener("pagehide", () => {
  const ops = [...sync.pending, ...collectOps()];
  if (ops.length) fetch("/api/sync", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-GFT": "1", ...authHeaders() }, body: JSON.stringify({ ops }) });
});

const ui = { modal: null, openIssue: null, board: { q: "", mine: false, recent: false, users: [], lane: "none" }, queue: "open", yourWork: "assigned", editingDesc: false, dirty: false, rowLimit: 250 };

/* ---------- Abfragen ---------- */
const me = () => db.users.find((u) => u.id === db.currentUserId) || db.users[0];
const user = (id) => db.users.find((u) => u.id === id);
const uname = (id) => user(id)?.name || "Nicht zugewiesen";
const proj = (id) => db.projects.find((p) => p.id === id);
const projByKey = (k) => db.projects.find((p) => p.key.toUpperCase() === String(k).toUpperCase());
const issue = (id) => db.issues.find((i) => i.id === id);
const keyOf = (i) => `${proj(i.projectId)?.key}-${i.no}`;
const byKey = (k) => { const m = String(k).trim().toUpperCase().match(/^([A-Z][A-Z0-9]*)-(\d+)$/); if (!m) return null; const p = projByKey(m[1]); return p ? db.issues.find((i) => i.projectId === p.id && i.no === Number(m[2])) : null; };
const workflowOf = (p) => WORKFLOWS[PROJECT_TYPES[p.type].workflow];
const statusOf = (i) => workflowOf(proj(i.projectId)).find((s) => s.id === i.status) || { id: i.status, name: i.status, cat: "todo" };
const isDone = (i) => statusOf(i).cat === "done";
const isOverdue = (i) => !isDone(i) && i.dueDate && i.dueDate < today();
const activeUsers = () => db.users.filter((u) => u.active);
const projIssues = (p) => db.issues.filter((i) => i.projectId === p.id);
const team = (id) => (id ? db.teams.find((t) => t.id === id) || null : null);
const teamsOf = (userId) => db.teams.filter((t) => t.memberIds.includes(userId));
const teamMembers = (t) => t.memberIds.map(user).filter((u) => u && u.active);
/** Vorgänge eines Teams: dem Team zugeordnet – oder ohne Team, aber von einem Mitglied bearbeitet. */
const teamIssues = (t) => db.issues.filter((i) => i.teamId === t.id || (!i.teamId && i.assigneeId && t.memberIds.includes(i.assigneeId)));
const teamOpts = (sel) => `<option value="">Kein Team</option>` + db.teams.map((t) => `<option value="${t.id}" ${t.id === sel ? "selected" : ""}>${esc(t.name)}</option>`).join("");
const teamBadge = (t) => (t ? `<span class="tbadge" style="--tc:${t.color}">${esc(t.name)}</span>` : "");
/** Abwesenheit einer Person an einem Tag (Urlaub, Krankheit … – aus Factorial oder manuell). */
const absenceOn = (userId, k) => db.absences.find((a) => a.userId === userId && a.start <= k && a.end >= k) || null;
const absenceText = (a) => `${a.type}${a.start === a.end ? ` am ${fmtDay(a.start)}` : ` ${fmtDay(a.start)} – ${fmtDay(a.end)}`}${a.note ? ` (${a.note})` : ""}`;
const canEditAbsenceFor = (userId) => me().role === "ADMIN" || userId === db.currentUserId || db.teams.some((t) => t.leadId === db.currentUserId && t.memberIds.includes(userId));
const teamInitials = (n) => initials(String(n).split(/[\s&+\/-]+/).filter((w) => /\p{L}/u.test(w)).join(" "));
/** Team-Eingang: dem Team zugeordnet, niemandem zugewiesen und jetzt fällig zu bearbeiten (kein Scrum-Backlog). */
const inTeamInbox = (i) => !!i.teamId && !i.assigneeId && !isDone(i) && i.type !== "EPIC" && i.type !== "SUBTASK" && !(proj(i.projectId)?.type === "software" && sprint(i.sprintId)?.state !== "active");
const canManageTeam = (t) => me().role === "ADMIN" || (!!t && t.leadId === db.currentUserId);
const children = (i) => db.issues.filter((x) => x.parentId === i.id);
const epicChildren = (e) => db.issues.filter((x) => x.epicId === e.id);
const epicsOf = (p) => projIssues(p).filter((i) => i.type === "EPIC");
const activeSprint = (p) => db.sprints.find((s) => s.projectId === p.id && s.state === "active");
const sprint = (id) => db.sprints.find((s) => s.id === id);

/* ---------- SLA ---------- */
function slaInfo(i, kind) { return slaCompute(i, proj(i.projectId), kind); }
function slaChip(s) {
  if (!s) return '<span class="muted">–</span>';
  if (s.stopped) return s.met ? `<span class="chip green" title="SLA eingehalten">✓ eingehalten</span>` : `<span class="chip red" title="SLA verletzt">✕ verletzt (${fmtDur(s.remaining)})</span>`;
  if (s.breached) return `<span class="chip red" title="SLA überschritten">${fmtDur(s.remaining)}</span>`;
  const cls = s.risk ? "yellow" : "gray";
  return `<span class="chip ${cls}" title="verbleibend${s.paused ? " (pausiert)" : ""}">${s.paused ? "pausiert · " : ""}${fmtDur(s.remaining)}</span>`;
}

/* ---------- Benachrichtigungen ---------- */
function notify(userIds, type, title, text, issueId, key) {
  const actor = db.currentUserId;
  [...new Set(userIds.filter(Boolean))].forEach((uid_) => {
    if (!key && uid_ === actor) return;
    const k = key ? `${key}:${uid_}` : null;
    if (k && db.notifications.some((n) => n.key === k)) return;
    db.notifications.unshift({ id: uid(), userId: uid_, type, title, text, issueId, at: new Date().toISOString(), read: false, key: k });
  });
  db.notifications = db.notifications.slice(0, 600);
}
// Fristen- und SLA-Benachrichtigungen erzeugt der Server (deadlineJob).

/* ---------- Vorgänge ändern ---------- */
const FIELD_LABEL = { customerId: "Kunde", assetId: "Anlage", customer: "Ansprechpartner", teamId: "Team", appointmentAt: "Termin", resolution: "Servicebericht", summary: "Zusammenfassung", description: "Beschreibung", status: "Status", priority: "Priorität", assigneeId: "Verantwortlich", reporterId: "Melder", labels: "Labels",
  dueDate: "Fälligkeitsdatum", startDate: "Startdatum", storyPoints: "Story Points", estimateH: "Schätzung", epicId: "Epic", sprintId: "Sprint", type: "Vorgangstyp", parentId: "Übergeordnet", color: "Farbe" };
function fieldText(i, f, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "–";
  if (f === "status") return workflowOf(proj(i.projectId)).find((s) => s.id === v)?.name || v;
  if (f === "priority") return PRIOS[v]?.label || v;
  if (f === "assigneeId" || f === "reporterId") return uname(v);
  if (f === "teamId") return team(v)?.name || "–";
  if (f === "customerId") return customer(v)?.name || "–";
  if (f === "assetId") return assetOf(customer(i.customerId), v)?.name || "–";
  if (f === "customer") return [v.name, v.company].filter(Boolean).join(" · ");
  if (f === "epicId" || f === "parentId") { const x = issue(v); return x ? `${keyOf(x)} ${x.summary}` : "–"; }
  if (f === "sprintId") return sprint(v)?.name || "Backlog";
  if (f === "type") return TYPES[v]?.label || v;
  if (f === "dueDate" || f === "startDate") return fmtDay(v);
  if (f === "appointmentAt") return fmtAppt(v);
  if (f === "resolution") return "erfasst";
  if (f === "labels") return v.join(", ");
  if (f === "description") return v.length > 60 ? v.slice(0, 60) + "…" : v;
  return String(v);
}
function touch(i) { i.updatedAt = new Date().toISOString(); }
function updateIssue(i, changes) {
  const actor = db.currentUserId; const p = proj(i.projectId);
  for (const [f, v] of Object.entries(changes)) {
    const before = i[f];
    if (JSON.stringify(before) === JSON.stringify(v)) continue;
    i[f] = v;
    i.history.unshift({ id: uid(), at: new Date().toISOString(), userId: actor, field: FIELD_LABEL[f] || f, from: fieldText(i, f, before), to: fieldText(i, f, v) });
    if (f === "status") {
      applyTransition(i, p, before, v);
      notify(i.watchers, "status", `${keyOf(i)} → ${fieldText(i, "status", v)}`, `${me().name} hat den Status geändert: ${i.summary}`, i.id);
    }
    if (f === "assigneeId" && v) {
      if (!i.watchers.includes(v)) i.watchers.push(v);
      notify([v], "assign", `Ihnen zugewiesen: ${keyOf(i)}`, `${me().name}: ${i.summary}`, i.id);
    }
    if (f === "teamId" && v && !i.assigneeId) { const t = team(v); if (t) notify(t.memberIds, "new", `Neu im Team-Eingang (${t.name}): ${keyOf(i)}`, `${me().name}: ${i.summary}`, i.id); }
  }
  touch(i); save();
}
async function createIssue(data) {
  const p = proj(data.projectId);
  const { no } = await api(`/api/projects/${p.id}/reserve`, { method: "POST" });
  const i = newIssue({ ...data, id: undefined, project: p, no, reporterId: data.reporterId === undefined ? db.currentUserId : data.reporterId,
    rank: Math.max(0, ...db.issues.map((x) => x.rank || 0)) + 1, color: data.type === "EPIC" ? PALETTE[epicsOf(p).length % PALETTE.length] : null });
  if (i.parentId) { const par = issue(i.parentId); if (par) { i.sprintId = par.sprintId; i.epicId = null; } }
  db.issues.push(i);
  if (i.assigneeId) notify([i.assigneeId], "assign", `Ihnen zugewiesen: ${keyOf(i)}`, `${me().name}: ${i.summary}`, i.id);
  else if (team(i.teamId)) { const t = team(i.teamId); notify(t.memberIds, "new", `Neu im Team-Eingang (${t.name}): ${keyOf(i)}`, `${me().name}: ${i.summary}`, i.id); }
  save(); return i;
}
function addComment(i, text, { internal = false, customerName = null } = {}) {
  const c = { id: uid(), userId: customerName ? null : db.currentUserId, author: customerName, text, at: new Date().toISOString(), internal };
  i.comments.push(c); touch(i);
  const p = proj(i.projectId);
  if (!customerName) {
    if (!i.watchers.includes(db.currentUserId)) i.watchers.push(db.currentUserId);
    if (p.type === "service" && !internal && !i.firstResponseAt) i.firstResponseAt = c.at;
    const mentioned = activeUsers().filter((u) => new RegExp(`@(${escRe(u.name)}|${escRe(u.name.split(" ")[0])})\\b`, "i").test(text)).map((u) => u.id);
    notify(mentioned, "mention", `${me().name} hat Sie erwähnt: ${keyOf(i)}`, text.slice(0, 140), i.id);
    notify(i.watchers.filter((w) => !mentioned.includes(w)), "comment", `Neuer Kommentar: ${keyOf(i)}`, `${me().name}: ${text.slice(0, 120)}`, i.id);
  } else {
    if (i.status === "WAITING") updateIssue(i, { status: "WORKING" });
    if (isDone(i)) updateIssue(i, { status: "WORKING" });
    notify([i.assigneeId || p.leadId], "comment", `Kunde hat geantwortet: ${keyOf(i)}`, `${customerName}: ${text.slice(0, 120)}`, i.id, `cust:${c.id}`);
  }
  save(); return c;
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function deleteIssue(i) {
  const ids = new Set([i.id, ...children(i).map((c) => c.id)]);
  db.issues = db.issues.filter((x) => !ids.has(x.id));
  db.issues.forEach((x) => { x.links = x.links.filter((l) => !ids.has(l.issueId)); if (ids.has(x.epicId)) x.epicId = null; });
  db.notifications = db.notifications.filter((n) => !ids.has(n.issueId)); save();
}
function linkIssues(a, type, b) {
  const inverse = { blocks: "blocked_by", blocked_by: "blocks", relates: "relates", duplicates: "duplicated_by", duplicated_by: "duplicates" }[type];
  if (a.id === b.id || a.links.some((l) => l.issueId === b.id && l.type === type)) return;
  a.links.push({ type, issueId: b.id }); b.links.push({ type: inverse, issueId: a.id });
  a.history.unshift({ id: uid(), at: new Date().toISOString(), userId: db.currentUserId, field: "Verknüpfung", from: "", to: `${LINK_LABEL[type]} ${keyOf(b)}` });
  touch(a); touch(b); save();
}
const LINK_LABEL = { blocks: "blockiert", blocked_by: "wird blockiert durch", relates: "bezieht sich auf", duplicates: "dupliziert", duplicated_by: "wird dupliziert durch" };
function pushRecent(id) { const r = (localState.recent[db.currentUserId] ||= []); const idx = r.indexOf(id); if (idx >= 0) r.splice(idx, 1); r.unshift(id); r.length = Math.min(r.length, 20); saveLocal(); }

/* ---------- JQL (Teilmenge) ---------- */
const JQL_FIELDS = ["team", "project", "type", "issuetype", "status", "statuscategory", "assignee", "reporter", "priority", "labels", "sprint", "due", "duedate", "created", "updated", "resolved", "text", "summary", "description", "resolution", "key", "issuekey", "epic", "parent", "storypoints", "points", "customer", "watcher"];
function tokenize(q) {
  const toks = []; let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") { let j = i + 1, s = ""; while (j < q.length && q[j] !== c) { if (q[j] === "\\") j++; s += q[j++]; } if (j >= q.length) throw new Error("Anführungszeichen nicht geschlossen"); toks.push({ t: "str", v: s }); i = j + 1; continue; }
    if ("(),".includes(c)) { toks.push({ t: c }); i++; continue; }
    const op = q.slice(i).match(/^(!=|!~|<=|>=|=|~|<|>)/); if (op) { toks.push({ t: "op", v: op[1] }); i += op[1].length; continue; }
    const w = q.slice(i).match(/^[^\s(),=!~<>"']+/);
    if (w) { let v = w[0]; i += v.length; if (q[i] === "(" && q[i + 1] === ")") { v += "()"; i += 2; } toks.push({ t: "word", v }); continue; }
    throw new Error(`Unerwartetes Zeichen „${c}“`);
  }
  return toks;
}
function parseJql(q) {
  const toks = tokenize(q); let p = 0;
  const peek = () => toks[p]; const isKw = (k) => peek()?.t === "word" && peek().v.toUpperCase() === k;
  const expectKw = (k) => { if (!isKw(k)) throw new Error(`„${k}“ erwartet`); p++; };
  function value() {
    const tk = toks[p++]; if (!tk) throw new Error("Wert erwartet");
    if (tk.t === "str" || tk.t === "word") return tk.v; throw new Error(`Wert erwartet, gefunden „${tk.v || tk.t}“`);
  }
  function clause() {
    const ft = toks[p++]; if (!ft || ft.t !== "word" && ft.t !== "str") throw new Error("Feldname erwartet");
    const field = ft.v.toLowerCase().replace(/\s+/g, "");
    if (!JQL_FIELDS.includes(field)) throw new Error(`Unbekanntes Feld „${ft.v}“`);
    if (isKw("IS")) { p++; let neg = false; if (isKw("NOT")) { neg = true; p++; } if (!isKw("EMPTY") && !isKw("NULL")) throw new Error("EMPTY erwartet"); p++; return { k: "empty", field, neg }; }
    let neg = false; if (isKw("NOT")) { neg = true; p++; }
    if (isKw("IN")) { p++; if (peek()?.t === "word" && peek().v.endsWith("()")) return { k: "in", field, vals: [toks[p++].v], neg };
      if (peek()?.t !== "(") throw new Error("„(“ erwartet"); p++; const vals = [value()]; while (peek()?.t === ",") { p++; vals.push(value()); } if (peek()?.t !== ")") throw new Error("„)“ erwartet"); p++; return { k: "in", field, vals, neg }; }
    if (neg) throw new Error("IN nach NOT erwartet");
    const op = toks[p++]; if (!op || op.t !== "op") throw new Error(`Operator nach „${ft.v}“ erwartet (=, !=, ~, <, >, IN, IS)`);
    return { k: "cmp", field, op: op.v, val: value() };
  }
  function primary() { if (peek()?.t === "(") { p++; const e = orE(); if (peek()?.t !== ")") throw new Error("„)“ erwartet"); p++; return e; } if (isKw("NOT")) { p++; return { k: "not", e: primary() }; } return clause(); }
  function andE() { let l = primary(); while (isKw("AND")) { p++; l = { k: "and", l, r: primary() }; } return l; }
  function orE() { let l = andE(); while (isKw("OR")) { p++; l = { k: "or", l, r: andE() }; } return l; }
  let where = null, order = [];
  if (toks.length && !isKw("ORDER")) where = orE();
  if (isKw("ORDER")) { p++; expectKw("BY"); do { if (peek()?.t === ",") p++; const f = value().toLowerCase(); let dir = "ASC"; if (isKw("ASC") || isKw("DESC")) dir = toks[p++].v.toUpperCase(); order.push({ f, dir }); } while (peek()?.t === ","); }
  if (p < toks.length) throw new Error(`Unerwartet: „${toks[p].v || toks[p].t}“`);
  return { where, order };
}
function jqlDate(v) {
  const s = String(v).toLowerCase(); const t = today();
  if (s === "now()" || s === "startofday()" || s === "endofday()") return t;
  if (s === "startofweek()") { const d = parseDay(t); return addDays(t, -((d.getDay() + 6) % 7)); }
  if (s === "endofweek()") { const d = parseDay(t); return addDays(t, 6 - ((d.getDay() + 6) % 7)); }
  if (s === "startofmonth()") return t.slice(0, 8) + "01";
  const rel = s.match(/^([+-]?)(\d+)([dw])$/); if (rel) return addDays(t, (rel[1] === "-" ? -1 : 1) * Number(rel[2]) * (rel[3] === "w" ? 7 : 1));
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/); if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  const g = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (g) return `${g[3]}-${pad(g[2])}-${pad(g[1])}`;
  throw new Error(`Ungültiges Datum „${v}“ (z. B. 2026-10-31, -7d, startOfWeek())`);
}
function fieldValues(i, f) {
  const p = proj(i.projectId);
  switch (f) {
    case "project": return [p.key, p.name];
    case "team": { const t = team(i.teamId); return t ? [t.name, t.id] : []; }
    case "type": case "issuetype": return [TYPES[i.type].label, i.type];
    case "status": { const s = statusOf(i); return [s.name, s.id]; }
    case "statuscategory": { const c = statusOf(i).cat; return [CAT_LABEL[c], { todo: "To Do", progress: "In Progress", done: "Done" }[c]]; }
    case "assignee": return i.assigneeId ? [user(i.assigneeId)?.name, user(i.assigneeId)?.email, i.assigneeId] : [];
    case "reporter": return i.reporterId ? [user(i.reporterId)?.name, user(i.reporterId)?.email, i.reporterId] : (i.customer ? [i.customer.name, i.customer.email] : []);
    case "watcher": return i.watchers;
    case "priority": return [PRIOS[i.priority].label, i.priority];
    case "labels": return i.labels;
    case "sprint": return i.sprintId ? [sprint(i.sprintId)?.name, i.sprintId] : [];
    case "resolution": return isDone(i) ? ["Done", "Erledigt", "Fertig"] : ["Unresolved", "Ungelöst"];
    case "key": case "issuekey": return [keyOf(i)];
    case "epic": case "parent": { const e = issue(f === "epic" ? i.epicId : i.parentId); return e ? [keyOf(e), e.summary] : []; }
    case "customer": { const c = customer(i.customerId); return [...(i.customer ? [i.customer.name, i.customer.company, i.customer.email] : []), ...(c ? [c.name, c.no] : [])]; }
    default: return [];
  }
}
function resolveVal(v) {
  const s = String(v).toLowerCase();
  if (s === "currentuser()") return db.currentUserId;
  return v;
}
function matchClause(i, c) {
  const f = c.field;
  if (c.k === "empty") {
    const val = { due: i.dueDate, duedate: i.dueDate, assignee: i.assigneeId, sprint: i.sprintId, epic: i.epicId, parent: i.parentId, labels: i.labels.length ? 1 : null, resolved: i.resolvedAt, storypoints: i.storyPoints, points: i.storyPoints, description: i.description || null }[f];
    return c.neg ? val != null : val == null;
  }
  if (["due", "duedate", "created", "updated", "resolved"].includes(f)) {
    const raw = { due: i.dueDate, duedate: i.dueDate, created: i.createdAt, updated: i.updatedAt, resolved: i.resolvedAt }[f];
    if (!raw) return c.k === "cmp" && c.op === "!=";
    const d = raw.length > 10 ? dayKey(raw) : raw; const ops = c.k === "in" ? c.vals.map(jqlDate) : [jqlDate(c.val)];
    if (c.k === "in") return c.neg !== ops.includes(d);
    const v = ops[0]; return { "=": d === v, "!=": d !== v, "<": d < v, ">": d > v, "<=": d <= v, ">=": d >= v }[c.op] ?? false;
  }
  if (["storypoints", "points"].includes(f)) {
    const n = i.storyPoints; if (n == null) return false; const v = Number(c.val);
    if (c.k === "in") return c.neg !== c.vals.map(Number).includes(n);
    return { "=": n === v, "!=": n !== v, "<": n < v, ">": n > v, "<=": n <= v, ">=": n >= v }[c.op] ?? false;
  }
  if (f === "text") { const hit = textHit(i, String(c.val ?? (c.vals || []).join(" ")).replace(/\*/g, "")); return c.op === "!~" ? !hit : hit; }
  if (["text", "summary", "description"].includes(f) || c.op === "~" || c.op === "!~") {
    const hay = (f === "summary" ? i.summary : f === "description" ? i.description : f === "text" ? `${i.summary} ${i.description} ${i.comments.map((x) => x.text).join(" ")} ${i.customer ? i.customer.name + " " + i.customer.company : ""}` : fieldValues(i, f).join(" ")).toLowerCase();
    const needle = String(c.val ?? (c.vals || []).join(" ")).toLowerCase();
    const hit = needle.split(/\s+/).filter(Boolean).every((w) => hay.includes(w.replace(/\*/g, "")));
    if (c.op === "!~") return !hit; return hit;
  }
  if (f === "sprint") {
    const vals = (c.k === "in" ? c.vals : [c.val]).map((v) => String(v).toLowerCase());
    const sp = sprint(i.sprintId);
    const ok = vals.some((v) => v === "opensprints()" ? sp && sp.state !== "closed" : v === "closedsprints()" ? sp && sp.state === "closed" : v === "activesprint()" ? sp && sp.state === "active" : sp && (sp.name.toLowerCase() === v || sp.id === v));
    if (c.k === "in") return c.neg !== ok; return c.op === "!=" ? !ok : ok;
  }
  const have = fieldValues(i, f).filter(Boolean).map((x) => String(x).toLowerCase());
  const want = (c.k === "in" ? c.vals : [c.val]).map((v) => String(resolveVal(v)).toLowerCase());
  const ok = want.some((w) => have.includes(w));
  if (c.k === "in") return c.neg !== ok;
  if (c.op === "=") return ok; if (c.op === "!=") return !ok;
  if (f === "priority" && ["<", ">", "<=", ">="].includes(c.op)) {
    const r = PRIOS[i.priority].rank; const wv = Object.values(PRIOS).find((x) => x.label.toLowerCase() === want[0])?.rank ?? PRIOS[String(c.val).toUpperCase()]?.rank;
    if (wv == null) throw new Error(`Unbekannte Priorität „${c.val}“`);
    return { "<": r < wv, ">": r > wv, "<=": r <= wv, ">=": r >= wv }[c.op];
  }
  throw new Error(`Operator ${c.op} ist für „${f}“ nicht möglich`);
}
function evalWhere(i, e) {
  if (!e) return true;
  if (e.k === "and") return evalWhere(i, e.l) && evalWhere(i, e.r);
  if (e.k === "or") return evalWhere(i, e.l) || evalWhere(i, e.r);
  if (e.k === "not") return !evalWhere(i, e.e);
  return matchClause(i, e);
}
function sortVal(i, f) {
  switch (f) {
    case "priority": return PRIOS[i.priority].rank; case "key": case "issuekey": return proj(i.projectId).key + String(i.no).padStart(6, "0");
    case "created": return i.createdAt; case "updated": return i.updatedAt; case "resolved": return i.resolvedAt || "";
    case "due": case "duedate": return i.dueDate || "9999"; case "status": return ["todo", "progress", "done"].indexOf(statusOf(i).cat) + statusOf(i).name;
    case "assignee": return i.assigneeId ? uname(i.assigneeId) : "~"; case "summary": return i.summary.toLowerCase(); case "type": return TYPES[i.type].label;
    case "customer": return norm(i.customer?.company || i.customer?.name || customer(i.customerId)?.name || "~"); case "team": return team(i.teamId)?.name || "~";
    case "reporter": return i.reporterId ? uname(i.reporterId) : i.customer?.name || "~"; case "appointment": return i.appointmentAt || "9999";
    case "rank": return i.rank; case "storypoints": case "points": return i.storyPoints ?? -1; case "project": return proj(i.projectId).key;
    default: throw new Error(`Sortierung nach „${f}“ nicht möglich`);
  }
}
function runJql(q) {
  const { where, order } = parseJql(q);
  const list = db.issues.filter((i) => evalWhere(i, where));
  const ord = order.length ? order : [{ f: "updated", dir: "DESC" }];
  return list.sort((a, b) => { for (const o of ord) { const x = sortVal(a, o.f), y = sortVal(b, o.f); if (x < y) return o.dir === "ASC" ? -1 : 1; if (x > y) return o.dir === "ASC" ? 1 : -1; } return 0; });
}
/* ---------- Einfache Textsuche: Wörter in beliebiger Reihenfolge, ohne Umlaut-/Groß-Klein-Probleme ---------- */
const norm = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
const hayCache = new Map();
/** Alles, was man über einen Vorgang suchen könnte: Nummer, Texte, Kommentare, Kunde, Anlage, Personen, Status … */
function searchHay(i) {
  const c = hayCache.get(i.id); if (c && c.u === i.updatedAt && c.n === i.comments.length) return c.h;
  const cu = i.customerId ? customer(i.customerId) : null; const a = cu && i.assetId ? (cu.assets || []).find((x) => x.id === i.assetId) : null;
  const h = norm([keyOf(i), i.summary, i.description, ...i.comments.map((x) => x.text), i.customer?.name, i.customer?.company, i.customer?.email, i.customer?.phone, cu?.name, cu?.no, cu?.city,
    a?.name, a?.serial, a?.model, a?.manufacturer, ...(i.labels || []), uname(i.assigneeId), i.reporterId ? uname(i.reporterId) : "", team(i.teamId)?.name, TYPES[i.type]?.label, statusOf(i).name,
    i.resolution?.cause, i.resolution?.action, i.resolution?.parts, ...(i.attachments || []).map((x) => x.name)].filter(Boolean).join(" \u0001 "));
  hayCache.set(i.id, { u: i.updatedAt, n: i.comments.length, h }); return h;
}
function textHit(i, q) { const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length) return true; const h = searchHay(i); return words.every((w) => (w.startsWith("-") && w.length > 1 ? !h.includes(w.slice(1)) : h.includes(w))); }
/** Einfache Suche: Text plus Auswahlfelder (aus der Adresszeile, damit Zurück/Vor und Lesezeichen funktionieren). */
const SIMPLE_KEYS = ["text", "project", "state", "assignee", "priority", "type", "team", "sort", "dir"];
function simpleSearch(ps) {
  const g = (k) => ps.get(k) || ""; const st = g("state") || "open"; const me = db.currentUserId;
  const list = db.issues.filter((i) => (!g("project") || i.projectId === g("project")) && (st === "all" || (st === "done") === isDone(i))
    && (!g("assignee") || (g("assignee") === "me" ? i.assigneeId === me : g("assignee") === "none" ? !i.assigneeId : i.assigneeId === g("assignee")))
    && (!g("priority") || i.priority === g("priority")) && (!g("type") || i.type === g("type")) && (!g("team") || i.teamId === g("team")) && textHit(i, g("text")));
  const f = g("sort") || (g("text") ? "updated" : "updated"); const dir = g("dir") || (["summary", "key", "assignee", "due", "type", "customer", "project", "team"].includes(f) ? "ASC" : "DESC");
  list.sort((a, b) => { const x = sortVal(a, f), y = sortVal(b, f); return (x < y ? -1 : x > y ? 1 : 0) * (dir === "ASC" ? 1 : -1); });
  return { list, sortField: f, sortDir: dir, state: st };
}
/** Einfache Suche in JQL umwandeln (für „Erweitert“ und gespeicherte Filter). */
function simpleToJql(ps) {
  const g = (k) => ps.get(k) || ""; const q = []; const pk = g("project") && proj(g("project"))?.key;
  if (g("text")) q.push(`text ~ "${g("text").replace(/"/g, "")}"`); if (pk) q.push(`project = ${pk}`);
  const st = g("state") || "open"; if (st === "open") q.push("resolution = Unresolved"); if (st === "done") q.push("statusCategory = Fertig");
  if (g("assignee") === "me") q.push("assignee = currentUser()"); else if (g("assignee") === "none") q.push("assignee IS EMPTY"); else if (g("assignee")) q.push(`assignee = "${uname(g("assignee"))}"`);
  if (g("priority")) q.push(`priority = ${PRIOS[g("priority")].label}`); if (g("type")) q.push(`type = "${TYPES[g("type")].label}"`); if (g("team") && team(g("team"))) q.push(`team = "${team(g("team")).name}"`);
  return `${q.join(" AND ")}${q.length ? " " : ""}ORDER BY ${g("sort") || "updated"} ${g("dir") || "DESC"}`;
}

const DEFAULT_FILTERS = [
  { id: "f-mine", name: "Meine offenen Vorgänge", jql: "assignee = currentUser() AND resolution = Unresolved ORDER BY priority DESC, due ASC" },
  { id: "f-reported", name: "Von mir gemeldet", jql: "reporter = currentUser() ORDER BY created DESC" },
  { id: "f-overdue", name: "Überfällig", jql: "due < now() AND resolution = Unresolved ORDER BY due ASC" },
  { id: "f-week", name: "Diese Woche fällig", jql: "due >= startOfWeek() AND due <= endOfWeek() AND resolution = Unresolved ORDER BY due ASC" },
  { id: "f-unassigned", name: "Nicht zugewiesen", jql: "assignee IS EMPTY AND resolution = Unresolved AND type != Epic ORDER BY priority DESC" },
  { id: "f-resolved", name: "Kürzlich erledigt", jql: "resolved >= -7d ORDER BY resolved DESC" },
  { id: "f-all", name: "Alle Vorgänge", jql: "ORDER BY created DESC" },
];

/* ---------- Darstellungs-Bausteine ---------- */
const typeIcon = (t) => `<span class="tico" style="background:${TYPES[t].color}" title="${TYPES[t].label}">${icon(TYPES[t].icon)}</span>`;
const prioIcon = (p) => `<span class="pico" title="Priorität: ${PRIOS[p].label}" style="color:${PRIOS[p].color};display:inline-flex"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${PRIOS[p].svg}</svg></span>`;
const lozenge = (i) => { const s = statusOf(i); return `<span class="lozenge cat-${s.cat}">${esc(s.name)}</span>`; };
const avatar = (id, lg) => { const u = user(id); return u ? `<span class="avatar${lg ? " lg" : ""}" style="background:${u.color}" title="${esc(u.name)}">${esc(initials(u.name))}</span>` : `<span class="avatar none${lg ? " lg" : ""}" title="Nicht zugewiesen">${icon("user")}</span>`; };
const custAvatar = (c) => `<span class="avatar" style="background:${hashColor(c?.email || c?.name)}" title="${esc(c?.name)}">${esc(initials(c?.name))}</span>`;
const epicChip = (i) => { const e = issue(i.epicId); return e ? `<span class="chip" style="background:${e.color || "#8f5bd6"}22;color:${e.color || "#8f5bd6"}" title="Epic">${esc(e.summary)}</span>` : ""; };
const keyLink = (i) => `<a class="key" href="#" data-act="open" data-id="${i.id}">${keyOf(i)}</a>`;
const dueChip = (i) => { if (!i.dueDate || isDone(i)) return ""; const d = daysBetween(today(), i.dueDate); if (d < 0) return `<span class="chip red" title="Überfällig">${fmtShort(i.dueDate)}</span>`; if (d <= 2) return `<span class="chip yellow" title="Bald fällig">${fmtShort(i.dueDate)}</span>`; return `<span class="chip gray">${fmtShort(i.dueDate)}</span>`; };
const userOpts = (sel, none = "Nicht zugewiesen", teamId = null) => {
  const o = (u) => `<option value="${u.id}" ${u.id === sel ? "selected" : ""}>${esc(u.name)}</option>`; const t = team(teamId);
  if (!t) return `<option value="">${none}</option>` + activeUsers().map(o).join("");
  const inTeam = activeUsers().filter((u) => t.memberIds.includes(u.id));
  return `<option value="">${none}</option><optgroup label="${esc(t.name)}">${inTeam.map(o).join("")}</optgroup><optgroup label="Weitere Personen">${activeUsers().filter((u) => !inTeam.includes(u)).map(o).join("")}</optgroup>`;
};
const prioOpts = (sel) => Object.entries(PRIOS).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v.label}</option>`).join("");
const statusOpts = (i) => workflowOf(proj(i.projectId)).map((s) => `<option value="${s.id}" ${s.id === i.status ? "selected" : ""}>${s.name}</option>`).join("");
const subtaskProgress = (i) => { const ch = children(i); if (!ch.length) return ""; const d = ch.filter(isDone).length; return `<span class="chip gray" title="Teilaufgaben">☑ ${d}/${ch.length}</span>`; };

/* ---------- Diagramme (SVG) ---------- */
function lineChart({ labels, series, height = 220, yMax, yLabel = "" }) {
  const W = 640, H = height, L = 36, R = 70, T = 12, B = 26; const iw = W - L - R, ih = H - T - B;
  const max = yMax ?? Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null)));
  const niceMax = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const x = (k) => L + (labels.length === 1 ? iw / 2 : (k / (labels.length - 1)) * iw); const y = (v) => T + ih - (v / niceMax) * ih;
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = (niceMax / 4) * k; g += `<line class="gridline" x1="${L}" x2="${L + iw}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 10) / 10}</text>`; }
  const step = Math.ceil(labels.length / 8);
  labels.forEach((lb, k) => { const last = labels.length - 1; if ((k % step === 0 && last - k >= step / 2) || k === last) g += `<text x="${x(k)}" y="${H - 6}" text-anchor="middle">${esc(lb)}</text>`; });
  series.forEach((s) => {
    const pts = s.values.map((v, k) => v == null ? null : [x(k), y(v)]).filter(Boolean);
    if (!pts.length) return;
    g += `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round" stroke-linecap="round" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    const last = pts[pts.length - 1]; const lv = s.values.filter((v) => v != null).slice(-1)[0];
    if (!s.dash) g += `<circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    g += `<text x="${last[0] + 8}" y="${last[1] + 4}" style="fill:var(--fg-2)">${esc(s.name)} ${Math.round(lv * 10) / 10}</text>`;
  });
  labels.forEach((lb, k) => {
    const tip = `${lb}\n` + series.map((s) => `${s.name}: ${s.values[k] == null ? "–" : Math.round(s.values[k] * 10) / 10}`).join("\n");
    const w = iw / Math.max(1, labels.length - 1);
    g += `<g class="col-hit" data-tip="${esc(tip)}"><rect class="hit" x="${x(k) - w / 2}" y="${T}" width="${w}" height="${ih}"/><line class="cross" x1="${x(k)}" x2="${x(k)}" y1="${T}" y2="${T + ih}"/></g>`;
  });
  return `<div class="legend">${series.map((s) => `<span><i class="${s.dash ? "dash" : "line"}" style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}${yLabel ? `<span class="muted">· ${esc(yLabel)}</span>` : ""}</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(", "))}">${g}</svg>`;
}
function barChart({ labels, series, height = 220 }) {
  const W = 640, H = height, L = 36, R = 10, T = 12, B = 26; const iw = W - L - R, ih = H - T - B;
  const max = Math.max(1, ...series.flatMap((s) => s.values)); const nice = Math.ceil(max / 4) * 4;
  const y = (v) => T + ih - (v / nice) * ih; const gw = iw / labels.length; const bw = Math.min(28, (gw - 16) / series.length - 2);
  let g = "";
  for (let k = 0; k <= 4; k++) { const v = (nice / 4) * k; g += `<line class="gridline" x1="${L}" x2="${L + iw}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`; }
  labels.forEach((lb, k) => {
    const cx = L + gw * k + gw / 2; const total = series.length * (bw + 2) - 2; let x0 = cx - total / 2;
    series.forEach((s) => { const v = s.values[k]; const h = Math.max(0, (v / nice) * ih); const yy = T + ih - h; const r = Math.min(4, h);
      g += `<path d="M${x0},${T + ih} V${yy + r} Q${x0},${yy} ${x0 + r},${yy} H${x0 + bw - r} Q${x0 + bw},${yy} ${x0 + bw},${yy + r} V${T + ih} Z" fill="${s.color}" data-tip="${esc(`${lb}\n${s.name}: ${v}`)}"/>`;
      g += `<text x="${x0 + bw / 2}" y="${yy - 4}" text-anchor="middle" style="fill:var(--fg-2)">${v}</text>`; x0 += bw + 2; });
    g += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join("")}</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
function hbars(rows, unit = "") {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => `<div class="hbar" data-tip="${esc(`${r.label}: ${r.value}${unit}${r.extra ? "\n" + r.extra : ""}`)}"><span class="trunc">${esc(r.label)}</span><div class="track"><div class="fill" style="width:${(r.value / max) * 100}%"></div></div><span class="small b" style="text-align:right">${r.value}${unit}</span></div>`).join("") || '<p class="muted">Keine Daten.</p>';
}
function statusStack(list) {
  const cats = ["todo", "progress", "done"]; const n = (c) => list.filter((i) => statusOf(i).cat === c).length; const total = list.length || 1;
  const colors = { todo: "var(--todo-fg)", progress: "var(--s1)", done: "var(--ok)" };
  return `<div class="stack">${cats.filter((c) => n(c)).map((c) => `<div style="width:${(n(c) / total) * 100}%;background:${colors[c]}" data-tip="${CAT_LABEL[c]}: ${n(c)}"></div>`).join("")}</div>
    <div class="legend" style="margin-top:8px">${cats.map((c) => `<span><i style="background:${colors[c]}"></i>${CAT_LABEL[c]} ${n(c)}</span>`).join("")}</div>`;
}

/* ---------- Routing ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, ""); const [path, qs] = h.split("?");
  return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(qs || "") };
}
function go(h) { location.hash = h; }
/* ---------- Navigation: jeder Ansichtswechsel ist ein Schritt im Verlauf (Zurück/Vor im Browser, in der App und in Teams) ---------- */
const baseHash = (h = location.hash) => { const [path, qs] = h.replace(/^#/, "").split("?"); const ps = new URLSearchParams(qs || ""); ps.delete("issue"); const q = ps.toString(); return `#${path || "/your-work"}${q ? `?${q}` : ""}`; };
/** Einen Parameter der aktuellen Ansicht ändern (z. B. Warteschlange, Reiter) – als neuer Verlaufsschritt. */
function setParam(k, v) { const { parts, params } = route(); params.delete("issue"); if (v === null || v === undefined || v === "") params.delete(k); else params.set(k, v); const q = params.toString(); go(`#/${parts.map(encodeURIComponent).join("/")}${q ? `?${q}` : ""}`); }
let lastBase = null;
function onNavigate() {
  $("#topnav").classList.remove("menu-open"); $("#notifs")?.classList.remove("open"); closeDrawer();
  const base = baseHash(); const key = route().params.get("issue");
  if (base !== lastBase) { lastBase = base; if (ui.modal && ui.modal !== "issue") closeModal(); ui.rowLimit = ROW_PAGE; render(); window.scrollTo(0, 0); }
  if (key) { const cur = ui.openIssue && issue(ui.openIssue); if (!cur || keyOf(cur) !== key || ui.modal !== "issue") findByKey(key).then((i) => (i ? openIssue(i.id, { push: false }) : toast(`Vorgang ${key} nicht gefunden.`))); }
  else if (ui.modal === "issue") closeModal({ fromNav: true });
  updateNavButtons();
}
function updateNavButtons() { const nav = window.navigation; const b = $("#nav-back"), f = $("#nav-fwd"); if (b && nav && "canGoBack" in nav) { b.disabled = !nav.canGoBack; f.disabled = !nav.canGoForward; } }

/* ---------- Rahmen ---------- */
function renderTop() {
  const r = route().parts[0] || "your-work";
  const unread = db.notifications.filter((n) => n.userId === db.currentUserId && !n.read).length;
  const link = (h, label, keyName) => `<a class="navlink ${r === keyName ? "on" : ""}" href="#/${h}">${label}</a>`;
  const gs = $("#gsearch"); const keep = gs && (gs.value || document.activeElement === gs) ? { v: gs.value, f: document.activeElement === gs, p: gs.selectionStart, sugg: !$("#gsugg").hidden } : null; // Tippen nicht durch Live-Updates unterbrechen
  $("#topnav").innerHTML = `
    <button class="btn subtle icon hamb" data-act="menu" aria-label="Menü">${icon("menu")}</button>
    <span class="navbtns"><button class="btn subtle icon" id="nav-back" data-act="nav-back" title="Zurück (Alt+←)" aria-label="Zurück">‹</button><button class="btn subtle icon" id="nav-fwd" data-act="nav-fwd" title="Vor (Alt+→)" aria-label="Vor">›</button></span>
    <a class="logo" href="#/${homeRoute()}">${ui.brand?.logo ? `<img class="brand-logo" src="${esc(ui.brand.logo)}" alt="">` : `<img class="app-icon" src="/icons/icon-64.png" alt="">`}<span class="trunc">${esc(ui.brand?.appName || "GF Tracker")}</span></a>
    ${link("your-work", "Mein Tag", "your-work")}${link("projects", "Projekte", r === "p" ? "p" : "projects")}${link("teams", "Teams", "teams")}${link("customers", "Kunden", "customers")}${link("filters", "Suche", "filters")}${link("dashboard", "Dashboard", "dashboard")}<a class="navlink nav-portal" href="/portal" target="_blank" rel="noopener">Service-Portal ↗</a>
    <a class="btn subtle icon show-m" href="#/filters?state=open" data-act="m-search" aria-label="Suchen">${icon("search")}</a><div class="search gs-wrap">${icon("search")}<input type="search" id="gsearch" placeholder="Suchen: Text, Nummer, Kunde …" aria-label="Suchen" autocomplete="off"><div id="gsugg" class="gsugg" hidden></div></div>
    <button class="btn primary" data-act="create" style="margin-left:6px">${icon("plus")}<span class="hide-m">Neuer Vorgang</span></button>
    <button class="btn subtle icon bell" data-act="notifs" aria-label="Benachrichtigungen">${icon("bell")}${unread ? `<span class="n">${unread > 99 ? "99+" : unread}</span>` : ""}</button>
    <button class="btn subtle icon hide-m" data-act="theme" aria-label="Hell/Dunkel">${icon("sun")}</button>
    <span id="sync-badge" class="chip gray" hidden></span>
    ${canEdit(me()) ? "" : '<span class="chip yellow" title="Sie können ansehen und suchen, aber nichts ändern">Nur lesen</span>'}<a href="#/settings" class="row nowrap" title="${esc(me().name)} – Einstellungen" style="gap:6px;color:var(--fg)">${avatar(db.currentUserId)}<span class="small b hide-m">${esc(me().name.split(" ")[0])}</span></a>
    <button class="btn subtle icon" data-act="logout" title="Abmelden" aria-label="Abmelden">${icon("logout")}</button>`;
  updateNavButtons();
  if (keep) { const g = $("#gsearch"); g.value = keep.v; if (keep.f) { g.focus(); g.setSelectionRange(keep.p, keep.p); } if (keep.sugg) showSuggestions(keep.v); }
}
/** Ansichten eines Projekts – für die Projektleiste und das Hauptmenü. */
const projectViews = (p) => [...(p.type === "software" ? [["board", "Board", "board"], ["backlog", "Backlog", "backlog"], ["timeline", "Zeitleiste", "timeline"], ["list", "Liste", "list"], ["reports", "Berichte", "chart"]]
    : p.type === "business" ? [["board", "Board", "board"], ["timeline", "Zeitleiste", "timeline"], ["list", "Liste", "list"], ["reports", "Berichte", "chart"]]
    : [["queue", "Warteschlangen", "queue"], ["dispatch", "Einsatzplanung", "timeline"], ["board", "Board", "board"], ["list", "Liste", "list"], ["reports", "Berichte", "chart"]]), ["settings", "Projekteinstellungen", "gear"]];
function projectNav(p, view) {
  const items = projectViews(p);
  if (docked()) // Seitenleiste ist da: Projektansichten als Reiter oben statt zweiter Leiste
    return `<div class="proj-head"><span class="pavatar" style="background:${p.color}">${esc(p.key.slice(0, 3))}</span><div class="trunc"><div class="b trunc">${esc(p.name)}</div><div class="small muted">${PROJECT_TYPES[p.type].label}${p.type === "service" ? ` · <a href="/portal?p=${p.key}" target="_blank" rel="noopener">Kundenportal ↗</a>` : ""}</div></div></div>
      <nav class="project-tabs show">${items.map(([v, l, ic]) => `<a class="ptab ${view === v ? "on" : ""}" href="#/p/${p.key}/${v}">${icon(ic)}${l}</a>`).join("")}</nav>`;
  $("#psidebar").hidden = false;
  $("#psidebar").innerHTML = `<div class="phead"><span class="pavatar" style="background:${p.color}">${esc(p.key.slice(0, 3))}</span><div class="trunc"><div class="b trunc">${esc(p.name)}</div><div class="small muted">${PROJECT_TYPES[p.type].label}</div></div></div>
    <div class="label">Planung</div>${items.map(([v, l, ic]) => `<a href="#/p/${p.key}/${v}" class="${view === v ? "on" : ""}">${icon(ic)}${l}</a>`).join("")}
    ${p.type === "service" ? `<div class="label">Kunden</div><a href="/portal?p=${p.key}" target="_blank" rel="noopener">${icon("portal")}Kundenportal öffnen ↗</a>` : ""}`;
  return `<div class="project-tabs">${items.map(([v, l]) => `<a class="toggle ${view === v ? "on" : ""}" href="#/p/${p.key}/${v}">${l}</a>`).join("")}</div>`;
}
function render() {
  renderTop(); renderSidenav();
  const { parts, params } = route(); $("#psidebar").hidden = true;
  if (params.has("q")) ui.queue = params.get("q"); if (params.has("tab")) ui.yourWork = params.get("tab"); ui.backlogEpic = params.get("epic") || "";
  let html;
  try {
    switch (parts[0] || "your-work") {
      case "your-work": html = viewYourWork(); break;
      case "projects": html = viewProjects(); break;
      case "p": { const p = projByKey(parts[1]); if (!p) { html = `<div class="empty">Projekt nicht gefunden.</div>`; break; }
        const v = parts[2] || (p.type === "service" ? "queue" : "board"); const tabs = projectNav(p, v);
        html = tabs + ({ dispatch: viewDispatch, board: viewBoard, backlog: viewBacklog, timeline: viewTimeline, list: viewList, reports: viewReports, queue: viewQueue, settings: viewProjectSettings }[v] || viewBoard)(p); break; }
      case "import": html = viewImport(); break;
      case "integrations": html = viewIntegrations(); break;
      case "customers": html = parts[1] ? viewCustomer(customer(parts[1])) : viewCustomers(); break;
      case "teams": html = parts[1] ? viewTeam(team(parts[1])) : viewTeams(); break;
      case "filters": html = viewFilters(params); break;
      case "dashboard": html = viewDashboard(); break;
      case "portal": html = `<div class="empty">Das Kundenportal ist öffentlich erreichbar unter <a href="/portal" target="_blank" rel="noopener">${esc(location.origin)}/portal</a> – diesen Link können Sie an Kunden weitergeben.</div>`; break;
      case "settings": html = viewSettings(); break;
      case "system": html = viewSystem(); break;
      case "automation": html = viewAutomation(); break;
      case "issue": { html = viewYourWork(); findByKey(parts[1]).then((i) => { if (!i) return toast(`Vorgang ${parts[1]} nicht gefunden.`); history.replaceState(null, "", `#/your-work?issue=${encodeURIComponent(keyOf(i))}`); lastBase = "#/your-work"; openIssue(i.id, { push: false }); }); break; }
      default: html = viewYourWork();
    }
  } catch (e) { console.error(e); html = `<div class="note err">Fehler beim Anzeigen: ${esc(e.message)}</div>`; }
  $("#view").innerHTML = html;
  setTitle();
  if (parts[0] === "settings" && params.get("sec")) setTimeout(() => { const t = $(`#sec-${params.get("sec")}`); if (t) { t.scrollIntoView({ block: "start" }); t.classList.add("flash"); setTimeout(() => t.classList.remove("flash"), 1600); } }, 30);
  bindDnD();
  if (ui.openIssue && $("#modal").classList.contains("open") && ui.modal === "issue") renderIssue();
}

/* ---------- Arbeitsablauf: Schritte, Termine, Servicebericht ---------- */
const fmtAppt = (iso) => iso ? new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const ACTIVE_APPT = ["SCHEDULED", "WORKING", "PARTS", "WAITING"];
function apptChip(i) {
  if (!i.appointmentAt || !ACTIVE_APPT.includes(i.status)) return "";
  const d = dayKey(i.appointmentAt), t = today();
  const cls = d < t && i.status === "SCHEDULED" ? "red" : d === t ? "yellow" : "gray";
  return `<span class="chip ${cls}" title="Termin">◷ ${d === t ? "heute " + fmtTime(i.appointmentAt) : fmtAppt(i.appointmentAt)}</span>`;
}
const stepsFor = (i) => transitionsFor(proj(i.projectId), i);
const primaryStep = (i) => stepsFor(i).find((t) => t.primary) || null;
/** Hauptknopf für Listen: "Übernehmen", wenn niemand zuständig ist, sonst der nächste Arbeitsschritt. */
function actionButton(i, size = "sm") {
  if (!i.assigneeId && !isDone(i)) return `<button class="btn ${size} primary" data-act="take" data-id="${i.id}">Übernehmen</button>`;
  const t = primaryStep(i); if (!t) return "";
  return `<button class="btn ${size} primary" data-act="step" data-id="${i.id}" data-t="${t.id}">${esc(t.label)}</button>`;
}
/** Fortschrittsleiste der Hauptschritte (Nebenzustände wie „Wartet“ werden markiert). */
function processStepper(i) {
  const wf = workflowOf(proj(i.projectId)); const main = wf.filter((s) => !s.side); const cur = statusOf(i);
  const curIdx = cur.side ? main.findIndex((s) => s.id === (proj(i.projectId).type === "service" ? "WORKING" : "PROGRESS")) : main.findIndex((s) => s.id === i.status);
  return `<div class="stepper">${main.map((st, k) => `<div class="step ${k < curIdx ? "done" : k === curIdx ? "current" : ""}"><span class="dot">${k < curIdx ? "✓" : k + 1}</span><span class="lbl">${esc(st.name)}</span></div>`).join("")}</div>
    ${cur.side ? `<div class="note warn" style="margin-top:8px">⏸ ${esc(cur.name)}</div>` : ""}`;
}
function workflowPanel(i) {
  const steps = stepsFor(i); const prim = steps.filter((t) => t.primary), sec = steps.filter((t) => !t.primary);
  return `<div class="details wf-panel"><div class="dh row" style="justify-content:space-between">Arbeitsablauf ${lozenge(i)}</div>
    <div style="padding:12px 14px">${processStepper(i)}
      <div class="row" style="margin-top:12px">${!i.assigneeId && !isDone(i) ? `<button class="btn primary" data-act="take" data-id="${i.id}">Übernehmen</button>` : ""}
        ${prim.map((t) => `<button class="btn ${i.assigneeId || isDone(i) ? "primary" : ""}" data-act="step" data-id="${i.id}" data-t="${t.id}">${esc(t.label)}</button>`).join("")}</div>
      ${sec.length ? `<div class="row" style="margin-top:8px">${sec.map((t) => `<button class="btn sm" data-act="step" data-id="${i.id}" data-t="${t.id}">${esc(t.label)}</button>`).join("")}</div>` : ""}
      <details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Status direkt setzen</summary><select class="status-btn cat-${statusOf(i).cat}" data-f="status" aria-label="Status" style="width:auto;margin-top:6px">${statusOpts(i)}</select></details>
    </div></div>`;
}
function reportText(r) {
  return ["Servicebericht", r.cause ? `Ursache: ${r.cause}` : "", `Durchgeführte Arbeiten: ${r.action}`, r.parts ? `Material/Ersatzteile: ${r.parts}` : "", r.hours ? `Arbeitszeit: ${String(r.hours).replace(".", ",")} h` : ""].filter(Boolean).join("\n");
}
function reportBlock(i) {
  const r = i.resolution; if (!r) return "";
  return `<div class="card pad report" style="margin:6px 0 16px;border-left:4px solid var(--ok)"><div class="row"><b>Servicebericht</b><span class="small muted">${esc(uname(r.by))} · ${fmtDT(r.at)}</span><span class="sp"></span><button class="btn sm" data-act="print-report" data-id="${i.id}">Drucken / PDF</button></div>
    <div class="grid g2" style="gap:8px;margin-top:8px;font-size:13px">${r.cause ? `<div><div class="small muted">Ursache</div>${esc(r.cause)}</div>` : ""}<div><div class="small muted">Durchgeführte Arbeiten</div><div style="white-space:pre-wrap">${esc(r.action)}</div></div>
    ${r.parts ? `<div><div class="small muted">Material / Ersatzteile</div><div style="white-space:pre-wrap">${esc(r.parts)}</div></div>` : ""}${r.hours ? `<div><div class="small muted">Arbeitszeit</div>${String(r.hours).replace(".", ",")} h</div>` : ""}</div></div>`;
}
function printReport(i) {
  const r = i.resolution; if (!r) return; const p = proj(i.projectId);
  const w = window.open("", "_blank"); if (!w) return toast("Bitte Pop-ups für diese Seite erlauben.");
  const row = (l, v) => v ? `<tr><th>${l}</th><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>` : "";
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Servicebericht ${keyOf(i)}</title><style>body{font:14px/1.5 "Segoe UI",Arial,sans-serif;color:#172b4d;margin:40px}h1{font-size:22px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #c7ccd4;padding:8px 10px;text-align:left;vertical-align:top}th{width:200px;background:#f1f2f4}.sign{display:flex;gap:40px;margin-top:60px}.sign div{flex:1;border-top:1px solid #172b4d;padding-top:6px;font-size:12px}</style></head><body>
    <h1>Servicebericht ${keyOf(i)}</h1><div>${esc(sync.company)} · ${esc(p.name)}</div>
    <table>${row("Kunde", [i.customer?.company, i.customer?.name].filter(Boolean).join(" – "))}${row("Anliegen", i.summary)}${row("Termin", i.appointmentAt ? fmtAppt(i.appointmentAt) : "")}${row("Techniker/in", uname(r.by))}${row("Ursache", r.cause)}${row("Durchgeführte Arbeiten", r.action)}${row("Material / Ersatzteile", r.parts)}${row("Arbeitszeit", r.hours ? String(r.hours).replace(".", ",") + " h" : "")}${row("Erledigt am", fmtDT(r.at))}</table>
    <div class="sign"><div>Ort, Datum</div><div>Unterschrift Kunde</div><div>Unterschrift Techniker/in</div></div></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}
/** Dialog für einen Arbeitsschritt mit den nötigen Pflichtangaben. */
function stepForm(i, t, prefill = {}) {
  const p = proj(i.projectId); const isSvc = p.type === "service"; const n = new Set(t.needs);
  const appt = prefill.appointmentAt || i.appointmentAt; const ad = appt ? new Date(appt) : (() => { const d = new Date(); d.setDate(d.getDate() + (d.getHours() >= 12 ? 1 : 0)); return d; })();
  const dateVal = dayKey(ad), timeVal = appt ? fmtTime(appt) : "08:00";
  ui.stepReturn = ui.modal === "issue" ? i.id : null;
  openModal(`<div class="modal-h"><h2>${esc(t.label)}</h2><button class="btn subtle icon" data-act="step-cancel" aria-label="Schließen">${icon("x")}</button></div>
    <form id="step-form" data-id="${i.id}" data-t="${t.id}"><div class="modal-b">
      <div class="row small muted">${typeIcon(i.type)} <b class="key">${keyOf(i)}</b> ${esc(i.summary)}</div>
      <div class="row small">${lozenge(i)} → <span class="lozenge cat-${statusInfo(p, t.to).cat}">${esc(statusInfo(p, t.to).name)}</span></div>
      ${t.hint ? `<div class="note info">${esc(t.hint)}</div>` : ""}
      ${n.has("assignee") ? `<label class="f"><span>Verantwortlich <span class="req">*</span></span><select name="assigneeId" required>${userOpts(prefill.assigneeId || i.assigneeId || db.currentUserId, "– bitte wählen –")}</select></label>` : ""}
      ${n.has("appointment") ? `<div class="grid g2" style="gap:12px"><label class="f"><span>Termin – Datum <span class="req">*</span></span><input type="date" name="date" value="${dateVal}" required></label><label class="f"><span>Uhrzeit <span class="req">*</span></span><input type="time" name="time" value="${timeVal}" step="900" required></label></div>` : ""}
      ${n.has("reply") ? `<label class="f"><span>Nachricht an den Kunden <span class="req">*</span></span><textarea name="reply" rows="4" required placeholder="z. B. Welche Seriennummer hat die Anlage?"></textarea></label>` : ""}
      ${n.has("note") ? `<label class="f"><span>Interne Notiz <span class="req">*</span></span><textarea name="note" rows="3" required></textarea></label>` : ""}
      ${n.has("comment") ? `<label class="f"><span>Begründung <span class="req">*</span></span><textarea name="comment" rows="3" required></textarea></label>` : ""}
      ${n.has("optComment") ? `<label class="f">Kommentar (optional)<textarea name="comment" rows="2"></textarea></label>` : ""}
      ${n.has("report") ? `<label class="f">Ursache<input type="text" name="cause" maxlength="300" placeholder="z. B. Temperaturfühler defekt"></label>
        <label class="f"><span>Durchgeführte Arbeiten <span class="req">*</span></span><textarea name="action" rows="4" required placeholder="z. B. Fühler getauscht, Probelauf 30 min ohne Fehler"></textarea></label>
        <div class="grid g2" style="gap:12px"><label class="f">Material / Ersatzteile<textarea name="parts" rows="2"></textarea></label><label class="f">Arbeitszeit (Stunden)<input type="number" name="hours" min="0" step="0.25" placeholder="z. B. 1,5"></label></div>` : ""}
      ${isSvc && (n.has("reply") || n.has("report") || n.has("appointment")) && !i.customer?.email ? `<p class="small muted" style="margin:0">Hinweis: Für diesen Vorgang ist keine Kunden-E-Mail hinterlegt.</p>` : ""}
    </div><div class="modal-f"><span class="modal-hint">Esc = Abbrechen · Strg+Enter = Bestätigen</span><button type="button" class="btn subtle" data-act="step-cancel">Abbrechen</button><button class="btn primary" type="submit">${esc(t.label)}</button></div></form>`);
  setTimeout(() => $("#step-form select, #step-form input, #step-form textarea")?.focus(), 30);
}
function performStep(i, t, fd) {
  const p = proj(i.projectId); const isSvc = p.type === "service"; const n = new Set(t.needs); const changes = {};
  if (n.has("assignee")) { const a = fd.get("assigneeId"); if (!a) throw new Error("Bitte eine verantwortliche Person wählen."); changes.assigneeId = a; }
  if (n.has("appointment")) {
    const d = fd.get("date"), tm = fd.get("time"); if (!d || !tm) throw new Error("Bitte Datum und Uhrzeit des Termins angeben.");
    const dt = new Date(`${d}T${tm}`); if (isNaN(dt)) throw new Error("Ungültiger Termin."); changes.appointmentAt = dt.toISOString();
  }
  const text = (k) => String(fd.get(k) || "").trim();
  if (n.has("reply") && !text("reply")) throw new Error("Bitte eine Nachricht an den Kunden eingeben.");
  if (n.has("note") && !text("note")) throw new Error("Bitte eine interne Notiz eingeben.");
  if (n.has("comment") && !text("comment")) throw new Error("Bitte eine Begründung eingeben.");
  if (n.has("report")) {
    if (!text("action")) throw new Error("Bitte die durchgeführten Arbeiten beschreiben.");
    const hours = Number(String(fd.get("hours") || "0").replace(",", ".")) || 0;
    changes.resolution = { cause: text("cause"), action: text("action"), parts: text("parts"), hours, at: new Date().toISOString(), by: db.currentUserId };
    if (hours > 0) i.loggedH = Math.round(((i.loggedH || 0) + hours) * 100) / 100;
  }
  if (text("reply")) addComment(i, text("reply"), { internal: false });
  if (text("note")) addComment(i, text("note"), { internal: true });
  if (text("comment")) addComment(i, text("comment"), { internal: isSvc });
  if (changes.resolution) addComment(i, reportText(changes.resolution), { internal: false });
  updateIssue(i, { ...changes, status: t.to });
  if (t.id === "review" && i.reporterId && i.reporterId !== db.currentUserId) { notify([i.reporterId], "review", `Zur Freigabe: ${keyOf(i)}`, `${me().name}: ${i.summary}`, i.id); save(); }
}
function takeIssue(i) { updateIssue(i, { assigneeId: db.currentUserId }); toast(`${keyOf(i)} übernommen`); }

/* ---------- Ansicht: Mein Tag ---------- */
function workRow(i, reason = "") {
  return `<div class="wrow" data-act="open" data-id="${i.id}">
    <div class="wmain">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><span class="trunc b" style="font-weight:500">${esc(i.summary)}</span></div>
    <div class="wmeta">${reason}${apptChip(i)}${dueChip(i)}${(() => { const s = slaInfo(i, "resolve"); return s && !s.stopped && (s.breached || s.risk) ? slaChip(s) : ""; })()}${i.customer ? `<span class="chip gray">${esc(i.customer.company || i.customer.name)}</span>` : ""}${prioIcon(i.priority)}${lozenge(i)}</div>
    <div class="wact">${actionButton(i)}</div></div>`;
}
function section(title, list, empty, reasonFn = () => "", tone = "") {
  if (!list.length && !empty) return "";
  return `<section class="wsec ${tone}"><h2>${title} <span class="count">${list.length}</span></h2>${list.length ? `<div class="card wlist">${list.map((i) => workRow(i, reasonFn(i))).join("")}</div>` : `<p class="small muted" style="margin:0 0 6px">${empty}</p>`}</section>`;
}
function viewYourWork() {
  const t = today(); const uid_ = db.currentUserId; const u = me();
  const open = db.issues.filter((i) => !isDone(i) && i.type !== "EPIC");
  const mine = open.filter((i) => i.assigneeId === uid_);
  const isAgent = u.role === "AGENT" || u.role === "ADMIN" || db.projects.some((p) => p.type === "service" && p.leadId === uid_);
  const urgentOf = (i) => isOverdue(i) || ["first", "resolve"].some((k) => { const s = slaInfo(i, k); return s && !s.stopped && (s.breached || s.risk); }) || (i.status === "SCHEDULED" && i.appointmentAt && new Date(i.appointmentAt) < new Date(Date.now() - 2 * 36e5));
  const newRequests = isAgent ? open.filter((i) => proj(i.projectId).type === "service" && i.status === "OPEN" && !i.assigneeId && i.type !== "SUBTASK") : [];
  const teamInbox = open.filter((i) => inTeamInbox(i) && team(i.teamId)?.memberIds.includes(uid_) && !newRequests.includes(i))
    .sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9") || PRIOS[b.priority].rank - PRIOS[a.priority].rank);
  const urgent = mine.filter(urgentOf);
  const todayList = mine.filter((i) => !urgent.includes(i) && ((i.appointmentAt && dayKey(i.appointmentAt) === t && ACTIVE_APPT.includes(i.status)) || i.dueDate === t))
    .sort((a, b) => (a.appointmentAt || "9").localeCompare(b.appointmentAt || "9"));
  const waitingStates = ["WAITING", "PARTS", "BLOCKED"];
  const approvals = open.filter((i) => i.status === "REVIEW" && i.reporterId === uid_ && i.assigneeId !== uid_);
  const doing = mine.filter((i) => !urgent.includes(i) && !todayList.includes(i) && statusOf(i).cat === "progress" && !waitingStates.includes(i.status) && i.status !== "REVIEW");
  const waiting = mine.filter((i) => !urgent.includes(i) && !todayList.includes(i) && (waitingStates.includes(i.status) || i.status === "REVIEW"));
  const next = mine.filter((i) => !urgent.includes(i) && !todayList.includes(i) && statusOf(i).cat === "todo")
    .sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9") || PRIOS[b.priority].rank - PRIOS[a.priority].rank);
  const doneToday = db.issues.filter((i) => i.assigneeId === uid_ && i.resolvedAt && dayKey(i.resolvedAt) === t).length;
  const reasonUrgent = (i) => isOverdue(i) ? `<span class="chip red">überfällig seit ${daysBetween(i.dueDate, t)} T</span>` : i.status === "SCHEDULED" && i.appointmentAt && new Date(i.appointmentAt) < new Date() ? '<span class="chip red">Einsatz nicht begonnen</span>' : "";
  const tab = ui.yourWork === "assigned" ? "day" : ui.yourWork;
  const watched = db.issues.filter((i) => i.watchers.includes(uid_) && i.assigneeId !== uid_ && !isDone(i));
  const recent = (localState.recent[uid_] || []).map(issue).filter(Boolean);
  const tabs = `<div class="tabs"><button class="${tab === "day" ? "on" : ""}" data-act="yw-tab" data-v="day">Mein Tag</button><button class="${tab === "watched" ? "on" : ""}" data-act="yw-tab" data-v="watched">Beobachtet (${watched.length})</button><button class="${tab === "recent" ? "on" : ""}" data-act="yw-tab" data-v="recent">Zuletzt angesehen</button></div>`;
  const head = `<div class="page-head"><div><h1>${tab === "day" ? "Mein Tag" : "Ihre Arbeit"}</h1><p class="muted" style="margin:4px 0 0">Hallo ${esc(u.name.split(" ")[0])} · ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}${doneToday ? ` · heute ${doneToday} erledigt ✓` : ""}</p></div>
    <button class="btn primary" data-act="create">${icon("plus")} Vorgang erfassen</button></div>`;
  if (tab !== "day") {
    const list = tab === "watched" ? watched : recent;
    return head + tabs + (list.length ? `<div class="card wlist">${list.map((i) => workRow(i)).join("")}</div>` : `<div class="empty">${tab === "watched" ? "Sie beobachten keine offenen Vorgänge." : "Noch keine Vorgänge angesehen."}</div>`);
  }
  const tiles = [["Sofort erledigen", urgent.length + newRequests.length, urgent.length + newRequests.length ? "var(--danger)" : ""], ["Heute", todayList.length, ""], ["In Arbeit", doing.length, ""], ["Wartet / zur Freigabe", waiting.length + approvals.length, ""]];
  const allClear = !urgent.length && !newRequests.length && !teamInbox.length && !todayList.length && !doing.length && !next.length && !waiting.length && !approvals.length;
  return head + tabs + `<div class="grid g4" style="margin-bottom:6px">${tiles.map(([l, v, c]) => `<div class="card stat"><div class="v" style="${c ? `color:${c}` : ""}">${v}</div><div class="l">${l}</div></div>`).join("")}</div>
    ${allClear ? `<div class="empty" style="margin-top:16px">Alles erledigt – keine offenen Vorgänge für Sie. 🎉</div>` : ""}
    ${section("Sofort erledigen", urgent, "", reasonUrgent, "danger")}
    ${section("Neue Kundenanfragen – bitte übernehmen", newRequests, "", (i) => `<span class="chip gray">${ago(i.createdAt)}</span>`, "danger")}
    ${section("Team-Eingang – noch nicht verteilt", teamInbox, "", (i) => teamBadge(team(i.teamId)))}
    ${section("Heute", todayList, "Heute stehen keine Termine oder Fristen an.")}
    ${section("Zur Freigabe durch Sie", approvals, "", (i) => `<span class="chip gray">von ${esc(uname(i.assigneeId))}</span>`)}
    ${section("In Arbeit", doing, "")}
    ${section("Als Nächstes", next.slice(0, 15), "")}
    ${section("Wartet auf andere", waiting, "", (i) => i.status === "REVIEW" ? `<span class="chip gray">Freigabe: ${esc(uname(i.reporterId))}</span>` : "")}`;
}

/* ---------- Ansicht: Listenzeile ---------- */
function issueRow(i, extra = "") {
  return `<tr class="click" data-act="open" data-id="${i.id}"><td style="width:28px">${typeIcon(i.type)}</td><td class="key" style="width:80px">${keyOf(i)}</td>
    <td><div class="trunc" style="max-width:520px">${esc(i.summary)}</div></td><td>${lozenge(i)}</td><td style="width:28px">${prioIcon(i.priority)}</td><td style="width:100px">${dueChip(i) || '<span class="muted small">–</span>'}</td>${extra}</tr>`;
}
/* ---------- Ansicht: Integrationen (Administration) ---------- */
async function loadIntegrations() {
  try { ui.integ = await api("/api/admin/integrations"); } catch (e) { ui.integ = { error: e.message }; }
  if (route().parts[0] === "integrations") render();
}
const dot = (state, label) => `<span class="idot ${state}">${label}</span>`;
const fmtTs = (v) => (v ? new Date(typeof v === "number" ? v : v).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "–");
function viewIntegrations() {
  if (me().role !== "ADMIN") return `<div class="empty">Integrationen verwalten nur Administratoren.</div>`;
  const I = ui.integ; if (!I) { loadIntegrations(); return `<div class="page-head"><h1>Integrationen</h1></div><p class="muted">Lade …</p>`; }
  if (I.error) return `<div class="page-head"><h1>Integrationen</h1></div><div class="note err">${esc(I.error)}</div>`;
  if (I.standalone) return `<div class="page-head"><h1>Integrationen</h1></div><div class="card pad"><p style="margin-top:0"><b>Diese Einzeldatei-Version läuft ohne Server.</b> Anbindungen an Microsoft 365, Factorial, die REST-API und Webhooks brauchen die Server-Version (siehe ARCHITEKTUR.md, Kapitel „Integration“).</p>
    <p>Verfügbar sind hier: <a href="#/import">Daten importieren</a> (Excel/CSV), <a href="#" data-act="export-customers">Kundenstamm als Excel</a>, Excel-Auswertungen und die Sicherung unter Einstellungen.</p></div>`;
  const M = I.m365, F = I.factorial;
  const tiles = [
    ["Microsoft 365 – E-Mail", I.mail.configured ? dot("on", "aktiv") : dot("off", "nicht eingerichtet"), I.mail.sender || "Benachrichtigungen per Mail"],
    ["Postfach → Vorgänge", M.appConfigured && M.inbox && M.mailIn ? dot("on", "aktiv") : M.inbox && !M.appConfigured ? dot("warn", "Microsoft-Anbindung fehlt") : M.inbox ? dot("warn", "ausgeschaltet") : dot("off", "nicht eingerichtet"), M.inbox || "kein Postfach"],
    ["Outlook-Kalender", M.appConfigured && M.calendar ? dot("on", "aktiv") : M.calendar ? dot("warn", "Microsoft-Anbindung fehlt") : dot("off", "aus"), "Einsätze im Kalender"],
    ["Anmeldung mit Microsoft", M.sso ? dot("on", "aktiv") : dot("off", "aus"), "Single Sign-on"],
    ["Factorial (HR)", F.configured ? dot("on", "verbunden") : dot("off", "nicht eingerichtet"), F.lastSync ? `Abgleich ${fmtTs(F.lastSync)}` : "Mitarbeiter & Abwesenheiten"],
    ["REST-API", I.apiKeys.some((k) => !k.revoked) ? dot("on", `${I.apiKeys.filter((k) => !k.revoked).length} Schlüssel`) : dot("off", "kein Schlüssel"), "für ERP, Buchhaltung, Power Automate"],
    ["Webhooks / Teams", I.webhooks.some((h) => h.active) ? dot("on", `${I.webhooks.filter((h) => h.active).length} aktiv`) : dot("off", "keine"), "Ereignisse an andere Systeme"],
  ];
  const evs = Object.entries(I.events);
  return `<div class="page-head"><div><h1>Integrationen &amp; Schnittstellen</h1><p class="muted" style="margin:4px 0 0">Verbindungen zu Microsoft 365, Factorial und Ihren weiteren Programmen – einrichten, testen, überwachen.</p></div><button class="btn" data-act="integ-reload">${icon("clock")} Aktualisieren</button></div>
    <div class="itiles">${tiles.map(([t, s, d]) => `<div class="card itile"><div class="b">${t}</div>${s}<div class="small muted trunc">${esc(d)}</div></div>`).join("")}</div>

    <div class="card pad isec"><h3 class="h3">Microsoft 365</h3>
      ${M.appConfigured ? `<p class="small" style="margin:0 0 10px">${dot("on", "App-Registrierung verbunden")} ${I.mail.sender ? `· Absender <b>${esc(I.mail.sender)}</b>` : "· kein Absender (MAIL_SENDER) – es werden keine Mails versendet"}</p>`
        : `<div class="note warn" style="margin-bottom:10px">Noch nicht verbunden. Die App-Registrierung wird einmalig in Entra ID angelegt und in der Server-Konfiguration hinterlegt (<code>MS_TENANT_ID</code>, <code>MS_CLIENT_ID</code>, <code>MS_CLIENT_SECRET</code>, <code>MAIL_SENDER</code>) – Anleitung unten.</div>`}
      <form id="integ-m365" class="grid g2" style="gap:12px">
        <label class="f">Service-Postfach (E-Mail → Vorgang)<input type="email" name="mailInbox" value="${esc(M.inbox || "")}" placeholder="service@druckluft-chemnitz.de"></label>
        <label class="f">Termindauer im Kalender (Minuten)<input type="number" name="calendarMinutes" value="${M.calendarMinutes}" min="15" max="600" step="15"></label>
        <label class="row nowrap small"><input type="checkbox" name="mailInEnabled" ${M.mailIn ? "checked" : ""}> E-Mails an das Postfach automatisch als Vorgang anlegen (alle 2 Minuten)</label>
        <label class="row nowrap small"><input type="checkbox" name="calendarSync" ${M.calendar ? "checked" : ""}> Eingeplante Einsätze im Outlook-Kalender der Techniker eintragen</label>
        <label class="row nowrap small"><input type="checkbox" name="calendarPull" ${M.calendarPull ? "checked" : ""}> Im Outlook-Kalender verschobene Termine zurück in den Tracker übernehmen (Kunde wird informiert)</label>
        <label class="row nowrap small"><input type="checkbox" name="calendarInviteCustomer" ${M.calendarInvite ? "checked" : ""}> Kunden als Teilnehmer einladen (Outlook-Einladung vom Techniker-Kalender)</label>
        <label class="row nowrap small"><input type="checkbox" name="ssoMicrosoft" ${M.sso ? "checked" : ""} ${M.ssoEnv ? "disabled" : ""}> „Mit Microsoft anmelden“ auf der Anmeldeseite anbieten${M.ssoEnv ? " (per Konfiguration aktiv)" : ""}</label>
        <div class="row" style="grid-column:1/-1"><button class="btn primary" type="submit">Speichern</button><button type="button" class="btn" data-act="integ-poll" ${M.appConfigured && M.inbox ? "" : `disabled title="${M.appConfigured ? "Erst ein Postfach eintragen und speichern" : "Erst Microsoft 365 einrichten (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET)"}"`}>Postfach jetzt abrufen</button><button type="button" class="btn" data-act="mail-test" ${I.mail.configured ? "" : "disabled"}>Test-E-Mail an mich</button><span class="small muted">Letzter Abruf: ${fmtTs(M.lastPoll)}</span></div>
      </form>
      <details class="ihelp"><summary>Einrichtung in Microsoft Entra ID (einmalig, ca. 15 Minuten)</summary><ol>
        <li>entra.microsoft.com → <b>App-Registrierungen</b> → „Neue Registrierung“, Name „GF Tracker“, Konten <i>nur in diesem Organisationsverzeichnis</i>.</li>
        <li>Unter <b>Authentifizierung</b> Plattform „Web“ hinzufügen, Umleitungs-URI: <code class="copy" data-act="copy" data-v="${esc(M.redirectUri)}">${esc(M.redirectUri)}</code></li>
        <li><b>Zertifikate &amp; Geheimnisse</b> → neuer geheimer Clientschlüssel → Wert als <code>MS_CLIENT_SECRET</code> eintragen; Anwendungs-ID → <code>MS_CLIENT_ID</code>, Verzeichnis-ID → <code>MS_TENANT_ID</code>.</li>
        <li><b>API-Berechtigungen</b> → Microsoft Graph → <i>Anwendungsberechtigungen</i>: <code>Mail.Send</code>, <code>Mail.ReadWrite</code> (Postfach), <code>Calendars.ReadWrite</code> (Kalender); <i>Delegiert</i>: <code>openid</code>, <code>email</code>, <code>profile</code> → „Administratorzustimmung erteilen“.</li>
        <li>Empfohlen: Zugriff per <b>Application Access Policy</b> (Exchange Online PowerShell) auf das Service-Postfach und die Postfächer der Techniker beschränken.</li>
        <li>Server neu starten. Mitarbeiter melden sich dann mit ihrem Microsoft-Konto an (die E-Mail muss im GF Tracker als Person angelegt sein).</li></ol></details>
    </div>

    <div class="card pad isec"><h3 class="h3">Microsoft Teams – Tracker als App in Teams</h3>
      <p class="small" style="margin:0 0 8px">Der Tracker erscheint in Teams als eigene App in der linken Leiste (<b>Mein Tag</b>, <b>Suche</b>, <b>Dashboard</b>) und lässt sich als <b>Reiter in jedem Kanal oder Chat</b> anheften – z. B. die Service-Warteschlange im Kanal „Service“ oder das Projekt-Board im Projektkanal. Anmeldung einmalig mit dem bestehenden Zugang bzw. „Mit Microsoft anmelden“.</p>
      <div class="row"><a class="btn sm primary" href="${authUrl("/api/admin/teams/package")}" download>${icon("download")} Teams-App herunterladen (ZIP)</a><span class="small muted">Name, Farbe und Symbol kommen aus dem <a href="#/settings">Erscheinungsbild</a>.</span></div>
      <form id="integ-teams" class="grid" style="gap:6px;margin-top:12px"><label class="row nowrap small"><input type="checkbox" name="teamsNotify" ${M.teamsNotify ? "checked" : ""} ${M.appConfigured ? "" : "disabled"}> <span><b>Benachrichtigungen im Teams-Aktivitätsfeed</b> (🔔): zugewiesen, erwähnt, fällig, SLA, neue Kundenanfragen – ein Klick öffnet den Vorgang direkt in Teams</span></label>
        <div class="small muted">${M.appConfigured ? (M.teamsNotify ? `Aktiv · in den letzten 7 Tagen ${I.teams.sent7d} zugestellt${I.teams.failed7d ? `, ${I.teams.failed7d} nicht zustellbar (siehe Protokoll)` : ""}` : "Aus") + (I.teams.packaged ? "" : " · Zuerst die Teams-App herunterladen und in Teams hochladen.") : "Setzt die Microsoft-365-Anbindung voraus (siehe oben)."}</div>
        <div><button class="btn sm" type="submit" ${M.appConfigured ? "" : "disabled"}>Speichern</button></div></form>
      <details class="ihelp"><summary>So kommt die App in Teams</summary><ol>
        <li><b>Für alle (empfohlen):</b> Teams Admin Center → <i>Teams-Apps → Apps verwalten</i> → „Hochladen“ → ZIP wählen. Optional unter <i>Setuprichtlinien</i> an die linke Leiste anheften – dann haben alle den Tracker automatisch.</li>
        <li><b>Nur zum Ausprobieren:</b> In Teams → <i>Apps → Apps verwalten → App hochladen → Benutzerdefinierte App hochladen</i> (falls von der IT erlaubt).</li>
        <li><b>Im Kanal:</b> Im Kanal auf „+“ (Registerkarte hinzufügen) → App wählen → Ansicht auswählen (z. B. „SD – Warteschlange“).</li>
        <li>Benachrichtigungen in einen Teams-Kanal (neue Störung, eskaliert, erledigt …) richten Sie unten unter <i>Webhooks</i> mit dem Format „Microsoft Teams“ ein.</li>
        <li>Nach Änderungen am Erscheinungsbild die App neu herunterladen und in Teams aktualisieren.</li>
        <li><b>Für Benachrichtigungen im Aktivitätsfeed:</b> in der App-Registrierung (Entra ID) die Anwendungsberechtigung <code>TeamsActivity.Send</code> hinzufügen und Administratorzustimmung erteilen; danach die Teams-App <i>neu herunterladen und hochladen</i> (sie enthält dann die Verknüpfung zur App-Registrierung) und für alle bereitstellen bzw. anheften. Personen, bei denen die App nicht installiert ist, erhalten weiter E-Mail und App-Benachrichtigung.</li>
        ${I.appUrl.startsWith("https://") ? "" : "<li><b>Wichtig:</b> Teams verlangt eine HTTPS-Adresse (APP_URL mit https://).</li>"}</ol></details></div>
    <div class="card pad isec"><h3 class="h3">Outlook-Add-in</h3>
      <p class="small" style="margin:0 0 8px">In jeder E-Mail: Kunde zum Absender, offene Vorgänge, „Als Vorgang anlegen“ (inkl. Anhänge), „An Vorgang anhängen“. Funktioniert im klassischen und neuen Outlook für Windows, Outlook für Mac und Outlook im Web.</p>
      <div class="row"><code class="copy" data-act="copy" data-v="${esc(I.appUrl)}/outlook/manifest.xml">${esc(I.appUrl)}/outlook/manifest.xml</code><a class="btn sm" href="/outlook/manifest.xml">Manifest herunterladen</a></div>
      <p class="small muted" style="margin:8px 0 0">Verteilung an alle: Microsoft 365 Admin Center → Einstellungen → Integrierte Apps → „Benutzerdefinierte Apps hochladen“ → Office-Add-in → Manifest-URL. Jede Person verbindet das Add-in danach einmalig unter Einstellungen → Outlook-Add-in.${I.appUrl.startsWith("https://") ? "" : " <b>Outlook verlangt eine HTTPS-Adresse.</b>"}</p></div>

    <div class="card pad isec"><h3 class="h3">Factorial (Personal, Urlaub, Krankheit)</h3>
      ${F.configured ? `<div class="row" style="gap:16px;margin-bottom:8px"><span>${dot("on", "verbunden")} API-Version ${esc(F.version)}</span><span class="small muted">Letzter Abgleich: ${fmtTs(F.lastSync)}</span></div>
        ${F.lastResult ? `<p class="small" style="margin:0 0 8px">${F.lastResult.employees} Mitarbeiter · ${F.lastResult.created} neu angelegt · ${F.lastResult.absences} Abwesenheiten${F.lastResult.unmatched?.length ? ` · <span style="color:var(--warn)">nicht zugeordnet (ohne E-Mail): ${esc(F.lastResult.unmatched.join(", "))}</span>` : ""}</p>` : ""}
        <div class="row"><button class="btn primary" data-act="factorial-sync">Jetzt abgleichen</button><label class="row nowrap small"><input type="checkbox" data-act="factorial-create" ${F.createUsers ? "checked" : ""}> Fehlende Mitarbeiter automatisch als Person anlegen</label></div>`
        : `<p class="small" style="margin:0">Nicht verbunden. In Factorial unter <b>Einstellungen → Entwickler → API-Schlüssel</b> einen Firmenschlüssel erzeugen und als <code>FACTORIAL_API_KEY</code> in der Server-Konfiguration hinterlegen. Danach werden Mitarbeiter (über die E-Mail) und Abwesenheiten stündlich übernommen.</p>`}
    </div>

    <div class="card pad isec"><div class="row" style="margin-bottom:8px"><h3 class="h3" style="flex:1;margin:0">REST-API für Ihre Programme</h3><a class="btn sm" href="/api/v1/openapi.json" target="_blank" rel="noopener">API-Beschreibung (OpenAPI)</a></div>
      <p class="small muted" style="margin:0 0 10px">Warenwirtschaft, Buchhaltung, Power Automate oder eigene Skripte lesen und schreiben Vorgänge und Kunden über <code>${esc(I.appUrl)}/api/v1</code>. Jedes Programm bekommt einen eigenen Schlüssel – einzeln widerrufbar.</p>
      ${I.apiKeys.length ? `<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Schlüssel</th><th>Recht</th><th class="hide-m">Erstellt</th><th>Zuletzt genutzt</th><th></th></tr></thead><tbody>
        ${I.apiKeys.map((k) => `<tr style="${k.revoked ? "opacity:.5" : ""}"><td class="b">${esc(k.name)}</td><td><code>${esc(k.prefix)}…</code></td><td>${k.scope === "write" ? "lesen + schreiben" : "nur lesen"}</td><td class="small hide-m">${fmtTs(k.created_at)}${k.createdBy ? ` · ${esc(k.createdBy)}` : ""}</td><td class="small">${k.revoked ? "widerrufen" : fmtTs(k.last_used_at)}</td>
          <td>${k.revoked ? "" : `<button class="btn subtle sm" data-act="apikey-revoke" data-id="${k.id}">Widerrufen</button>`}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <form id="apikey-form" class="row" style="margin-top:10px"><input type="text" name="name" placeholder="Name, z. B. Warenwirtschaft" required maxlength="80" style="width:auto;flex:1;min-width:200px"><select name="scope" style="width:auto"><option value="read">nur lesen</option><option value="write">lesen + schreiben</option></select><button class="btn primary" type="submit">${icon("plus")} Schlüssel erstellen</button></form>
    </div>

    <div class="card pad isec"><h3 class="h3">Webhooks – Ereignisse an andere Systeme &amp; Microsoft Teams</h3>
      <p class="small muted" style="margin:0 0 10px">Bei jedem Ereignis sendet der GF Tracker eine Nachricht an die Adresse – signiert (Header <code>X-GFT-Signature</code>) und mit automatischer Wiederholung. Für einen <b>Teams-Kanal</b>: im Kanal „…“ → <i>Workflows</i> → „Bei Empfang einer Webhookanforderung in einem Kanal posten“ → URL hier mit Format „Microsoft Teams“ eintragen.</p>
      ${I.webhooks.map((h) => `<div class="hook ${h.active ? "" : "off"}"><div class="row nowrap"><b class="trunc">${esc(h.name)}</b><span class="chip ${h.format === "teams" ? "blue" : "gray"}">${h.format === "teams" ? "Teams" : "JSON"}</span><span class="sp"></span>
          <label class="row nowrap small"><input type="checkbox" data-act="hook-active" data-id="${h.id}" ${h.active ? "checked" : ""}> aktiv</label><button class="btn subtle sm" data-act="hook-test" data-id="${h.id}">Testen</button><button class="btn subtle sm" data-act="hook-delete" data-id="${h.id}" title="Löschen">${icon("trash")}</button></div>
        <div class="small muted trunc">${esc(h.url)}</div><div class="row" style="gap:4px;margin-top:4px">${h.events.map((e) => `<span class="chip gray">${esc(I.events[e] || e)}</span>`).join("")}</div>
        ${h.stats ? `<div class="small" style="margin-top:4px">${h.stats.delivered || 0} zugestellt · ${h.stats.pending || 0} ausstehend${h.stats.failed ? ` · <span style="color:var(--danger)">${h.stats.failed} fehlgeschlagen</span>` : ""}${h.stats.last_error ? ` · <span class="muted">letzter Fehler: ${esc(h.stats.last_error)}</span>` : ""}</div>` : ""}</div>`).join("")}
      <form id="hook-form" class="grid g2" style="gap:10px;margin-top:10px">
        <label class="f">Name<input type="text" name="name" placeholder="z. B. Teams Service-Kanal" required maxlength="80"></label><label class="f">Format<select name="format"><option value="json">JSON (Programme, Power Automate)</option><option value="teams">Microsoft Teams (Karte)</option></select></label>
        <label class="f" style="grid-column:1/-1">Adresse (URL)<input type="url" name="url" placeholder="https://…" required></label>
        <div class="f" style="grid-column:1/-1"><span class="small b" style="color:var(--fg-2)">Ereignisse</span><div class="row" style="gap:12px">${evs.map(([k, l]) => `<label class="row nowrap small"><input type="checkbox" name="events" value="${k}" ${["issue.created", "issue.resolved"].includes(k) ? "checked" : ""}> ${esc(l)}</label>`).join("")}</div></div>
        <div><button class="btn primary" type="submit">${icon("plus")} Webhook anlegen</button></div></form>
    </div>

    <div class="card pad isec"><h3 class="h3">Daten übernehmen &amp; abgleichen</h3>
      <div class="row"><button class="btn" data-act="goto" data-href="#/import">${icon("upload")} Import-Assistent (Excel/CSV)</button><button class="btn" data-act="export-customers">${icon("download")} Kundenstamm als Excel</button><button class="btn" data-act="export-all-xlsx">${icon("download")} Excel-Auswertung</button><button class="btn" data-act="export-json">${icon("download")} Vollständige Sicherung (JSON)</button></div>
      <p class="small muted" style="margin:8px 0 0">Für den laufenden Abgleich mit der Warenwirtschaft empfiehlt sich die REST-API (Kunden per <code>PUT /api/v1/customers/{Kundennummer}</code>, Vorgänge per <code>POST /api/v1/issues</code> mit <code>externalId</code>) – oder regelmäßige Excel-Exporte über den Import-Assistenten.</p></div>

    <div class="card pad isec"><h3 class="h3">Protokoll</h3>
      ${I.log.length ? `<div class="tbl-wrap" style="max-height:360px;overflow:auto"><table class="ilog"><tbody>${I.log.map((l) => `<tr><td class="small nowrap">${fmtTs(l.at)}</td><td><span class="chip ${l.level === "error" ? "red" : l.level === "warn" ? "yellow" : "gray"}">${esc(l.source)}</span></td><td class="small">${esc(l.message)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="small muted" style="margin:0">Noch keine Einträge.</p>'}</div>`;
}
function inviteModal(u, r) {
  const until = fmtDay(dayKey(new Date(r.expiresAt)));
  secretModal(`Zugang für ${u.name}`, r.mailed ? `Die E-Mail mit dem Link wurde an <b>${esc(u.email)}</b> geschickt. Falls sie nicht ankommt, können Sie den Link auch selbst weitergeben (gültig bis ${until}, nur einmal verwendbar):`
    : `${r.mailError ? `<span class="note err" style="display:block;margin-bottom:8px">E-Mail konnte nicht gesendet werden: ${esc(r.mailError)}</span>` : ""}Geben Sie diesen Link an ${esc(u.name)} weiter (z. B. per Teams-Chat). Er ist bis ${until} gültig und nur einmal verwendbar – damit legt die Person ihr Passwort selbst fest.`, r.link);
}
function secretModal(title, intro, secret, extra = "") {
  openModal(`<div class="modal-h"><h2>${esc(title)}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <div class="modal-b"><p style="margin:0">${intro}</p><div class="secret"><code id="secret-val">${esc(secret)}</code><button class="btn sm" data-act="copy" data-v="${esc(secret)}">Kopieren</button></div>
      <div class="note warn">Dieser Wert wird nur jetzt angezeigt. Bitte sicher speichern (z. B. im Passwort-Manager oder direkt im Zielprogramm).</div>${extra}</div>
    <div class="modal-f"><button class="btn primary" data-act="close">Fertig</button></div>`);
}

/* ---------- Import-Assistent ---------- */
const IMPORT_TYPES = {
  customers: { label: "Kunden", desc: "Kundenstamm aus Warenwirtschaft / ERP – optional mit erstem Ansprechpartner", sheet: ["kunden", "customers", "debitoren"], fields: [
    { k: "no", label: "Kundennummer", syn: ["kundennummer", "kundennr", "kdnr", "kdnummer", "debitor", "debitorennummer", "debitornr", "nummer", "nr", "customerno", "customernumber", "kundenid"] },
    { k: "name", label: "Firma", req: true, syn: ["firma", "name", "kunde", "firmenname", "name1", "kundenname", "company", "unternehmen", "bezeichnung"] },
    { k: "street", label: "Straße", syn: ["strasse", "str", "adresse", "anschrift", "street", "strassehausnr", "strasseundhausnummer", "strassenr"] },
    { k: "zip", label: "PLZ", syn: ["plz", "postleitzahl", "zip"] }, { k: "city", label: "Ort", syn: ["ort", "stadt", "city", "wohnort"] },
    { k: "phone", label: "Telefon", syn: ["telefon", "tel", "telefonnummer", "phone", "telefonzentrale"] }, { k: "email", label: "E-Mail", syn: ["email", "mail", "emailadresse"] },
    { k: "externalId", label: "ERP-/Fremd-ID", syn: ["erpid", "fremdid", "externalid", "id", "externeid"] }, { k: "notes", label: "Notizen", syn: ["notizen", "bemerkung", "bemerkungen", "notiz", "info", "hinweis"] },
    { k: "contactName", label: "Ansprechpartner", syn: ["ansprechpartner", "kontakt", "kontaktperson", "ansprechpartnername"] },
    { k: "contactEmail", label: "E-Mail Ansprechpartner", syn: ["emailansprechpartner", "ansprechpartneremail", "kontaktemail"] },
    { k: "contactPhone", label: "Telefon Ansprechpartner", syn: ["telefonansprechpartner", "ansprechpartnertelefon", "kontakttelefon", "mobil", "handy"] }] },
  contacts: { label: "Ansprechpartner", desc: "Weitere Kontakte je Kunde (Zuordnung über Kundennummer oder Firma)", sheet: ["ansprechpartner", "kontakte", "contacts"], fields: [
    { k: "customerNo", label: "Kundennummer", syn: ["kundennummer", "kundennr", "kdnr", "debitor", "debitorennummer"] }, { k: "customerName", label: "Firma", syn: ["firma", "kunde", "firmenname", "kundenname", "company"] },
    { k: "name", label: "Name", req: true, syn: ["name", "ansprechpartner", "kontakt", "vollername", "nachname"] }, { k: "role", label: "Funktion", syn: ["funktion", "position", "abteilung", "rolle"] },
    { k: "email", label: "E-Mail", syn: ["email", "mail", "emailadresse"] }, { k: "phone", label: "Telefon", syn: ["telefon", "tel", "mobil", "handy", "phone"] }] },
  assets: { label: "Anlagen", desc: "Kompressoren, Trockner, Behälter … mit Seriennummer und Wartungsintervall", sheet: ["anlagen", "geraete", "maschinen", "assets"], fields: [
    { k: "customerNo", label: "Kundennummer", syn: ["kundennummer", "kundennr", "kdnr", "debitor"] }, { k: "customerName", label: "Firma", syn: ["firma", "kunde", "kundenname"] },
    { k: "name", label: "Bezeichnung", req: true, syn: ["bezeichnung", "anlage", "maschine", "geraet", "name", "anlagenbezeichnung"] },
    { k: "manufacturer", label: "Hersteller", syn: ["hersteller", "marke", "fabrikat"] }, { k: "model", label: "Modell", syn: ["modell", "typ", "type", "baureihe"] },
    { k: "serial", label: "Seriennummer", syn: ["seriennummer", "seriennr", "sn", "fabriknummer", "serial", "serialnumber"] }, { k: "year", label: "Baujahr", syn: ["baujahr", "jahr"] },
    { k: "location", label: "Standort", syn: ["standort", "aufstellort", "ort", "halle"] }, { k: "intervalMonths", label: "Wartungsintervall (Monate)", syn: ["intervallmonate", "intervall", "wartungsintervall", "wartungsintervallmonate"] },
    { k: "lastMaintenance", label: "Letzte Wartung", syn: ["letztewartung", "wartungam", "letzterservice"] }, { k: "nextMaintenance", label: "Nächste Wartung", syn: ["naechstewartung", "faellig", "naechsterservice", "wartungfaellig"] },
    { k: "active", label: "In Betrieb", syn: ["inbetrieb", "aktiv", "status"] }] },
  users: { label: "Mitarbeiter", desc: "Personen mit Rolle und Team (Anmeldung danach per Passwort oder Microsoft-Konto)", admin: true, sheet: ["mitarbeiter", "personen", "benutzer", "users"], fields: [
    { k: "name", label: "Name", req: true, syn: ["name", "vollername", "mitarbeiter", "fullname"] }, { k: "email", label: "E-Mail", req: true, syn: ["email", "mail", "emailadresse", "loginemail"] },
    { k: "role", label: "Rolle", syn: ["rolle", "role", "berechtigung"] }, { k: "team", label: "Team", syn: ["team", "abteilung", "bereich"] }] },
  issues: { label: "Aufgaben & Vorgänge", desc: "Offene Aufgaben, Tickets oder Projektlisten (z. B. aus Excel, Planner, altem System)", sheet: ["vorgaenge", "aufgaben", "tickets", "tasks"], fields: [
    { k: "summary", label: "Zusammenfassung", req: true, syn: ["zusammenfassung", "titel", "betreff", "aufgabe", "thema", "summary", "title", "aufgabenname"] },
    { k: "description", label: "Beschreibung", syn: ["beschreibung", "details", "text", "description", "notizen"] },
    { k: "project", label: "Projekt", syn: ["projekt", "projektschluessel", "project", "bereich"] }, { k: "type", label: "Typ", syn: ["typ", "art", "vorgangstyp", "type"] },
    { k: "status", label: "Status", syn: ["status", "zustand", "fortschritt"] }, { k: "priority", label: "Priorität", syn: ["prioritaet", "prio", "dringlichkeit", "priority", "wichtigkeit"] },
    { k: "assignee", label: "Verantwortlich", syn: ["verantwortlich", "zustaendig", "bearbeiter", "mitarbeiter", "zugewiesenan", "assignee", "zugewiesen"] }, { k: "team", label: "Team", syn: ["team"] },
    { k: "dueDate", label: "Fällig", syn: ["faellig", "frist", "deadline", "faelligkeitsdatum", "faelligam", "termin", "enddatum", "due"] },
    { k: "labels", label: "Labels", syn: ["labels", "schlagworte", "kategorie", "tags"] }, { k: "customerNo", label: "Kundennummer", syn: ["kundennummer", "kundennr", "kdnr", "debitor"] },
    { k: "externalId", label: "Fremd-ID / Schlüssel", syn: ["externeid", "fremdid", "ticketnr", "ticketnummer", "schluessel", "id", "nummer", "vorgangsnummer"] }] },
};
const PRIO_WORDS = { HIGHEST: ["höchste", "hoechste", "kritisch", "sehr hoch", "sofort", "highest", "critical", "1"], HIGH: ["hoch", "dringend", "high", "wichtig", "2"], MEDIUM: ["mittel", "normal", "medium", "3"], LOW: ["niedrig", "gering", "low", "4"], LOWEST: ["niedrigste", "sehr niedrig", "lowest", "5"] };
const findCust = (no, name) => { const n = String(no || "").trim(), nm = String(name || "").trim().toLowerCase();
  return (n && (db.customers.find((c) => c.no === n) || db.customers.find((c) => c.externalId === n))) || (nm && db.customers.find((c) => c.name.toLowerCase() === nm)) || null; };
const findUser = (v) => { const s = String(v || "").trim().toLowerCase(); if (!s) return null;
  return db.users.find((u) => u.email.toLowerCase() === s) || db.users.find((u) => u.name.toLowerCase() === s) || db.users.find((u) => u.name.toLowerCase().split(" ")[0] === s) || db.users.find((u) => u.name.toLowerCase().split(" ").at(-1) === s) || null; };

function autoMap(type, header) {
  const used = new Set(); const map = {};
  for (const f of IMPORT_TYPES[type].fields) {
    const n = header.map((h) => TableReader.norm(h));
    let idx = n.findIndex((h, i) => !used.has(i) && (h === TableReader.norm(f.label) || f.syn.includes(h)));
    if (idx < 0) idx = n.findIndex((h, i) => !used.has(i) && h && f.syn.some((s) => s.length > 3 && h.startsWith(s)));
    map[f.k] = idx; if (idx >= 0) used.add(idx);
  }
  return map;
}
/** Zeilen → geplante Aktionen (neu / aktualisieren / Fehler) – noch ohne zu speichern. */
function planImport(imp) {
  const T = IMPORT_TYPES[imp.type]; const out = []; const val = (row, k) => (imp.map[k] >= 0 ? String(row[imp.map[k]] ?? "").trim() : "");
  const seen = new Map();
  imp.rows.forEach((row, n) => {
    const r = Object.fromEntries(T.fields.map((f) => [f.k, val(row, f.k)])); const line = n + imp.headerRow + 2;
    const missing = T.fields.filter((f) => f.req && !r[f.k]).map((f) => f.label);
    if (missing.length) return out.push({ line, action: "error", label: r.name || r.summary || "–", msg: `fehlt: ${missing.join(", ")}` });
    if (imp.type === "customers") {
      const key = r.no || r.externalId || r.name.toLowerCase(); if (seen.has(key)) return out.push({ line, action: "error", label: r.name, msg: `doppelt in der Datei (Zeile ${seen.get(key)})` }); seen.set(key, line);
      const ex = (r.no && db.customers.find((c) => c.no === r.no)) || (r.externalId && db.customers.find((c) => c.externalId === r.externalId)) || (!r.no && !r.externalId && db.customers.find((c) => c.name.toLowerCase() === r.name.toLowerCase()));
      if (ex && !imp.update) return out.push({ line, action: "skip", label: r.name, msg: "existiert bereits" });
      out.push({ line, action: ex ? "update" : "new", label: r.name, msg: ex ? `Kunde ${ex.no || ex.name} wird aktualisiert` : r.no ? `Kundennr. ${r.no}` : "", r, ex });
    } else if (imp.type === "contacts" || imp.type === "assets") {
      const c = findCust(r.customerNo, r.customerName); if (!c) return out.push({ line, action: "error", label: r.name, msg: `Kunde nicht gefunden (${r.customerNo || r.customerName || "keine Angabe"}) – zuerst Kunden importieren` });
      const list = imp.type === "contacts" ? c.contacts || [] : c.assets || [];
      const ex = imp.type === "contacts" ? list.find((k) => (r.email && (k.email || "").toLowerCase() === r.email.toLowerCase()) || k.name.toLowerCase() === r.name.toLowerCase())
        : list.find((a) => (r.serial && a.serial === r.serial) || (!r.serial && a.name.toLowerCase() === r.name.toLowerCase()));
      if (ex && !imp.update) return out.push({ line, action: "skip", label: r.name, msg: "existiert bereits" });
      if (imp.type === "assets" && (r.lastMaintenance && !TableReader.toDate(r.lastMaintenance) || r.nextMaintenance && !TableReader.toDate(r.nextMaintenance))) return out.push({ line, action: "error", label: r.name, msg: "Datum nicht lesbar (z. B. 15.03.2026)" });
      out.push({ line, action: ex ? "update" : "new", label: r.name, msg: c.name, r, c, ex });
    } else if (imp.type === "users") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) return out.push({ line, action: "error", label: r.name, msg: "E-Mail ungültig" });
      const ex = db.users.find((u) => u.email.toLowerCase() === r.email.toLowerCase());
      if (ex && !imp.update) return out.push({ line, action: "skip", label: r.name, msg: "existiert bereits" });
      out.push({ line, action: ex ? "update" : "new", label: r.name, msg: [r.email, r.team && !db.teams.some((t) => t.name.toLowerCase() === r.team.toLowerCase()) ? `Team „${r.team}“ unbekannt` : r.team].filter(Boolean).join(" · "), r, ex });
    } else if (imp.type === "issues") {
      const p = (r.project && (projByKey(r.project.toUpperCase()) || db.projects.find((x) => x.name.toLowerCase() === r.project.toLowerCase()))) || proj(imp.projectId);
      if (!p) return out.push({ line, action: "error", label: r.summary, msg: `Projekt „${r.project}“ unbekannt` });
      const ex = r.externalId && db.issues.find((i) => i.externalId === r.externalId);
      if (ex && !imp.update) return out.push({ line, action: "skip", label: r.summary, msg: `bereits importiert (${keyOf(ex)})` });
      if (r.dueDate && !TableReader.toDate(r.dueDate)) return out.push({ line, action: "error", label: r.summary, msg: `Fälligkeit „${r.dueDate}“ nicht lesbar` });
      const warn = [r.assignee && !findUser(r.assignee) ? `Person „${r.assignee}“ unbekannt` : "", r.customerNo && !findCust(r.customerNo) ? `Kunde ${r.customerNo} unbekannt` : ""].filter(Boolean);
      out.push({ line, action: ex ? "update" : "new", label: r.summary, msg: [p.key, ...warn].join(" · "), r, p, ex, warn: warn.length > 0 });
    }
  });
  return out;
}
async function runImport(imp, plan) {
  const todo = plan.filter((x) => x.action === "new" || x.action === "update"); const now = new Date().toISOString(); const D = TableReader.toDate, N = TableReader.toNumber;
  if (imp.type === "customers") for (const x of todo) {
    const r = x.r; const data = Object.fromEntries(["no", "name", "street", "zip", "city", "phone", "email", "externalId", "notes"].filter((k) => r[k] !== "").map((k) => [k, r[k]]));
    let c = x.ex; if (c) Object.assign(c, data, { updatedAt: now }); else { c = { id: uid(), no: "", street: "", zip: "", city: "", phone: "", email: "", externalId: "", notes: "", ...data, contacts: [], assets: [], createdAt: now, updatedAt: now }; db.customers.push(c); }
    if (r.contactName) { const k = c.contacts.find((y) => y.name.toLowerCase() === r.contactName.toLowerCase()); const kd = { name: r.contactName, email: r.contactEmail || (k ? k.email : ""), phone: r.contactPhone || (k ? k.phone : ""), role: k?.role || "Hauptansprechpartner" };
      if (k) Object.assign(k, kd); else c.contacts.push({ id: uid(), ...kd }); }
  }
  if (imp.type === "contacts") for (const x of todo) { const r = x.r; const data = Object.fromEntries(["name", "role", "email", "phone"].filter((k) => r[k] !== "").map((k) => [k, r[k]]));
    if (x.ex) Object.assign(x.ex, data); else x.c.contacts.push({ id: uid(), role: "", email: "", phone: "", ...data }); x.c.updatedAt = now; }
  if (imp.type === "assets") for (const x of todo) { const r = x.r;
    const data = { name: r.name, ...(r.manufacturer ? { manufacturer: r.manufacturer } : {}), ...(r.model ? { model: r.model } : {}), ...(r.serial ? { serial: r.serial } : {}), ...(r.year ? { year: N(r.year) } : {}), ...(r.location ? { location: r.location } : {}),
      ...(r.intervalMonths ? { intervalMonths: N(r.intervalMonths) } : {}), ...(r.lastMaintenance ? { lastMaintenance: D(r.lastMaintenance) } : {}), ...(r.nextMaintenance ? { nextMaintenance: D(r.nextMaintenance) } : {}), ...(r.active ? { active: TableReader.toBool(r.active) } : {}) };
    if (x.ex) Object.assign(x.ex, data); else x.c.assets.push({ id: uid(), manufacturer: "", model: "", serial: "", year: null, location: "", intervalMonths: null, lastMaintenance: null, nextMaintenance: null, active: true, ...data }); x.c.updatedAt = now; }
  if (imp.type === "users") {
    const roleOf = (v) => { const s = String(v || "").toLowerCase(); return Object.entries(ROLES).find(([k, l]) => k.toLowerCase() === s || l.toLowerCase() === s)?.[0] || (/admin/.test(s) ? "ADMIN" : /service|techn|monteur/.test(s) ? "AGENT" : "MEMBER"); };
    const res = await api("/api/admin/users/import", { method: "POST", body: { users: todo.map((x) => ({ name: x.r.name, email: x.r.email, role: x.r.role ? roleOf(x.r.role) : x.ex?.role || "MEMBER" })) } });
    await reloadState();
    for (const x of todo) { const t = x.r.team && db.teams.find((y) => y.name.toLowerCase() === x.r.team.toLowerCase()); const u = db.users.find((y) => y.email.toLowerCase() === x.r.email.toLowerCase());
      if (t && u && !t.memberIds.includes(u.id)) t.memberIds.push(u.id); }
    save(); return res;
  }
  if (imp.type === "issues") {
    const creates = todo.filter((x) => !x.ex); const byProj = new Map(); creates.forEach((x) => byProj.set(x.p.id, (byProj.get(x.p.id) || 0) + 1));
    const nextNo = {}; for (const [pid, n] of byProj) nextNo[pid] = (await api(`/api/projects/${pid}/reserve?count=${n}`, { method: "POST" })).no;
    const assigned = new Map();
    for (const x of todo) {
      const r = x.r; const p = x.p; const wf = workflowOf(p); const types = PROJECT_TYPES[p.type].types.filter((t) => t !== "SUBTASK" && t !== "EPIC");
      const type = types.find((t) => t === r.type.toUpperCase() || TYPES[t].label.toLowerCase() === r.type.toLowerCase()) || types[0];
      const st = r.status && (wf.find((s) => s.id === r.status.toUpperCase() || s.name.toLowerCase() === r.status.toLowerCase()) || ({ erledigt: wf.find((s) => s.cat === "done"), fertig: wf.find((s) => s.cat === "done"), done: wf.find((s) => s.cat === "done"), offen: wf[0], neu: wf[0], "in arbeit": wf.find((s) => s.cat === "progress") })[r.status.toLowerCase()]);
      const prio = Object.entries(PRIO_WORDS).find(([, w]) => w.includes(r.priority.toLowerCase()))?.[0] || (PRIOS[r.priority.toUpperCase()] ? r.priority.toUpperCase() : null);
      const u = findUser(r.assignee); const t = r.team && db.teams.find((y) => y.name.toLowerCase() === r.team.toLowerCase()); const c = findCust(r.customerNo);
      const labels = r.labels ? r.labels.split(/[,;]/).map((l) => l.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean) : [];
      if (x.ex) {
        const ch = { summary: r.summary, ...(r.description ? { description: r.description } : {}), ...(st ? { status: st.id } : {}), ...(prio ? { priority: prio } : {}), ...(u ? { assigneeId: u.id } : {}), ...(r.dueDate ? { dueDate: D(r.dueDate) } : {}), ...(t ? { teamId: t.id } : {}) };
        updateIssue(x.ex, ch); continue;
      }
      const i = newIssue({ project: p, no: nextNo[p.id]++, type, summary: r.summary, description: r.description, priority: prio || "MEDIUM", assigneeId: u?.id || null, reporterId: db.currentUserId, labels: [...new Set([...labels, "import"])],
        dueDate: D(r.dueDate), teamId: t ? t.id : undefined, customerId: c?.id || null, customer: c ? customerSnapshot(c) : null, externalId: r.externalId || null, rank: Date.now() + i_rank++ });
      if (st && st.id !== i.status) { const from = i.status; i.status = st.id; applyTransition(i, p, from, st.id); }
      i.history.unshift({ id: uid(), at: now, userId: db.currentUserId, field: "Import", from: "", to: imp.fileName || "Datei" });
      db.issues.push(i); if (u && u.id !== db.currentUserId) assigned.set(u.id, (assigned.get(u.id) || 0) + 1);
    }
    for (const [userId, n] of assigned) notify([userId], "assign", `${n} Vorgänge per Import zugewiesen`, `${me().name} hat Vorgänge aus „${imp.fileName}“ importiert.`, null);
  }
  save(); await flush(); return null;
}
let i_rank = 0;
function viewImport() {
  const imp = ui.imp || (ui.imp = { step: 1, update: true }); const admin = me().role === "ADMIN";
  const types = Object.entries(IMPORT_TYPES).filter(([, t]) => !t.admin || admin);
  const stepHead = (n, title, done) => `<div class="imp-h ${imp.step === n ? "on" : ""} ${done ? "done" : ""}"><span class="imp-n">${done ? "✓" : n}</span>${title}</div>`;
  let body = "";
  body += `<div class="card pad imp-step">${stepHead(1, "Was möchten Sie einspielen?", imp.step > 1)}
    <div class="grid g3" style="margin-top:10px">${types.map(([k, t]) => `<button type="button" class="card imp-type ${imp.type === k ? "on" : ""}" data-act="imp-type" data-v="${k}"><b>${t.label}</b><span class="small muted">${t.desc}</span></button>`).join("")}</div>
    ${imp.type ? `<p class="small muted" style="margin:10px 0 0">Tipp: Exportieren Sie die Daten aus Ihrem bisherigen Programm als Excel oder CSV – die Spalten werden automatisch erkannt. Oder nutzen Sie die <a href="#" data-act="imp-template">Excel-Vorlage für ${IMPORT_TYPES[imp.type].label}</a>. Reihenfolge: zuerst Kunden, dann Ansprechpartner und Anlagen.</p>` : ""}</div>`;
  if (imp.type) body += `<div class="card pad imp-step">${stepHead(2, "Datei auswählen", !!imp.rows)}
    <label class="dropzone" id="imp-drop"><input type="file" id="imp-file" accept=".xlsx,.csv,.txt,text/csv" hidden>${icon("upload")}<span>${imp.fileName ? `<b>${esc(imp.fileName)}</b> · ${imp.rows ? `${imp.rows.length} Zeilen` : "wird gelesen …"}` : "Excel- (.xlsx) oder CSV-Datei hierher ziehen oder <u>auswählen</u>"}</span></label>
    ${imp.sheets?.length > 1 ? `<label class="f" style="max-width:320px;margin-top:10px">Tabellenblatt<select id="imp-sheet">${imp.sheets.map((s, n) => `<option value="${n}" ${n === imp.sheetIdx ? "selected" : ""}>${esc(s.name)} (${s.rows.length} Zeilen)</option>`).join("")}</select></label>` : ""}</div>`;
  if (imp.rows) {
    const T = IMPORT_TYPES[imp.type]; const sample = (k) => (imp.map[k] >= 0 ? imp.rows.slice(0, 3).map((r) => r[imp.map[k]]).filter(Boolean).join(" · ") : "");
    body += `<div class="card pad imp-step">${stepHead(3, "Spalten zuordnen", !!imp.plan)}
      <p class="small muted" style="margin:6px 0 10px">Automatisch erkannt – bitte prüfen. Felder mit * sind Pflicht.</p>
      <div class="tbl-wrap"><table class="imp-map"><thead><tr><th>Feld im GF Tracker</th><th>Spalte in Ihrer Datei</th><th class="hide-m">Beispielwerte</th></tr></thead><tbody>
      ${T.fields.map((f) => `<tr><td>${esc(f.label)}${f.req ? ' <span class="req">*</span>' : ""}</td><td><select data-act="imp-map" data-k="${f.k}"><option value="-1">– nicht übernehmen –</option>${imp.header.map((h, n) => `<option value="${n}" ${imp.map[f.k] === n ? "selected" : ""}>${esc(h || `Spalte ${n + 1}`)}</option>`).join("")}</select></td><td class="small muted hide-m trunc" style="max-width:360px">${esc(sample(f.k))}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="row" style="margin-top:10px;gap:16px">${imp.type === "issues" ? `<label class="f" style="width:auto">Projekt, wenn keine Spalte „Projekt“<select id="imp-project">${db.projects.map((p) => `<option value="${p.id}" ${p.id === imp.projectId ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
        <label class="row nowrap small"><input type="checkbox" id="imp-update" ${imp.update ? "checked" : ""}> Vorhandene Einträge aktualisieren (statt überspringen)</label>
        <span class="sp"></span><button class="btn primary" data-act="imp-check">Prüfen</button></div></div>`;
  }
  if (imp.plan) {
    const cnt = (a) => imp.plan.filter((x) => x.action === a).length; const errs = cnt("error");
    const badge = { new: '<span class="chip green">neu</span>', update: '<span class="chip blue">aktualisieren</span>', skip: '<span class="chip gray">überspringen</span>', error: '<span class="chip red">Fehler</span>' };
    body += `<div class="card pad imp-step">${stepHead(4, "Vorschau & Import", !!imp.result)}
      <div class="row" style="margin:8px 0 10px;gap:8px">${badge.new} ${cnt("new")} ${badge.update} ${cnt("update")} ${badge.skip} ${cnt("skip")} ${badge.error} ${errs}</div>
      <div class="tbl-wrap" style="max-height:420px;overflow:auto"><table><thead><tr><th>Zeile</th><th>Aktion</th><th>Eintrag</th><th>Hinweis</th></tr></thead><tbody>
      ${imp.plan.slice(0, 500).map((x) => `<tr><td class="small muted">${x.line}</td><td>${badge[x.action]}</td><td class="trunc" style="max-width:320px">${esc(x.label)}</td><td class="small ${x.action === "error" || x.warn ? "" : "muted"}" style="${x.action === "error" ? "color:var(--danger)" : x.warn ? "color:var(--warn)" : ""}">${esc(x.msg || "")}</td></tr>`).join("")}
      </tbody></table></div>${imp.plan.length > 500 ? `<p class="small muted">… und ${imp.plan.length - 500} weitere Zeilen</p>` : ""}
      ${imp.result ? `<div class="note info" style="margin-top:12px">${esc(imp.result)}</div>` : `<div class="row" style="margin-top:12px">${errs ? `<span class="small muted">Zeilen mit Fehler werden ausgelassen.</span>` : ""}<span class="sp"></span><button class="btn subtle" data-act="imp-reset">Abbrechen</button><button class="btn primary" data-act="imp-run" ${cnt("new") + cnt("update") ? "" : "disabled"}>${cnt("new") + cnt("update")} Einträge importieren</button></div>`}</div>`;
  }
  return `<div class="page-head"><div><h1>Daten importieren</h1><p class="muted" style="margin:4px 0 0">Bestehende Daten aus Excel, CSV oder Ihrem bisherigen Programm übernehmen – auch wiederholt zum Abgleichen.</p></div>${imp.type ? `<button class="btn subtle" data-act="imp-reset">Neu beginnen</button>` : ""}</div>${body}`;
}
function importTemplate(type) {
  const T = IMPORT_TYPES[type];
  const ex = { customers: ["10100", "Beispiel GmbH", "Hauptstraße 1", "09111", "Chemnitz", "0371 123456", "info@beispiel.de", "D-4711", "Zufahrt über Tor 2", "Max Mustermann", "m.mustermann@beispiel.de", "0171 1234567"],
    contacts: ["10100", "Beispiel GmbH", "Erika Muster", "Instandhaltung", "e.muster@beispiel.de", "0371 123457"],
    assets: ["10100", "Beispiel GmbH", "Schraubenkompressor", "Atlas Copco", "GA 30", "AII123456", "2018", "Halle 1", "12", "15.03.2026", "", "ja"],
    users: ["Max Mustermann", "max.mustermann@druckluft-chemnitz.de", "Service-Mitarbeiter", "Service & Technik"],
    issues: ["Angebot für Kältetrockner erstellen", "Kunde wünscht Angebot bis Monatsende", "GF", "Aufgabe", "Zu erledigen", "Hoch", "lisa.schmidt@druckluft-chemnitz.de", "Büro & Vertrieb", "30.11.2026", "angebot", "10100", "ALT-0815"] }[type];
  download(`vorlage-${T.label.toLowerCase().replace(/[^a-z]+/g, "-")}.xlsx`, XLSX.build([{ name: T.label, columns: T.fields.map((f) => ({ h: f.label, w: Math.max(12, f.label.length + 4) })), rows: [ex] }], { title: `Importvorlage ${T.label}` }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
async function importFile(file) {
  const imp = ui.imp; imp.fileName = file.name; imp.rows = null; imp.plan = null; imp.result = null; render();
  try {
    imp.sheets = await TableReader.readTable(file);
    const want = IMPORT_TYPES[imp.type].sheet; imp.sheetIdx = Math.max(0, imp.sheets.findIndex((s) => want.includes(TableReader.norm(s.name))));
    importSheet(imp.sheetIdx);
  } catch (e) { imp.fileName = null; toast(e.message); render(); }
}
function importSheet(n) {
  const imp = ui.imp; const rows = imp.sheets[n]?.rows || []; imp.sheetIdx = n; imp.plan = null; imp.result = null;
  // Kopfzeile = erste Zeile mit mindestens zwei Texten (Titelzeilen darüber werden übersprungen)
  const hr = Math.max(0, rows.findIndex((r) => r.filter((c) => c && isNaN(Number(c))).length >= 2));
  imp.headerRow = hr; imp.header = rows[hr] || []; imp.rows = rows.slice(hr + 1); imp.map = autoMap(imp.type, imp.header);
  if (!imp.projectId) imp.projectId = db.projects[0]?.id;
  if (!imp.rows.length) toast("In diesem Tabellenblatt wurden keine Datenzeilen gefunden.");
  render();
}

/* ---------- Anhänge ---------- */
const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const isImg = (a) => /^image\/(png|jpeg|gif|webp)$/.test(a.type);
function attTile(i, a) {
  const src = `/api/files/${a.id}`; const u = (q = "") => authUrl(src + q);
  const L = !!window.GFTLocal; const href = (q = "") => (L ? `href="#" data-gft-href="${src}"` : `href="${u(q)}"`); const img = L ? `data-gft-src="${src}"` : `src="${u("?inline=1")}"`; // Einzeldatei: Dateien liegen im Browser
  const canDel = a.userId === db.currentUserId || me().role === "ADMIN";
  return `<div class="att">${isImg(a) ? `<a ${href("?inline=1")} target="_blank" rel="noopener" class="att-thumb"><img ${img} alt="${esc(a.name)}" loading="lazy"></a>` : `<a ${href(a.type === "application/pdf" ? "?inline=1" : "")} target="_blank" rel="noopener" class="att-thumb att-ic">${esc((a.name.split(".").pop() || "DATEI").slice(0, 4).toUpperCase())}</a>`}
    <div class="att-meta"><a ${href()} class="trunc b" title="${esc(a.name)}" download="${esc(a.name)}">${esc(a.name)}</a><div class="small muted trunc">${fmtSize(a.size)} · ${a.source === "email" ? "aus E-Mail" : a.source === "portal" ? "vom Kunden" : esc(uname(a.userId))} · ${fmtDT(a.at)}</div></div>
    ${canDel && a.source === "upload" ? `<button class="btn subtle sm icon" data-act="att-delete" data-id="${i.id}" data-k="${a.id}" title="Entfernen" aria-label="Entfernen">${icon("trash")}</button>` : ""}</div>`;
}
/** Eingefügte Bilder (Strg+V) haben keinen sinnvollen Namen – „Bildschirmfoto 2026-10-22 14-05.png“. */
const namePasted = (f, k = 0) => (/^image\.(png|jpe?g|gif|webp)$/i.test(f.name) || !f.name ? new File([f], `Bildschirmfoto ${new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "-")}${k ? ` (${k + 1})` : ""}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: f.type }) : f);
async function uploadFiles(issueId, files) {
  const ids = [];
  for (const f of files) {
    try {
      const res = await fetch(`/api/issues/${issueId}/attachments`, { method: "POST", credentials: "same-origin", headers: { ...authHeaders(), "Content-Type": f.type || "application/octet-stream", "X-Filename": encodeURIComponent(f.name), "X-GFT": "1" }, body: f });
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`); ids.push(data.id);
    } catch (e) { toast(`${f.name}: ${e.message}`); }
  }
  if (!ids.length) return;
  // Warten, bis die neuen Anhänge im lokalen Stand angekommen sind (ein gleichzeitiger Abgleich kann den eigenen kurz überholen)
  for (let k = 0; k < 40; k++) { await pull(); const i = issue(issueId); if (i && ids.every((id) => (i.attachments || []).some((a) => a.id === id))) break; await new Promise((r) => setTimeout(r, 75)); }
  toast(`${ids.length} Datei${ids.length > 1 ? "en" : ""} hinzugefügt`); if (ui.openIssue === issueId && ui.modal === "issue") renderIssue();
}

/* ---------- Ansicht: Kunden & Anlagen ---------- */
const customer = (id) => (id ? db.customers.find((c) => c.id === id) || null : null);
const assetOf = (c, id) => (c && id ? (c.assets || []).find((a) => a.id === id) || null : null);
const custIssues = (c) => db.issues.filter((i) => i.customerId === c.id);
const custOpts = (sel, none = "– kein Kunde –") => `<option value="">${none}</option>` + [...db.customers].sort((a, b) => a.name.localeCompare(b.name, "de")).map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.name)}${c.no ? ` (${esc(c.no)})` : ""}</option>`).join("");
const maintChip = (a) => { const d = nextMaintenance(a); if (!d || a.active === false) return '<span class="muted small">–</span>'; const n = daysBetween(today(), d);
  return `<span class="chip ${n < 0 ? "red" : n <= 30 ? "yellow" : "gray"}" title="${n < 0 ? `seit ${-n} Tagen überfällig` : `in ${n} Tagen`}">${fmtDay(d)}</span>`; };
const nextCustMaint = (c) => (c.assets || []).filter((a) => a.active !== false).map(nextMaintenance).filter(Boolean).sort()[0] || null;
function viewCustomers() {
  const q = (ui.custQ || "").toLowerCase().trim();
  const list = [...db.customers].filter((c) => !q || `${c.no} ${c.name} ${c.city} ${(c.contacts || []).map((k) => `${k.name} ${k.email}`).join(" ")} ${(c.assets || []).map((a) => `${a.name} ${a.serial} ${a.model}`).join(" ")}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const openBy = new Map(); for (const i of db.issues) if (i.customerId && !isDone(i)) openBy.set(i.customerId, (openBy.get(i.customerId) || 0) + 1);
  const dueSoon = db.customers.flatMap((c) => (c.assets || []).filter((a) => a.active !== false && nextMaintenance(a) && daysBetween(today(), nextMaintenance(a)) <= 30).map((a) => ({ c, a }))).sort((x, y) => nextMaintenance(x.a).localeCompare(nextMaintenance(y.a)));
  return `<div class="page-head"><div><h1>Kunden &amp; Anlagen</h1><p class="muted" style="margin:4px 0 0">${db.customers.length} Kunden · ${db.customers.reduce((s, c) => s + (c.assets || []).length, 0)} Anlagen · ${dueSoon.length} Wartungen in den nächsten 30 Tagen</p></div>
      <div class="row"><button class="btn" data-act="goto" data-href="#/import">${icon("upload")} Importieren</button><button class="btn" data-act="export-customers">${icon("download")} Excel</button><button class="btn primary" data-act="customer-new">${icon("plus")} Kunde anlegen</button></div></div>
    <div class="row" style="margin-bottom:12px"><div class="search" style="width:min(420px,100%)">${icon("search")}<input type="search" id="cust-q" value="${esc(ui.custQ || "")}" placeholder="Suchen: Name, Kundennr., Ort, Ansprechpartner, Seriennummer" aria-label="Kunden suchen"></div></div>
    ${list.length ? `<div class="card tbl-wrap"><table><thead><tr><th>Nr.</th><th>Kunde</th><th class="hide-m">Ort</th><th class="hide-m">Ansprechpartner</th><th>Anlagen</th><th>Offen</th><th>Nächste Wartung</th></tr></thead><tbody>
      ${list.slice(0, ui.rowLimit).map((c) => { const open = openBy.get(c.id) || 0; const nm = nextCustMaint(c); const k = (c.contacts || [])[0];
        return `<tr class="click" data-act="goto" data-href="#/customers/${c.id}"><td class="key">${esc(c.no || "–")}</td><td><div class="b">${esc(c.name)}</div>${c.externalId ? `<div class="small muted">ERP: ${esc(c.externalId)}</div>` : ""}</td><td class="hide-m">${esc([c.zip, c.city].filter(Boolean).join(" "))}</td>
          <td class="hide-m">${k ? `${esc(k.name)}<div class="small muted">${esc(k.email || k.phone || "")}</div>` : '<span class="muted">–</span>'}</td><td>${(c.assets || []).length}</td><td>${open ? `<span class="chip blue">${open}</span>` : '<span class="muted">0</span>'}</td>
          <td>${nm ? maintChip({ nextMaintenance: nm }) : '<span class="muted small">–</span>'}</td></tr>`; }).join("")}</tbody></table>${moreRows(list.length)}</div>`
      : `<div class="empty">${q ? "Keine Kunden gefunden." : 'Noch keine Kunden. Legen Sie Kunden an oder übernehmen Sie Ihren Kundenstamm per <a href="#/import">Import</a> (CSV oder Excel aus Ihrer Warenwirtschaft).'}</div>`}`;
}
function viewCustomer(c) {
  if (c && !ui.archiveLoaded) ensureArchive(); // vollständige Servicehistorie
  if (!c) return `<div class="empty">Kunde nicht gefunden. <a href="#/customers">Zur Kundenliste</a></div>`;
  const iss = custIssues(c).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const open = iss.filter((i) => !isDone(i)); const done = iss.filter(isDone);
  const reports = iss.filter((i) => i.resolution).sort((a, b) => String(b.resolution.at).localeCompare(String(a.resolution.at)));
  const hours = reports.reduce((s, i) => s + (Number(i.resolution.hours) || 0), 0); const admin = me().role === "ADMIN";
  const addr = customerAddress(c);
  return `<div class="page-head"><div><div class="crumbs"><a href="#/customers">Kunden</a></div><h1>${esc(c.name)}</h1>
      <p class="muted small" style="margin:4px 0 0">${c.no ? `Kundennr. ${esc(c.no)} · ` : ""}${esc(addr || "keine Adresse")}${c.externalId ? ` · ERP-ID ${esc(c.externalId)}` : ""}</p></div>
    <div class="row"><button class="btn primary" data-act="customer-issue" data-id="${c.id}">${icon("plus")} Vorgang für Kunden</button><button class="btn" data-act="customer-edit" data-id="${c.id}">${icon("gear")} Stammdaten</button>${admin ? `<button class="btn subtle" data-act="customer-delete" data-id="${c.id}" title="Kunde löschen">${icon("trash")}</button>` : ""}</div></div>
    <div class="grid g4" style="margin-bottom:14px">${[["Offene Vorgänge", open.length], ["Anlagen", (c.assets || []).length], ["Serviceberichte", reports.length], ["Einsatzstunden", String(Math.round(hours * 10) / 10).replace(".", ",")]].map(([l, v]) => `<div class="card stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join("")}</div>
    <div class="cust-grid">
      <div class="grid" style="gap:14px;align-content:start">
        <div class="card pad"><h3 class="h3">Kontakt</h3>
          <div class="kv">${[["Adresse", addr], ["Telefon", c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a>` : ""], ["E-Mail", c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""]].map(([k, v]) => `<span>${k}</span><span>${v ? (k === "Adresse" ? esc(v) : v) : '<span class="muted">–</span>'}</span>`).join("")}</div>
          ${c.notes ? `<div class="note info" style="margin-top:10px;white-space:pre-wrap">${esc(c.notes)}</div>` : ""}</div>
        <div class="card pad"><div class="row" style="margin-bottom:8px"><h3 class="h3" style="flex:1;margin:0">Ansprechpartner</h3><button class="btn sm" data-act="contact-new" data-id="${c.id}">${icon("plus")} Hinzufügen</button></div>
          ${(c.contacts || []).map((k) => `<div class="row nowrap" style="padding:8px 0;border-bottom:1px solid var(--border)">${custAvatar({ name: k.name, email: k.email })}<div style="flex:1;min-width:0"><div class="b trunc">${esc(k.name)}${k.role ? ` <span class="small muted">· ${esc(k.role)}</span>` : ""}</div>
            <div class="small muted trunc">${[k.email ? `<a href="mailto:${esc(k.email)}">${esc(k.email)}</a>` : "", k.phone ? `<a href="tel:${esc(k.phone.replace(/\s/g, ""))}">${esc(k.phone)}</a>` : ""].filter(Boolean).join(" · ") || "–"}</div></div>
            <button class="btn subtle sm" data-act="contact-edit" data-id="${c.id}" data-k="${k.id}">Bearbeiten</button></div>`).join("") || '<p class="small muted" style="margin:0">Noch keine Ansprechpartner.</p>'}</div>
      </div>
      <div class="grid" style="gap:14px;align-content:start;min-width:0">
        <div class="card pad"><div class="row" style="margin-bottom:8px"><h3 class="h3" style="flex:1;margin:0">Anlagen &amp; Wartungsplan</h3><button class="btn sm" data-act="asset-new" data-id="${c.id}">${icon("plus")} Anlage</button></div>
          ${(c.assets || []).length ? `<div class="tbl-wrap"><table><thead><tr><th>Anlage</th><th class="hide-m">Seriennr.</th><th class="hide-m">Standort</th><th>Intervall</th><th>Letzte</th><th>Nächste Wartung</th><th></th></tr></thead><tbody>
            ${(c.assets || []).map((a) => { const openA = iss.filter((i) => i.assetId === a.id && !isDone(i));
              return `<tr style="${a.active === false ? "opacity:.5" : ""}"><td><div class="b">${esc(a.name)}</div><div class="small muted">${esc([a.manufacturer, a.model, a.year].filter(Boolean).join(" · "))}</div></td><td class="hide-m">${esc(a.serial || "–")}</td><td class="hide-m">${esc(a.location || "–")}</td>
                <td>${a.intervalMonths ? `${a.intervalMonths} Mon.` : "–"}</td><td class="small">${a.lastMaintenance ? fmtDay(a.lastMaintenance) : "–"}</td><td>${maintChip(a)}${openA.length ? `<div><a href="#" class="small" data-act="open" data-id="${openA[0].id}">${keyOf(openA[0])} offen</a></div>` : ""}</td>
                <td class="nowrap"><button class="btn subtle sm" data-act="asset-edit" data-id="${c.id}" data-k="${a.id}">Bearbeiten</button>${openA.some((i) => i.type === "MAINT") ? "" : `<button class="btn subtle sm" data-act="asset-maint" data-id="${c.id}" data-k="${a.id}" title="Wartungsvorgang jetzt anlegen">Wartung anlegen</button>`}</td></tr>`; }).join("")}
            </tbody></table></div>` : '<p class="small muted" style="margin:0">Noch keine Anlagen erfasst. Mit Intervall erfasst, legt das System Wartungen automatisch rechtzeitig an.</p>'}</div>
        <div class="card pad"><h3 class="h3">Vorgänge <span class="small muted" style="font-weight:400">${open.length} offen · ${done.length} erledigt</span></h3>
          ${iss.length ? `<div class="wlist">${[...open, ...done.slice(0, 15)].map((i) => workRow(i, i.assetId ? `<span class="chip gray">${esc(assetOf(c, i.assetId)?.name || "Anlage")}</span>` : "")).join("")}</div>` : '<p class="small muted" style="margin:0">Noch keine Vorgänge.</p>'}</div>
        <div class="card pad"><h3 class="h3">Servicehistorie</h3>
          ${reports.map((i) => `<div class="hist-item" data-act="open" data-id="${i.id}"><div class="row nowrap small"><b>${fmtDay(dayKey(i.resolution.at))}</b><span class="key">${keyOf(i)}</span><span class="trunc">${esc(i.summary)}</span><span class="sp"></span>${i.resolution.hours ? `<span class="chip gray">${String(i.resolution.hours).replace(".", ",")} h</span>` : ""}${avatar(i.resolution.by)}</div>
            <div class="small" style="margin-top:3px">${i.resolution.cause ? `<span class="muted">Ursache:</span> ${esc(i.resolution.cause)} · ` : ""}${esc(i.resolution.action)}${i.resolution.parts ? ` <span class="muted">· Material:</span> ${esc(i.resolution.parts)}` : ""}</div></div>`).join("") || '<p class="small muted" style="margin:0">Noch keine Serviceberichte.</p>'}</div>
      </div></div>`;
}
function customerForm(c) {
  const isNew = !c; c = c || { no: String(Math.max(10000, ...db.customers.map((x) => Number(x.no) || 0)) + 1), name: "", street: "", zip: "", city: "", phone: "", email: "", notes: "", externalId: "" };
  openModal(`<div class="modal-h"><h2>${isNew ? "Kunde anlegen" : "Stammdaten bearbeiten"}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="customer-form" data-id="${isNew ? "" : c.id}"><div class="modal-b">
      <div class="grid g2" style="gap:12px"><label class="f"><span>Firmenname <span class="req">*</span></span><input type="text" name="name" value="${esc(c.name)}" required maxlength="200" autofocus></label>
        <label class="f">Kundennummer<input type="text" name="no" value="${esc(c.no || "")}" maxlength="40"></label>
        <label class="f" style="grid-column:1/-1">Straße<input type="text" name="street" value="${esc(c.street || "")}" maxlength="200"></label>
        <label class="f">PLZ<input type="text" name="zip" value="${esc(c.zip || "")}" maxlength="10"></label><label class="f">Ort<input type="text" name="city" value="${esc(c.city || "")}" maxlength="100"></label>
        <label class="f">Telefon<input type="tel" name="phone" value="${esc(c.phone || "")}" maxlength="60"></label><label class="f">E-Mail (allgemein)<input type="email" name="email" value="${esc(c.email || "")}" maxlength="200"></label>
        <label class="f">ERP-/Fremd-ID<input type="text" name="externalId" value="${esc(c.externalId || "")}" maxlength="80" placeholder="Nummer im Warenwirtschaftssystem"></label></div>
      <label class="f">Notizen<textarea name="notes" rows="3" placeholder="z. B. Zufahrt, Ansprechzeiten, Besonderheiten">${esc(c.notes || "")}</textarea></label>
    </div><div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">${isNew ? "Kunde anlegen" : "Speichern"}</button></div></form>`);
}
function contactForm(c, k) {
  const isNew = !k; k = k || { name: "", role: "", email: "", phone: "" };
  openModal(`<div class="modal-h"><h2>${isNew ? "Ansprechpartner hinzufügen" : "Ansprechpartner bearbeiten"}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="contact-form" data-id="${c.id}" data-k="${isNew ? "" : k.id}"><div class="modal-b"><div class="grid g2" style="gap:12px">
      <label class="f"><span>Name <span class="req">*</span></span><input type="text" name="name" value="${esc(k.name)}" required maxlength="120" autofocus></label><label class="f">Funktion<input type="text" name="role" value="${esc(k.role || "")}" maxlength="80" placeholder="z. B. Instandhaltung"></label>
      <label class="f">E-Mail<input type="email" name="email" value="${esc(k.email || "")}" maxlength="200"></label><label class="f">Telefon<input type="tel" name="phone" value="${esc(k.phone || "")}" maxlength="60"></label></div>
      <p class="small muted" style="margin:0">Anfragen aus dem Portal oder per E-Mail von dieser Adresse werden automatisch diesem Kunden zugeordnet.</p></div>
    <div class="modal-f">${isNew ? "" : `<button type="button" class="btn danger" data-act="contact-delete" data-id="${c.id}" data-k="${k.id}" style="margin-right:auto">Entfernen</button>`}<button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div></form>`);
}
function assetForm(c, a) {
  const isNew = !a; a = a || { name: "", manufacturer: "", model: "", serial: "", year: "", location: "", intervalMonths: 12, lastMaintenance: "", nextMaintenance: "", active: true };
  openModal(`<div class="modal-h"><h2>${isNew ? "Anlage hinzufügen" : "Anlage bearbeiten"}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="asset-form" data-id="${c.id}" data-k="${isNew ? "" : a.id}"><div class="modal-b"><div class="grid g2" style="gap:12px">
      <label class="f" style="grid-column:1/-1"><span>Bezeichnung <span class="req">*</span></span><input type="text" name="name" value="${esc(a.name)}" required maxlength="120" autofocus placeholder="z. B. Schraubenkompressor GA 37"></label>
      <label class="f">Hersteller<input type="text" name="manufacturer" value="${esc(a.manufacturer || "")}" maxlength="80"></label><label class="f">Modell<input type="text" name="model" value="${esc(a.model || "")}" maxlength="80"></label>
      <label class="f">Seriennummer<input type="text" name="serial" value="${esc(a.serial || "")}" maxlength="80"></label><label class="f">Baujahr<input type="number" name="year" value="${esc(a.year || "")}" min="1950" max="2100"></label>
      <label class="f">Standort beim Kunden<input type="text" name="location" value="${esc(a.location || "")}" maxlength="120" placeholder="z. B. Halle 2"></label><label class="f">Wartungsintervall (Monate)<input type="number" name="intervalMonths" value="${esc(a.intervalMonths ?? "")}" min="0" max="120"></label>
      <label class="f">Letzte Wartung<input type="date" name="lastMaintenance" value="${esc(a.lastMaintenance || "")}"></label><label class="f">Nächste Wartung (leer = automatisch)<input type="date" name="nextMaintenance" value="${esc(a.nextMaintenance || "")}"></label></div>
      <label class="row nowrap small"><input type="checkbox" name="active" ${a.active !== false ? "checked" : ""}> Anlage in Betrieb (Wartungen planen)</label></div>
    <div class="modal-f">${isNew ? "" : `<button type="button" class="btn danger" data-act="asset-delete" data-id="${c.id}" data-k="${a.id}" style="margin-right:auto">Entfernen</button>`}<button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div></form>`);
}

/* ---------- Ansicht: Teams ---------- */
function teamStats(t) {
  const l = teamIssues(t).filter((i) => i.type !== "EPIC"); const open = l.filter((i) => !isDone(i)); const tk = today(); const wk = addDays(tk, -6);
  return { open, inbox: open.filter((i) => i.teamId === t.id && inTeamInbox(i)), overdue: open.filter(isOverdue), doneWeek: l.filter((i) => i.resolvedAt && dayKey(i.resolvedAt) >= wk) };
}
function viewTeams() {
  const mine = teamsOf(db.currentUserId); const sorted = [...mine, ...db.teams.filter((t) => !mine.includes(t))]; const admin = me().role === "ADMIN";
  return `<div class="page-head"><div><h1>Teams</h1><p class="muted" style="margin:4px 0 0">Wer gehört zusammen, wer macht gerade was – und was ist noch nicht verteilt.</p></div>${admin ? `<button class="btn primary" data-act="team-new">${icon("plus")} Team anlegen</button>` : ""}</div>
    ${sorted.length ? `<div class="grid g2">${sorted.map(teamCard).join("")}</div>` : `<div class="empty">Noch keine Teams. ${admin ? "Legen Sie Teams an und ordnen Sie Personen zu." : "Ein Administrator kann Teams anlegen."}</div>`}`;
}
function teamCard(t) {
  const s = teamStats(t); const mem = teamMembers(t); const load = (u) => s.open.filter((i) => i.assigneeId === u.id).length; const max = Math.max(1, ...mem.map(load));
  return `<a class="card pad tcard" href="#/teams/${t.id}" style="--tc:${t.color}">
    <div class="row nowrap"><span class="tavatar">${esc(teamInitials(t.name))}</span><div style="min-width:0;flex:1"><div class="b trunc">${esc(t.name)}${t.memberIds.includes(db.currentUserId) ? ' <span class="chip blue">Mein Team</span>' : ""}</div><div class="small muted trunc">${esc(t.desc || "")}</div></div></div>
    <div class="tstats"><div><b>${s.open.length}</b><span>offen</span></div><div class="${s.inbox.length ? "warn" : ""}"><b>${s.inbox.length}</b><span>nicht verteilt</span></div><div class="${s.overdue.length ? "bad" : ""}"><b>${s.overdue.length}</b><span>überfällig</span></div><div><b>${s.doneWeek.length}</b><span>erledigt (7 T)</span></div></div>
    <div class="tload">${mem.map((u) => `<div class="tl-row">${avatar(u.id)}<span class="trunc">${esc(u.name)}${u.id === t.leadId ? ' <span class="small muted">· Leitung</span>' : ""}</span><span class="bar"><i style="width:${(load(u) / max) * 100}%"></i></span><span class="small muted">${load(u)}</span></div>`).join("") || '<p class="small muted" style="margin:0">Noch keine Mitglieder.</p>'}</div></a>`;
}
function viewTeam(t) {
  if (!t) return `<div class="empty">Team nicht gefunden. <a href="#/teams">Zu den Teams</a></div>`;
  const s = teamStats(t); const mem = teamMembers(t); const tk = today(); const memIds = new Set(mem.map((u) => u.id));
  const openAll = db.issues.filter((i) => !isDone(i) && i.type !== "EPIC");
  const isToday = (i) => i.dueDate === tk || (i.appointmentAt && dayKey(i.appointmentAt) === tk && ACTIVE_APPT.includes(i.status));
  const urg = (i) => (isOverdue(i) ? 0 : isToday(i) ? 1 : statusOf(i).cat === "progress" ? 2 : 3);
  const sortW = (a, b) => urg(a) - urg(b) || (a.appointmentAt || a.dueDate || "9").localeCompare(b.appointmentAt || b.dueDate || "9") || PRIOS[b.priority].rank - PRIOS[a.priority].rank;
  const card = (i) => `<div class="titem ${isOverdue(i) ? "over" : ""}" draggable="true" data-drag-assign="${i.id}" data-act="open" data-id="${i.id}">
    <div class="row nowrap small">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><span class="sp"></span>${prioIcon(i.priority)}</div>
    <div class="t2">${esc(i.summary)}</div>
    <div class="row small" style="gap:4px;margin-top:4px">${lozenge(i)}${apptChip(i)}${dueChip(i)}${i.teamId && i.teamId !== t.id ? teamBadge(team(i.teamId)) : ""}</div></div>`;
  const cols = mem.map((u) => {
    const l = openAll.filter((i) => i.assigneeId === u.id).sort(sortW); const od = l.filter(isOverdue).length, td = l.filter(isToday).length;
    return `<div class="tcol" data-drop-assign="${u.id}"><div class="tcol-h">${avatar(u.id, true)}<div style="min-width:0"><div class="b trunc">${esc(u.name)}${u.id === t.leadId ? ' <span class="small muted">· Leitung</span>' : ""}</div>
      <div class="small muted">${l.length} offen${td ? ` · ${td} heute` : ""}${od ? ` · <span style="color:var(--danger)">${od} überfällig</span>` : ""}</div>
      ${(() => { const ab = absenceOn(u.id, tk) || db.absences.filter((a) => a.userId === u.id && a.start > tk && a.start <= addDays(tk, 7)).sort((a, b) => a.start.localeCompare(b.start))[0]; return ab ? `<div class="abs-chip ${ab.start <= tk ? "now" : ""}" title="${esc(absenceText(ab))}">${ab.start <= tk ? "heute abwesend" : "ab " + fmtShort(ab.start)}: ${esc(ab.type)}${ab.start <= tk ? ` bis ${fmtShort(ab.end)}` : ""}</div>` : ""; })()}</div></div>
      ${l.slice(0, 12).map(card).join("") || '<p class="small muted" style="margin:8px 4px">Nichts offen – hat Kapazität.</p>'}
      ${l.length > 12 ? `<a class="small" href="#/filters?jql=${encodeURIComponent(`assignee = "${u.name}" AND statusCategory != Done ORDER BY due ASC`)}">+ ${l.length - 12} weitere</a>` : ""}</div>`;
  }).join("");
  const rel = openAll.filter((i) => i.teamId === t.id || memIds.has(i.assigneeId));
  const agenda = Array.from({ length: 7 }, (_, k) => addDays(tk, k)).map((k) => {
    const l = rel.filter((i) => i.dueDate === k || (i.appointmentAt && dayKey(i.appointmentAt) === k && ACTIVE_APPT.includes(i.status))).sort((a, b) => (a.appointmentAt || "9").localeCompare(b.appointmentAt || "9"));
    const abs = mem.map((u) => [u, absenceOn(u.id, k)]).filter(([, a]) => a);
    return l.length || abs.length ? `<div class="ag-day"><div class="ag-h ${k === tk ? "today" : ""}">${k === tk ? "Heute" : parseDay(k).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit" })}</div>
      ${abs.map(([u, a]) => `<div class="ag-row abs"><span class="ag-t">—</span>${avatar(u.id)}<span class="trunc">${esc(u.name)} · ${esc(a.type)}</span></div>`).join("")}
      ${l.map((i) => `<div class="ag-row" data-act="open" data-id="${i.id}"><span class="ag-t">${i.appointmentAt && dayKey(i.appointmentAt) === k ? fmtTime(i.appointmentAt) : "Frist"}</span><span class="key">${keyOf(i)}</span><span class="trunc">${esc(i.summary)}</span><span class="sp"></span>${i.assigneeId ? avatar(i.assigneeId) : '<span class="chip yellow">offen</span>'}</div>`).join("")}</div>` : "";
  }).join("");
  const activity = teamIssues(t).flatMap((i) => i.history.slice(0, 5).map((h) => ({ ...h, i }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  const inbox = s.inbox.sort(sortW).map((i) => `<div class="wrow" data-act="open" data-id="${i.id}"><div class="wmain">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><span class="trunc b" style="font-weight:500">${esc(i.summary)}</span></div>
    <div class="wmeta">${dueChip(i)}<span class="chip gray">${ago(i.createdAt)}</span>${i.customer ? `<span class="chip gray">${esc(i.customer.company || i.customer.name)}</span>` : ""}${prioIcon(i.priority)}</div>
    <div class="wact"><select data-act="team-assign" data-id="${i.id}" aria-label="Zuweisen an" style="width:auto"><option value="">Zuweisen an …</option>${mem.map((u) => `<option value="${u.id}">${esc(u.name)} (${openAll.filter((x) => x.assigneeId === u.id).length} offen)</option>`).join("")}</select><button class="btn sm primary" data-act="take" data-id="${i.id}">Übernehmen</button></div></div>`).join("");
  const tiles = [["Offen", s.open.length, ""], ["Noch nicht verteilt", s.inbox.length, s.inbox.length ? "var(--warn)" : ""], ["Überfällig", s.overdue.length, s.overdue.length ? "var(--danger)" : ""], ["Erledigt (7 Tage)", s.doneWeek.length, "var(--ok)"]];
  return `<div class="page-head"><div><div class="crumbs"><a href="#/teams">Teams</a></div><h1 class="row nowrap"><span class="tavatar" style="--tc:${t.color}">${esc(teamInitials(t.name))}</span>${esc(t.name)}</h1>
      <p class="muted small" style="margin:4px 0 0">${esc(t.desc || "")}${t.leadId ? `${t.desc ? " · " : ""}Leitung: ${esc(uname(t.leadId))}` : ""} · ${mem.length} ${mem.length === 1 ? "Person" : "Personen"}</p></div>
    <div class="row"><button class="btn primary" data-act="create" data-team="${t.id}">${icon("plus")} Vorgang fürs Team</button><button class="btn" data-act="absence-new" data-id="${t.id}">${icon("clock")} Abwesenheit</button><button class="btn" data-act="export-team-xlsx" data-id="${t.id}">${icon("download")} Excel</button>${canManageTeam(t) ? `<button class="btn" data-act="team-edit" data-id="${t.id}">${icon("gear")} Team bearbeiten</button>` : ""}</div></div>
    <div class="grid g4" style="margin-bottom:6px">${tiles.map(([l, v, c]) => `<div class="card stat"><div class="v" style="${c ? `color:${c}` : ""}">${v}</div><div class="l">${l}</div></div>`).join("")}</div>
    <section class="wsec ${s.inbox.length ? "danger" : ""}"><h2>Team-Eingang – noch nicht verteilt <span class="count">${s.inbox.length}</span></h2>${inbox ? `<div class="card wlist">${inbox}</div>` : '<p class="small muted" style="margin:0 0 6px">Alles verteilt. ✓</p>'}</section>
    <section class="wsec"><h2>Wer macht was? <span class="small muted" style="font-weight:400">Karte auf eine andere Person ziehen, um neu zu verteilen</span></h2>
      ${mem.length ? `<div class="tcols" style="grid-template-columns:repeat(${mem.length}, minmax(230px, 1fr))">${cols}</div>` : '<p class="muted">Dem Team sind noch keine Personen zugeordnet.</p>'}</section>
    <div class="grid g2" style="align-items:start">
      <section class="wsec"><h2>Termine, Fristen &amp; Abwesenheiten – nächste 7 Tage</h2><div class="card pad">${agenda || '<p class="small muted" style="margin:0">Keine Termine oder Fristen in den nächsten 7 Tagen.</p>'}</div></section>
      <section class="wsec"><h2>Abwesenheiten (30 Tage)</h2><div class="card pad">${(() => { const list = db.absences.filter((a) => memIds.has(a.userId) && a.end >= tk && a.start <= addDays(tk, 30)).sort((a, b) => a.start.localeCompare(b.start));
        return list.map((a) => `<div class="row nowrap" style="padding:6px 0;border-bottom:1px solid var(--border)">${avatar(a.userId)}<span class="b trunc">${esc(uname(a.userId))}</span><span class="small muted trunc" style="flex:1">${esc(absenceText(a))}</span>${a.source === "factorial" ? '<span class="chip gray" title="Wird in Factorial gepflegt">Factorial</span>' : canEditAbsenceFor(a.userId) ? `<button class="btn subtle sm" data-act="absence-delete" data-id="${a.id}" title="Entfernen">${icon("trash")}</button>` : ""}</div>`).join("") || '<p class="small muted" style="margin:0">Keine Abwesenheiten eingetragen.</p>'; })()}</div></section>
      <section class="wsec"><h2>Zuletzt im Team</h2><div class="card pad">${activity.map((h) => `<div class="hist" data-act="open" data-id="${h.i.id}" style="cursor:pointer">${avatar(h.userId)} <b>${esc(h.userId ? uname(h.userId) : "Kunde")}</b> · <span class="key">${keyOf(h.i)}</span> ${h.to === "erstellt" ? "erstellt" : `${esc(h.field)} → „${esc(String(h.to).slice(0, 40))}“`} <span class="muted small">· ${ago(h.at)}</span></div>`).join("") || '<p class="small muted" style="margin:0">Noch keine Aktivität.</p>'}</div></section></div>`;
}
function absenceForm(t) {
  const people = (t ? teamMembers(t) : activeUsers()).filter((u) => canEditAbsenceFor(u.id));
  if (!people.length) return toast("Sie können nur Ihre eigenen Abwesenheiten eintragen.");
  openModal(`<div class="modal-h"><h2>Abwesenheit eintragen</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="absence-form"><div class="modal-b"><div class="grid g2" style="gap:12px">
      <label class="f" style="grid-column:1/-1">Person<select name="userId">${people.map((u) => `<option value="${u.id}" ${u.id === db.currentUserId ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
      <label class="f"><span>Von <span class="req">*</span></span><input type="date" name="start" value="${today()}" required></label><label class="f"><span>Bis <span class="req">*</span></span><input type="date" name="end" value="${today()}" required></label>
      <label class="f">Art<select name="type">${["Urlaub", "Krankheit", "Schulung", "Dienstreise", "Berufsschule", "Sonstiges"].map((x) => `<option>${x}</option>`).join("")}</select></label><label class="f">Notiz<input type="text" name="note" maxlength="120"></label></div>
      <p class="small muted" style="margin:0">Abwesenheiten erscheinen in der Einsatzplanung und auf der Teamseite. Mit Factorial-Anbindung werden Urlaube automatisch übernommen.</p></div>
    <div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Eintragen</button></div></form>`);
}
function teamForm(t) {
  const admin = me().role === "ADMIN"; const isNew = !t; const dis = admin ? "" : "disabled";
  t = t || { name: "", color: PALETTE[db.teams.length % PALETTE.length], leadId: db.currentUserId, memberIds: [db.currentUserId], desc: "" };
  openModal(`<div class="modal-h"><h2>${isNew ? "Team anlegen" : `Team „${esc(t.name)}“ bearbeiten`}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="team-form" data-id="${isNew ? "" : t.id}"><div class="modal-b">
      <div class="grid g2" style="gap:12px"><label class="f"><span>Name <span class="req">*</span></span><input type="text" name="name" value="${esc(t.name)}" required maxlength="80" ${dis} placeholder="z. B. Service &amp; Technik"></label>
        <label class="f">Farbe<select name="color" ${dis}>${PALETTE.map((c) => `<option value="${c}" ${c === t.color ? "selected" : ""} style="color:${c}">● ${c}</option>`).join("")}</select></label></div>
      <div class="grid g2" style="gap:12px"><label class="f">Teamleitung<select name="leadId" ${dis}>${userOpts(t.leadId, "–")}</select></label>
        <label class="f">Standort<select name="site" ${dis} title="Wo das Team in der Systemlandschaft erscheint">${SITES.map((x) => `<option value="${x.id}" ${(t.site || "hq") === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label></div>
      <label class="f">Aufgabe des Teams<input type="text" name="desc" value="${esc(t.desc || "")}" maxlength="200" placeholder="z. B. Störungen, Wartungen und Einsätze beim Kunden"></label>
      <div class="f"><span class="small b" style="color:var(--fg-2)">Mitglieder</span><div class="tmembers">${activeUsers().map((u) => `<label class="row nowrap small"><input type="checkbox" name="m" value="${u.id}" ${t.memberIds.includes(u.id) ? "checked" : ""}> ${avatar(u.id)} ${esc(u.name)} <span class="muted">· ${esc(ROLES[u.role] || u.role)}</span></label>`).join("")}</div></div>
      ${admin ? "" : '<p class="small muted" style="margin:0">Als Teamleitung können Sie Mitglieder und Aufgabe ändern; Name, Farbe und Leitung ändern Administratoren.</p>'}
    </div><div class="modal-f">${!isNew && admin ? `<button type="button" class="btn danger" data-act="team-delete" data-id="${t.id}" style="margin-right:auto">Team löschen</button>` : ""}<button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">${isNew ? "Team anlegen" : "Speichern"}</button></div></form>`);
}

/* ---------- Ansicht: Projekte ---------- */
function viewProjects() {
  return `<div class="page-head"><h1>Projekte</h1>${me().role === "ADMIN" ? `<button class="btn primary" data-act="new-project">${icon("plus")} Projekt erstellen</button>` : ""}</div>
    <div class="card tbl-wrap"><table><thead><tr><th>Name</th><th>Schlüssel</th><th>Typ</th><th>Leitung</th><th>Offen</th><th>Fortschritt</th></tr></thead><tbody>
    ${db.projects.map((p) => { const l = projIssues(p).filter((i) => i.type !== "EPIC"); const open = l.filter((i) => !isDone(i)).length; const pct = l.length ? Math.round((l.length - open) / l.length * 100) : 0;
      return `<tr class="click" data-act="goto" data-href="#/p/${p.key}"><td><div class="row nowrap"><span class="pavatar" style="background:${p.color}">${esc(p.key.slice(0, 3))}</span><div><div class="b">${esc(p.name)}</div><div class="small muted trunc" style="max-width:320px">${esc(p.desc || "")}</div></div></div></td>
        <td>${esc(p.key)}</td><td>${PROJECT_TYPES[p.type].label}</td><td><span class="row nowrap">${avatar(p.leadId)} ${esc(uname(p.leadId))}</span></td><td>${open}</td>
        <td style="min-width:140px"><div class="progress"><i style="width:${pct}%;background:var(--ok)"></i></div><span class="small muted">${pct}% erledigt</span></td></tr>`; }).join("")}
    </tbody></table></div>`;
}

/* ---------- Ansicht: Board ---------- */
function boardIssues(p) {
  const b = ui.board; const sp = activeSprint(p);
  let list = projIssues(p).filter((i) => i.type !== "EPIC");
  if (p.type === "software") list = sp ? list.filter((i) => i.sprintId === sp.id) : [];
  else list = list.filter((i) => !(isDone(i) && i.resolvedAt && Date.now() - new Date(i.resolvedAt) > 14 * 864e5));
  if (b.mine) list = list.filter((i) => i.assigneeId === db.currentUserId);
  if (b.recent) list = list.filter((i) => Date.now() - new Date(i.updatedAt) < 864e5);
  if (b.users.length) list = list.filter((i) => b.users.includes(i.assigneeId || "none"));
  if (b.q) { const q = b.q.toLowerCase(); list = list.filter((i) => `${keyOf(i)} ${i.summary}`.toLowerCase().includes(q)); }
  return list.sort((a, c) => a.rank - c.rank);
}
function boardCard(i) {
  const sla = slaInfo(i, "resolve");
  return `<div class="bcard" draggable="true" data-drag="${i.id}" data-act="open" data-id="${i.id}">
    <div class="sum">${esc(i.summary)}</div>
    ${i.epicId || i.labels.length || i.customer ? `<div class="row" style="margin-bottom:8px">${epicChip(i)}${i.customer ? `<span class="chip gray">${esc(i.customer.company || i.customer.name)}</span>` : ""}${i.labels.slice(0, 2).map((l) => `<span class="label-chip">${esc(l)}</span>`).join("")}</div>` : ""}
    <div class="row nowrap">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><span class="sp"></span>${sla && !sla.stopped ? slaChip(sla) : ""}${apptChip(i)}${dueChip(i)}${subtaskProgress(i)}${i.storyPoints != null ? `<span class="pts">${i.storyPoints}</span>` : ""}${prioIcon(i.priority)}${avatar(i.assigneeId)}</div></div>`;
}
function viewBoard(p) {
  const sp = activeSprint(p); const wf = workflowOf(p); const list = boardIssues(p); const b = ui.board;
  const assignees = [...new Set(projIssues(p).filter((i) => !isDone(i)).map((i) => i.assigneeId || "none"))];
  const head = `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>${p.type === "software" ? (sp ? esc(sp.name) : "Board") : "Board"}</h1>
      ${sp ? `<div class="small muted">${fmtDay(sp.start)} – ${fmtDay(sp.end)} · noch ${Math.max(0, daysBetween(today(), sp.end))} Tage${sp.goal ? ` · Ziel: ${esc(sp.goal)}` : ""}</div>` : ""}</div>
      <div class="row">${sp ? `<button class="btn" data-act="complete-sprint" data-id="${sp.id}">Sprint abschließen</button>` : ""}<button class="btn primary" data-act="create" data-project="${p.id}">${icon("plus")} Vorgang</button></div></div>
    <div class="board-tools"><input type="search" id="board-q" placeholder="Board durchsuchen" value="${esc(b.q)}">
      <div class="avatars-filter">${assignees.map((a) => `<button class="${b.users.includes(a) ? "on" : ""}" data-act="board-user" data-v="${a}" aria-label="${esc(a === "none" ? "Nicht zugewiesen" : uname(a))}">${avatar(a === "none" ? null : a)}</button>`).join("")}</div>
      <button class="toggle ${b.mine ? "on" : ""}" data-act="board-toggle" data-v="mine">Nur meine</button><button class="toggle ${b.recent ? "on" : ""}" data-act="board-toggle" data-v="recent">Kürzlich aktualisiert</button>
      <span class="sp"></span><label class="small muted row nowrap">Gruppieren nach <select id="board-lane" style="width:auto">${[["none", "Keine"], ["assignee", "Verantwortlich"], ["epic", "Epic"], ["priority", "Priorität"]].map(([v, l]) => `<option value="${v}" ${b.lane === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>`;
  const cap = Math.round(ui.rowLimit / 5); // Karten je Spalte, „weitere“ lädt nach
  if (p.type === "software" && !sp) return head + `<div class="empty">Kein aktiver Sprint. Im <a href="#/p/${p.key}/backlog">Backlog</a> einen Sprint planen und starten.</div>`;
  let lanes = [{ key: "all", title: null, items: list }];
  if (b.lane === "assignee") lanes = [...new Set(list.map((i) => i.assigneeId || ""))].map((a) => ({ key: a, title: `${avatar(a || null)} ${esc(a ? uname(a) : "Nicht zugewiesen")}`, items: list.filter((i) => (i.assigneeId || "") === a) }));
  if (b.lane === "epic") lanes = [...new Set(list.map((i) => i.epicId || (i.parentId && issue(i.parentId)?.epicId) || ""))].map((e) => ({ key: e, title: e ? `${typeIcon("EPIC")} ${esc(issue(e)?.summary)}` : "Ohne Epic", items: list.filter((i) => (i.epicId || (i.parentId && issue(i.parentId)?.epicId) || "") === e) }));
  if (b.lane === "priority") lanes = Object.keys(PRIOS).filter((k) => list.some((i) => i.priority === k)).map((k) => ({ key: k, title: `${prioIcon(k)} ${PRIOS[k].label}`, items: list.filter((i) => i.priority === k) }));
  return head + lanes.map((ln) => `${ln.title ? `<div class="lane-h">${ln.title} <span class="muted small">${ln.items.length} Vorgänge</span></div>` : ""}
    <div class="board" style="grid-template-columns:repeat(${wf.length}, minmax(240px,1fr))">${wf.map((s) => { const col = ln.items.filter((i) => i.status === s.id);
      return `<div class="col" data-drop-status="${s.id}"><div class="col-h">${esc(s.name)} <span>${col.length}</span>${s.cat === "done" ? " ✓" : ""}</div>${col.slice(0, cap).map(boardCard).join("")}${col.length > cap ? `<button class="btn subtle sm" style="width:100%" data-act="more-rows">+ ${col.length - cap} weitere</button>` : ""}</div>`; }).join("")}</div>`).join("");
}

/* ---------- Ansicht: Backlog ---------- */
function backlogRow(i) {
  return `<div class="brow" draggable="true" data-drag="${i.id}" data-drop-row="${i.id}" data-act="open" data-id="${i.id}">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><span class="trunc" style="flex:1">${esc(i.summary)}</span>
    <span class="hide-m row nowrap">${epicChip(i)}${lozenge(i)}${dueChip(i)}</span><span class="pts">${i.storyPoints ?? "–"}</span>${prioIcon(i.priority)}${avatar(i.assigneeId)}</div>`;
}
function viewBacklog(p) {
  const sprints = db.sprints.filter((s) => s.projectId === p.id && s.state !== "closed").sort((a, b) => (a.state === "active" ? -1 : 1) - (b.state === "active" ? -1 : 1));
  const epicFilter = ui.backlogEpic || "";
  const items = projIssues(p).filter((i) => i.type !== "EPIC" && i.type !== "SUBTASK" && (!epicFilter || i.epicId === epicFilter)).sort((a, b) => a.rank - b.rank);
  const box = (id, title, sub, list, actions) => { const pts = list.reduce((s, i) => s + (i.storyPoints || 0), 0); const done = list.filter(isDone).reduce((s, i) => s + (i.storyPoints || 0), 0);
    return `<div class="sprint-box" data-drop-sprint="${id}"><div class="sprint-h"><b>${title}</b><span class="small muted">${sub} · ${list.length} Vorgänge</span><span class="sp"></span>
      <span class="chip gray" title="Story Points gesamt">${pts} SP</span>${done ? `<span class="chip green" title="erledigt">${done} SP fertig</span>` : ""}${actions}</div>
      <div class="brows">${list.slice(0, ui.rowLimit).map(backlogRow).join("") || `<div class="brow muted small" style="justify-content:center;cursor:default">Vorgänge hierher ziehen</div>`}</div>
      ${moreRows(list.length)}<form class="quick-create" data-quick="${id}"><input type="text" placeholder="+ Vorgang erstellen – Zusammenfassung eingeben und Enter" aria-label="Schnell erstellen"></form></div>`; };
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Backlog</h1></div><div class="row"><button class="btn" data-act="new-sprint" data-project="${p.id}">Sprint erstellen</button><button class="btn primary" data-act="create" data-project="${p.id}">${icon("plus")} Vorgang</button></div></div>
    <div class="row" style="margin-bottom:12px"><span class="small muted">Epic:</span><button class="toggle ${!epicFilter ? "on" : ""}" data-act="backlog-epic" data-v="">Alle</button>${epicsOf(p).map((e) => `<button class="toggle ${epicFilter === e.id ? "on" : ""}" data-act="backlog-epic" data-v="${e.id}"><span style="color:${e.color}">●</span> ${esc(e.summary)}</button>`).join("")}</div>
    ${sprints.map((s) => box(s.id, esc(s.name), s.state === "active" ? `<span class="lozenge cat-progress">aktiv</span> ${fmtDay(s.start)} – ${fmtDay(s.end)}` : "geplant",
      items.filter((i) => i.sprintId === s.id),
      s.state === "active" ? `<button class="btn sm" data-act="complete-sprint" data-id="${s.id}">Sprint abschließen</button>` : `<button class="btn sm primary" data-act="start-sprint" data-id="${s.id}" ${activeSprint(p) ? "disabled title='Es läuft bereits ein Sprint'" : ""}>${icon("play")} Sprint starten</button><button class="btn sm subtle" data-act="delete-sprint" data-id="${s.id}" aria-label="Sprint löschen">${icon("trash")}</button>`)).join("")}
    ${box("backlog", "Backlog", "nicht eingeplant", items.filter((i) => !isDone(i) && (!i.sprintId || sprint(i.sprintId)?.state === "closed")), "")}`; // Erledigtes gehört nicht ins Backlog
}

/* ---------- Ansicht: Zeitleiste ---------- */
function viewTimeline(p) {
  const start = addDays(today(), -21); const days = 140; const end = addDays(start, days);
  const pos = (k) => Math.max(0, Math.min(100, (daysBetween(start, k) / days) * 100));
  const months = []; let m = parseDay(start); m.setDate(1); while (dayKey(m) < end) { const k = dayKey(m); if (k >= start) months.push(k); m.setMonth(m.getMonth() + 1); }
  const epics = epicsOf(p).sort((a, b) => (a.startDate || a.createdAt).localeCompare(b.startDate || b.createdAt));
  const rows = epics.map((e) => {
    const ch = epicChildren(e); const done = ch.filter(isDone).length; const pct = ch.length ? Math.round(done / ch.length * 100) : 0;
    const s = e.startDate || dayKey(e.createdAt), en = e.dueDate || addDays(s, 30);
    const left = pos(s), width = Math.max(1.5, pos(en) - left);
    const open = ui.tlOpen?.includes(e.id);
    let html = `<div class="tl-name"><button class="btn subtle sm icon" data-act="tl-toggle" data-id="${e.id}" aria-label="Aufklappen" style="width:22px">${open ? "▾" : "▸"}</button>${typeIcon("EPIC")}<a href="#" data-act="open" data-id="${e.id}" class="trunc" style="color:var(--fg)">${esc(e.summary)}</a></div>
      <div class="tl-track"><div class="tl-bar" data-act="open" data-id="${e.id}" style="left:${left}%;width:${width}%;background:${e.color || "#8f5bd6"}" data-tip="${esc(`${e.summary}\n${fmtDay(s)} – ${fmtDay(en)}\n${done}/${ch.length} erledigt (${pct}%)`)}"><i style="width:${pct}%"></i>${pct}%</div></div>`;
    if (open) html += ch.map((c) => { const cs = dayKey(c.createdAt) < start ? start : dayKey(c.createdAt); const ce = c.dueDate || (c.resolvedAt ? dayKey(c.resolvedAt) : addDays(cs, 7)); const l = pos(cs);
      return `<div class="tl-name" style="padding-left:40px">${typeIcon(c.type)}<a href="#" data-act="open" data-id="${c.id}" class="trunc" style="color:var(--fg)">${keyOf(c)} ${esc(c.summary)}</a></div>
        <div class="tl-track"><div class="tl-bar" data-act="open" data-id="${c.id}" style="left:${l}%;width:${Math.max(1, pos(ce) - l)}%;background:${isDone(c) ? "var(--ok)" : "var(--ref)"};opacity:.85" data-tip="${esc(`${keyOf(c)} ${c.summary}\n${statusOf(c).name}`)}"></div></div>`; }).join("") || `<div class="tl-name small muted" style="padding-left:40px">Keine Vorgänge</div><div class="tl-track"></div>`;
    return html;
  }).join("");
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Zeitleiste</h1></div><button class="btn primary" data-act="create" data-project="${p.id}" data-type="EPIC">${icon("plus")} Epic</button></div>
    ${epics.length ? `<div class="card tl"><div class="tl-grid"><div class="tl-name b" style="height:30px;border-bottom:2px solid var(--border)">Epics</div>
      <div class="tl-head">${months.map((k) => `<span style="left:${pos(k)}%">${parseDay(k).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</span>`).join("")}<div class="tl-today" style="left:${pos(today())}%" title="Heute"></div></div>
      ${rows}</div></div><p class="small muted" style="margin-top:8px">Balken: Start- bis Fälligkeitsdatum des Epics; heller Anteil = erledigte Vorgänge. Oranger Strich = heute.</p>`
      : `<div class="empty">Noch keine Epics. Epics bündeln größere Vorhaben – <a href="#" data-act="create" data-project="${p.id}" data-type="EPIC">jetzt Epic anlegen</a>.</div>`}`;
}

/* ---------- Ansicht: Liste & Filter ---------- */
const ROW_PAGE = 250; // Tabellen rendern seitenweise – Tausende Zeilen auf einmal blockieren den Browser
const moreRows = (n) => n > ui.rowLimit ? `<div class="row" style="justify-content:center;padding:12px"><span class="small muted">${ui.rowLimit} von ${n} angezeigt</span><button class="btn sm" data-act="more-rows">Weitere ${Math.min(ROW_PAGE, n - ui.rowLimit)} anzeigen</button><button class="btn subtle sm" data-act="all-rows" data-n="${n}">Alle anzeigen</button></div>` : "";
/** Spalten der Ergebnistabellen – frei wählbar, gemerkt je Browser. */
const COLS = {
  type: { l: "Typ", c: (i) => typeIcon(i.type) }, key: { l: "Schlüssel", c: (i) => `<span class="key">${keyOf(i)}</span>` },
  summary: { l: "Zusammenfassung", fixed: true, c: (i) => `<div class="trunc" style="max-width:440px">${esc(i.summary)}</div>${i.customer && !colOn("customer") ? `<div class="small muted">${esc(i.customer.company || i.customer.name)}</div>` : ""}` },
  customer: { l: "Kunde", c: (i) => esc(i.customer?.company || i.customer?.name || customer(i.customerId)?.name || "–") }, project: { l: "Projekt", c: (i) => esc(proj(i.projectId)?.key || "") },
  team: { l: "Team", c: (i) => esc(team(i.teamId)?.name || "–") },
  assignee: { l: "Verantwortlich", c: (i) => `<span class="row nowrap">${avatar(i.assigneeId)}<span class="trunc small">${esc(uname(i.assigneeId))}</span></span>` },
  reporter: { l: "Melder", c: (i) => `<span class="small">${esc(i.reporterId ? uname(i.reporterId) : i.customer?.name || "–")}</span>` },
  status: { l: "Status", c: (i) => lozenge(i) }, priority: { l: "Priorität", c: (i) => `<span class="row nowrap">${prioIcon(i.priority)}<span class="small hide-m">${PRIOS[i.priority].label}</span></span>` },
  due: { l: "Fällig", c: (i) => dueChip(i) || (i.dueDate ? `<span class="small muted">${fmtDay(i.dueDate)}</span>` : '<span class="muted">–</span>') },
  appointment: { l: "Termin", c: (i) => (i.appointmentAt ? `<span class="small">${fmtAppt(i.appointmentAt)}</span>` : '<span class="muted">–</span>') },
  labels: { l: "Labels", nosort: true, c: (i) => (i.labels || []).map((x) => `<span class="chip gray">${esc(x)}</span>`).join(" ") || '<span class="muted">–</span>' },
  points: { l: "Story Points", c: (i) => i.storyPoints ?? '<span class="muted">–</span>' },
  created: { l: "Erstellt", c: (i) => `<span class="small muted nowrap">${fmtDay(dayKey(i.createdAt))}</span>` },
  updated: { l: "Aktualisiert", c: (i) => `<span class="small muted nowrap">${ago(i.updatedAt)}</span>` },
  resolved: { l: "Erledigt", c: (i) => (i.resolvedAt ? `<span class="small muted nowrap">${fmtDay(dayKey(i.resolvedAt))}</span>` : '<span class="muted">–</span>') },
};
const DEFAULT_COLS = ["type", "key", "summary", "assignee", "status", "priority", "due", "updated"];
const colList = () => { const c = localState.cols; return Array.isArray(c) && c.length ? ["summary", ...c.filter((k) => COLS[k] && k !== "summary")].sort((a, b) => Object.keys(COLS).indexOf(a) - Object.keys(COLS).indexOf(b)) : DEFAULT_COLS; };
const colOn = (k) => colList().includes(k);
function resultTable(list, { sortable = false, sortField = null, sortDir = "DESC" } = {}) {
  if (!list.length) return `<div class="empty">Keine Vorgänge gefunden.</div>`;
  const cols = colList();
  const th = (k) => sortable && !COLS[k].nosort ? `<th data-sort="${k}" class="sortable">${COLS[k].l}${sortField === k ? (sortDir === "ASC" ? " ↑" : " ↓") : ""}</th>` : `<th>${COLS[k].l}</th>`;
  const chooser = `<details class="menu-d col-chooser"><summary class="btn subtle sm">Spalten ▾</summary><div class="menu-pop">${Object.entries(COLS).map(([k, c]) => `<label class="row nowrap small" style="padding:5px 8px"><input type="checkbox" data-act="col-toggle" data-v="${k}" ${cols.includes(k) ? "checked" : ""} ${c.fixed ? "disabled" : ""}> ${c.l}</label>`).join("")}<button data-act="col-reset">Standard wiederherstellen</button></div></details>`;
  return `<div class="tbl-tools">${chooser}</div><div class="card tbl-wrap"><table><thead><tr>${cols.map(th).join("")}</tr></thead><tbody>
    ${list.slice(0, ui.rowLimit).map((i) => `<tr class="click" data-act="open" data-id="${i.id}">${cols.map((k) => `<td>${COLS[k].c(i)}</td>`).join("")}</tr>`).join("")}
    </tbody></table>${moreRows(list.length)}</div>`;
}
function viewList(p) {
  const jql = `project = ${p.key} ORDER BY created DESC`;
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Liste</h1></div><div class="row"><a class="btn" href="#/filters?jql=${encodeURIComponent(jql)}">${icon("filter")} In Filter öffnen</a><button class="btn primary" data-act="create" data-project="${p.id}">${icon("plus")} Vorgang</button></div></div>
    <div class="card pad" style="margin-bottom:14px">${statusStack(projIssues(p).filter((i) => i.type !== "EPIC"))}</div>${resultTable(runJql(jql))}`;
}
function filterSidebar(fid, simple) {
  return `<div class="card pad queue-nav"><button class="${simple ? "on" : ""}" data-act="goto" data-href="#/filters?state=open" style="justify-content:flex-start">${icon("search")} Einfache Suche</button><div class="small b muted" style="margin:12px 0 6px">STANDARDFILTER</div>${DEFAULT_FILTERS.map((x) => `<button class="${fid === x.id ? "on" : ""}" data-act="goto" data-href="#/filters?filter=${x.id}">${esc(x.name)}</button>`).join("")}
    <div class="small b muted" style="margin:12px 0 6px">GESPEICHERT</div>${db.filters.length ? db.filters.map((x) => `<div class="row nowrap"><button class="${fid === x.id ? "on" : ""}" data-act="goto" data-href="#/filters?filter=${x.id}" style="flex:1">${esc(x.name)}</button><button class="btn subtle sm icon" data-act="delete-filter" data-id="${x.id}" aria-label="Filter löschen">${icon("x")}</button></div>`).join("") : '<p class="small muted" style="margin:0 10px">Noch keine.</p>'}</div>`;
}
function viewSimpleSearch(params) {
  const { list, sortField, sortDir, state } = simpleSearch(params); ui.lastResults = list; ui.lastJql = simpleToJql(params);
  const g = (k) => params.get(k) || ""; const sel = (name, label, opts) => `<label class="f sm"><span>${label}</span><select name="${name}" data-autosubmit>${opts.map(([v, l]) => `<option value="${esc(v)}" ${g(name) === v || (name === "state" && !g(name) && v === "open") ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  const archiveHint = !ui.archiveLoaded && state !== "open" ? `<div class="note info row" style="margin-bottom:10px"><span style="flex:1">${db.archiveInfo.count} ältere erledigte Vorgänge liegen im Archiv.</span><button class="btn sm" data-act="load-archive">Archiv einbeziehen</button></div>` : "";
  return `<div class="page-head"><h1>Vorgänge suchen</h1><div class="row"><button class="btn" data-act="save-filter">${icon("star")} Filter speichern</button><button class="btn" data-act="export-xlsx">${icon("download")} Excel-Auswertung</button><button class="btn subtle" data-act="export-csv">CSV</button></div></div>
    <div class="side-layout" id="filter-layout">${filterSidebar(null, true)}<div>
      <form id="simple-search" class="card pad" style="margin-bottom:10px">
        <div class="search big">${icon("search")}<input type="search" name="text" id="ss-text" value="${esc(g("text"))}" placeholder="Einfach lostippen: Nummer, Stichwort, Kunde, Seriennummer, Person …" aria-label="Suchtext" autocomplete="off"></div>
        <div class="ss-fields">${sel("project", "Projekt", [["", "Alle"], ...db.projects.map((p) => [p.id, `${p.key} – ${p.name}`])])}${sel("state", "Status", [["open", "Offen"], ["done", "Erledigt"], ["all", "Alle"]])}
          ${sel("assignee", "Verantwortlich", [["", "Alle"], ["me", "Ich"], ["none", "Nicht zugewiesen"], ...db.users.filter((u) => u.active).map((u) => [u.id, u.name])])}${sel("priority", "Priorität", [["", "Alle"], ...Object.entries(PRIOS).map(([k, v]) => [k, v.label])])}
          ${sel("type", "Typ", [["", "Alle"], ...Object.entries(TYPES).filter(([k]) => k !== "SUBTASK").map(([k, v]) => [k, v.label])])}${sel("team", "Team", [["", "Alle"], ...db.teams.map((t) => [t.id, t.name])])}</div>
        <div class="row small muted" style="margin-top:8px"><span style="flex:1">Mehrere Wörter = alle müssen vorkommen · <code>-wort</code> schließt aus · Umlaute und Groß-/Kleinschreibung egal</span>${[...params.keys()].some((k) => SIMPLE_KEYS.includes(k) && k !== "state") ? `<a href="#/filters?state=open">Zurücksetzen</a> · ` : ""}<a href="#/filters?jql=${encodeURIComponent(ui.lastJql)}">Erweiterte Suche (JQL)</a></div></form>
      ${archiveHint}<p class="small muted" style="margin:0 0 8px">${list.length} Vorgang${list.length === 1 ? "" : "e"}</p>
      ${resultTable(list, { sortable: true, sortField, sortDir })}</div></div>`;
}
function viewFilters(params) {
  if (!params.has("jql") && !params.has("filter")) return viewSimpleSearch(params);
  const all = [...DEFAULT_FILTERS, ...db.filters];
  const fid = params.get("filter"); const f = all.find((x) => x.id === fid);
  const jql = params.get("jql") ?? f?.jql ?? DEFAULT_FILTERS[0].jql;
  let list = [], err = null; try { list = runJql(jql); } catch (e) { err = e.message; }
  let sortField = null, sortDir = "DESC"; try { const o = parseJql(jql).order[0]; if (o) { sortField = o.f; sortDir = o.dir; } } catch {}
  ui.lastResults = list;
  const archiveBar = !ui.archiveLoaded ? `<div class="note info row" style="margin-bottom:10px"><span style="flex:1">${db.archiveInfo.count} Vorgänge, die länger als ${db.archiveInfo.days} Tage erledigt sind, liegen im Archiv und sind in dieser Suche noch nicht enthalten.</span><button class="btn sm" data-act="load-archive">Archiv einbeziehen</button></div>` : "";
  return archiveBar + `<div class="page-head"><h1>Vorgänge suchen</h1><div class="row"><button class="btn" data-act="save-filter">${icon("star")} Filter speichern</button><button class="btn" data-act="export-xlsx">${icon("download")} Excel-Auswertung</button><button class="btn subtle" data-act="export-csv">CSV</button></div></div>
    <div class="side-layout" id="filter-layout">
      ${filterSidebar(fid, false)}
      <div>
        <form id="jql-form" class="row nowrap" style="margin-bottom:8px;align-items:flex-start"><textarea id="jql" class="jql" rows="2" spellcheck="false" aria-label="JQL-Abfrage">${esc(jql)}</textarea><button class="btn primary" type="submit">${icon("search")} Suchen</button></form>
        <p class="small muted" style="margin:0 0 6px">Erweiterte Suche mit Abfragesprache – oder <a href="#/filters?state=open">einfach mit Text suchen</a>.</p><details style="margin-bottom:10px"><summary class="small muted" style="cursor:pointer">Hilfe zur Abfragesprache (JQL)</summary><div class="small muted" style="padding:8px 0;line-height:1.7">
          Felder: <code>project, type, status, statusCategory, assignee, reporter, priority, labels, sprint, due, created, updated, resolved, resolution, text, summary, epic, customer, points</code><br>
          Operatoren: <code>= != ~ !~ &lt; &gt; &lt;= &gt;= IN (…) NOT IN (…) IS EMPTY IS NOT EMPTY</code>, verknüpft mit <code>AND OR NOT ( )</code>, sortiert mit <code>ORDER BY feld ASC|DESC</code><br>
          Funktionen: <code>currentUser() openSprints() now() startOfWeek() endOfWeek() startOfMonth()</code>, relative Daten <code>-7d 14d 2w</code><br>
          Beispiel: <code>project = SD AND priority IN (Höchste, Hoch) AND resolution = Unresolved ORDER BY created DESC</code></div></details>
        ${err ? `<div class="note err" style="margin-bottom:10px">Abfragefehler: ${esc(err)}</div>` : `<p class="small muted" style="margin:0 0 8px">${list.length} Vorgang${list.length === 1 ? "" : "e"}${f ? ` · Filter „${esc(f.name)}“` : ""}</p>`}
        ${err ? "" : resultTable(list, { sortable: true, sortField, sortDir })}
      </div></div>`;
}

/* ---------- Ansicht: Warteschlangen (Service) ---------- */
const QUEUES = [
  { id: "open", name: "Alle offenen", fn: (i) => !isDone(i) },
  { id: "mine", name: "Mir zugewiesen", fn: (i) => !isDone(i) && i.assigneeId === db.currentUserId },
  { id: "unassigned", name: "Nicht zugewiesen", fn: (i) => !isDone(i) && !i.assigneeId },
  { id: "risk", name: "SLA gefährdet / verletzt", fn: (i) => !isDone(i) && ["first", "resolve"].some((k) => { const s = slaInfo(i, k); return s && !s.stopped && (s.risk || s.breached); }) },
  { id: "new", name: "Neu – nicht eingeplant", fn: (i) => i.status === "OPEN" },
  { id: "scheduled", name: "Eingeplant", fn: (i) => i.status === "SCHEDULED" },
  { id: "waiting", name: "Wartet auf Kunde", fn: (i) => i.status === "WAITING" },
  { id: "parts", name: "Wartet auf Ersatzteil", fn: (i) => i.status === "PARTS" },
  { id: "incidents", name: "Störungen", fn: (i) => !isDone(i) && i.type === "INCIDENT" },
  { id: "resolved", name: "Kürzlich gelöst", fn: (i) => isDone(i) && i.resolvedAt && Date.now() - new Date(i.resolvedAt) < 14 * 864e5 },
];
function viewQueue(p) {
  const items = projIssues(p).filter((i) => i.type !== "SUBTASK");
  const q = QUEUES.find((x) => x.id === ui.queue) || QUEUES[0];
  const list = items.filter(q.fn).sort((a, b) => { const sa = slaInfo(a, "resolve"), sb = slaInfo(b, "resolve"); return (sa?.stopped ? 1e15 : sa?.remaining ?? 1e15) - (sb?.stopped ? 1e15 : sb?.remaining ?? 1e15); });
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Warteschlangen</h1></div><div class="row"><a class="btn" href="/portal?p=${p.key}" target="_blank" rel="noopener">${icon("portal")} Kundenportal ↗</a><button class="btn primary" data-act="create" data-project="${p.id}">${icon("plus")} Anfrage</button></div></div>
    <div class="side-layout" id="queue-layout">
      <div class="card pad queue-nav">${QUEUES.map((x) => { const n = items.filter(x.fn).length; return `<button class="${x.id === q.id ? "on" : ""}" data-act="queue" data-v="${x.id}"><span>${esc(x.name)}</span><span class="${x.id === "risk" && n ? "chip red" : "muted"}">${n}</span></button>`; }).join("")}
        <p class="small muted" style="margin:12px 10px 0">SLA-Ziele (Kalenderzeit): ${Object.entries(SLA).map(([k, v]) => `${PRIOS[k].label} ${v[0]} h / ${v[1] >= 24 ? v[1] / 24 + " T" : v[1] + " h"}`).join(" · ")}. „Wartet auf Kunde“ pausiert die Lösungszeit.</p></div>
      <div>${list.length ? `<div class="card tbl-wrap"><table><thead><tr><th>Typ</th><th>Schlüssel</th><th>Anfrage / Kunde</th><th>Erste Antwort</th><th>Lösung</th><th>Status</th><th>Prio.</th><th></th><th>Nächster Schritt</th></tr></thead><tbody>
        ${list.slice(0, ui.rowLimit).map((i) => `<tr class="click" data-act="open" data-id="${i.id}"><td>${typeIcon(i.type)}</td><td class="key">${keyOf(i)}</td><td><div class="trunc" style="max-width:280px">${esc(i.summary)}</div><div class="small muted trunc" style="max-width:280px">${esc(i.customer?.company || "")}${i.customer?.name ? " · " + esc(i.customer.name) : ""} · ${ago(i.createdAt)}</div></td>
          <td>${slaChip(slaInfo(i, "first"))}</td><td>${slaChip(slaInfo(i, "resolve"))}</td><td>${lozenge(i)}${apptChip(i) ? `<div style="margin-top:3px">${apptChip(i)}</div>` : ""}</td><td>${prioIcon(i.priority)}</td><td>${avatar(i.assigneeId)}</td><td>${actionButton(i)}</td></tr>`).join("")}
        </tbody></table></div>` : `<div class="empty">Keine Anfragen in dieser Warteschlange. 🎉</div>`}</div></div>`;
}

/* ---------- Ansicht: Einsatzplanung (Service) ---------- */
function weekDays(offset) {
  const d = parseDay(today()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 6 }, (_, k) => { const x = new Date(d); x.setDate(d.getDate() + k); return dayKey(x); });
}
function viewDispatch(p) {
  const days = weekDays(ui.dispatchWeek || 0); const t = today();
  const items = projIssues(p).filter((i) => i.type !== "SUBTASK");
  const planned = items.filter((i) => i.appointmentAt && days.includes(dayKey(i.appointmentAt)));
  const dt = team(ui.dispatchTeam);
  const techs = dt ? teamMembers(dt) : activeUsers().filter((u) => u.role === "AGENT" || planned.some((i) => i.assigneeId === u.id));
  const unplanned = items.filter((i) => ["OPEN", "PARTS", "WAITING"].includes(i.status) && (i.type !== "SERVICE" || i.status === "PARTS"))
    .sort((a, b) => PRIOS[b.priority].rank - PRIOS[a.priority].rank || a.createdAt.localeCompare(b.createdAt));
  const card = (i) => { const done = isDone(i); return `<div class="dcard ${done ? "done" : ""} cat-b-${statusOf(i).cat}" draggable="${done ? "false" : "true"}" data-drag-appt="${i.id}" data-act="open" data-id="${i.id}">
    <div class="row nowrap small"><b>${fmtTime(i.appointmentAt)}</b><span class="key">${keyOf(i)}</span><span class="sp"></span>${prioIcon(i.priority)}</div>
    <div class="trunc" style="font-weight:500">${esc(i.summary)}</div><div class="small muted trunc">${esc(i.customer?.company || "")}</div><div style="margin-top:3px">${lozenge(i)}</div></div>`; };
  const fmtHead = (k) => parseDay(k).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Einsatzplanung</h1>
      <div class="small muted">KW ${isoWeek(days[0])} · ${fmtDay(days[0])} – ${fmtDay(days[5])}</div></div>
      <div class="row">${db.teams.length ? `<select id="dispatch-team" aria-label="Team" style="width:auto"><option value="">Alle Service-Mitarbeiter</option>${db.teams.map((t) => `<option value="${t.id}" ${dt?.id === t.id ? "selected" : ""}>Team ${esc(t.name)}</option>`).join("")}</select>` : ""}<button class="btn" data-act="dispatch-week" data-v="-1" aria-label="Vorige Woche">←</button><button class="btn" data-act="dispatch-week" data-v="0">Diese Woche</button><button class="btn" data-act="dispatch-week" data-v="1" aria-label="Nächste Woche">→</button></div></div>
    <div class="dispatch-layout">
      <div class="card pad"><h3 style="font-size:14px;margin-bottom:4px">Einzuplanen <span class="badge-count">${unplanned.length}</span></h3><p class="small muted" style="margin:0 0 8px">Auf Techniker und Tag ziehen – oder öffnen und „Einplanen“ wählen.</p>
        ${unplanned.map((i) => `<div class="dcard" draggable="true" data-drag-appt="${i.id}" data-act="open" data-id="${i.id}"><div class="row nowrap small"><span class="key">${keyOf(i)}</span>${lozenge(i)}<span class="sp"></span>${prioIcon(i.priority)}</div><div class="trunc" style="font-weight:500">${esc(i.summary)}</div><div class="small muted trunc">${esc(i.customer?.company || "")} · ${ago(i.createdAt)}</div></div>`).join("") || '<p class="small muted">Alles eingeplant. 👍</p>'}</div>
      <div class="card dgrid-wrap"><div class="dgrid" style="grid-template-columns:150px repeat(${days.length}, minmax(140px, 1fr))">
        <div class="dhead"></div>${days.map((k) => `<div class="dhead ${k === t ? "today" : ""}">${fmtHead(k)}</div>`).join("")}
        ${techs.length ? techs.map((u) => `<div class="dtech">${avatar(u.id)} <span class="trunc">${esc(u.name)}</span><span class="small muted">${planned.filter((i) => i.assigneeId === u.id && !isDone(i)).length} offen</span></div>
          ${days.map((k) => { const ab = absenceOn(u.id, k); return `<div class="dcell ${k === t ? "today" : ""} ${k < t ? "past" : ""} ${ab ? "absent" : ""}" data-drop-appt="${u.id}|${k}">${ab ? `<div class="dabs" title="${esc(absenceText(ab))}">${esc(ab.type)}</div>` : ""}${planned.filter((i) => i.assigneeId === u.id && dayKey(i.appointmentAt) === k).sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt)).map(card).join("")}</div>`; }).join("")}`).join("")
          : `<div style="grid-column:1/-1;padding:16px" class="small muted">Noch keine Service-Mitarbeiter. Unter Einstellungen Personen die Rolle „Service-Mitarbeiter“ geben.</div>`}
      </div></div></div>`;
}
function isoWeek(k) { const d = parseDay(k); const th = new Date(d); th.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const jan4 = new Date(th.getFullYear(), 0, 4); return 1 + Math.round(((th - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7); }

/* ---------- Ansicht: Berichte ---------- */
function createdResolvedChart(list, days = 30) {
  const labels = [], created = [], resolved = [];
  for (let d = days - 1; d >= 0; d--) { const k = addDays(today(), -d); labels.push(fmtShort(k)); created.push(list.filter((i) => dayKey(i.createdAt) === k).length); resolved.push(list.filter((i) => i.resolvedAt && dayKey(i.resolvedAt) === k).length); }
  const cum = (a) => a.reduce((acc, v) => { acc.push((acc.at(-1) || 0) + v); return acc; }, []);
  return lineChart({ labels, series: [{ name: "Erstellt", color: "var(--s1)", values: cum(created) }, { name: "Erledigt", color: "var(--s2)", values: cum(resolved) }], yLabel: "kumuliert, letzte 30 Tage" });
}
function workloadBars(list) {
  const open = list.filter((i) => !isDone(i) && i.type !== "EPIC");
  return hbars(activeUsers().map((u) => { const l = open.filter((i) => i.assigneeId === u.id); return { label: u.name, value: l.length, extra: `${l.filter(isOverdue).length} überfällig` }; })
    .concat([{ label: "Nicht zugewiesen", value: open.filter((i) => !i.assigneeId).length }]).filter((r) => r.value > 0).sort((a, b) => b.value - a.value), "");
}
function burndown(p) {
  const sp = activeSprint(p); if (!sp) return `<p class="muted">Kein aktiver Sprint.</p>`;
  const list = db.issues.filter((i) => i.sprintId === sp.id && i.type !== "SUBTASK"); const total = list.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const n = daysBetween(sp.start, sp.end); const labels = [], ideal = [], actual = [];
  for (let d = 0; d <= n; d++) { const k = addDays(sp.start, d); labels.push(fmtShort(k)); ideal.push(total - (total / n) * d);
    actual.push(k > today() ? null : total - list.filter((i) => i.resolvedAt && dayKey(i.resolvedAt) <= k).reduce((s, i) => s + (i.storyPoints || 0), 0)); }
  return lineChart({ labels, series: [{ name: "Ideal", color: "var(--ref)", values: ideal, dash: true }, { name: "Verbleibend", color: "var(--s1)", values: actual }], yMax: Math.max(1, total), yLabel: "Story Points" });
}
function viewReports(p) {
  const list = projIssues(p);
  const closed = db.sprints.filter((s) => s.projectId === p.id && s.state === "closed").slice(-6);
  const open = list.filter((i) => !isDone(i) && i.type !== "EPIC");
  let svc = "";
  if (p.type === "service") {
    const reqs = list.filter((i) => i.type !== "SUBTASK"); const k = (kind) => { const done = reqs.map((i) => slaInfo(i, kind)).filter((s) => s && s.stopped); return done.length ? Math.round(done.filter((s) => s.met).length / done.length * 100) : null; };
    const fr = k("first"), rs = k("resolve"); const avgRes = (() => { const r = reqs.filter((i) => i.resolvedAt); return r.length ? fmtDur(r.reduce((s, i) => s + (new Date(i.resolvedAt) - new Date(i.createdAt)), 0) / r.length) : "–"; })();
    svc = `<div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="v">${fr == null ? "–" : fr + " %"}</div><div class="l">SLA erste Antwort eingehalten</div></div>
      <div class="card stat"><div class="v">${rs == null ? "–" : rs + " %"}</div><div class="l">SLA Lösung eingehalten</div></div>
      <div class="card stat"><div class="v">${avgRes}</div><div class="l">Ø Lösungszeit</div></div>
      <div class="card stat"><div class="v">${reqs.filter((i) => !isDone(i)).length}</div><div class="l">offene Anfragen</div></div></div>
      <div class="card pad" style="margin-bottom:16px"><h3 style="font-size:15px;margin-bottom:10px">Anfragen nach Typ (letzte 30 Tage)</h3>${hbars(["INCIDENT", "MAINT", "SERVICE"].map((t) => ({ label: TYPES[t].label, value: reqs.filter((i) => i.type === t && Date.now() - new Date(i.createdAt) < 30 * 864e5).length })))}</div>`;
  }
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Berichte</h1></div><button class="btn" data-act="export-project-xlsx" data-project="${p.id}">${icon("download")} Excel-Auswertung</button></div>${svc}
    <div class="grid g2">
      ${p.type === "software" ? `<div class="card pad"><h3 style="font-size:15px">Burndown – ${esc(activeSprint(p)?.name || "kein Sprint")}</h3><p class="small muted" style="margin:2px 0 8px">Verbleibende Story Points je Tag gegenüber dem idealen Verlauf</p>${burndown(p)}</div>
      <div class="card pad"><h3 style="font-size:15px">Velocity</h3><p class="small muted" style="margin:2px 0 8px">Zugesagte und erledigte Story Points je abgeschlossenem Sprint${closed.length ? ` · Ø ${Math.round(closed.reduce((s, x) => s + (x.completed || 0), 0) / closed.length)} SP` : ""}</p>
        ${closed.length ? barChart({ labels: closed.map((s) => s.name.replace(/^.*?(Sprint)/, "$1")), series: [{ name: "Zugesagt", color: "var(--ref)", values: closed.map((s) => s.committed || 0) }, { name: "Erledigt", color: "var(--s1)", values: closed.map((s) => s.completed || 0) }] }) : '<p class="muted">Noch keine abgeschlossenen Sprints.</p>'}</div>` : ""}
      <div class="card pad"><h3 style="font-size:15px">Erstellt vs. erledigt</h3><p class="small muted" style="margin:2px 0 8px">Läuft „Erstellt“ davon, wächst der Rückstand.</p>${createdResolvedChart(list)}</div>
      <div class="card pad"><h3 style="font-size:15px">Arbeitslast</h3><p class="small muted" style="margin:2px 0 8px">Offene Vorgänge je Person</p>${workloadBars(list)}
        <h3 style="font-size:15px;margin-top:18px">Status der offenen Arbeit</h3><div style="margin-top:8px">${statusStack(list.filter((i) => i.type !== "EPIC"))}</div>
        <p class="small muted">${open.filter(isOverdue).length} überfällig · ${open.filter((i) => !i.assigneeId).length} nicht zugewiesen</p></div>
    </div>`;
}

/* ---------- Ansicht: Projekteinstellungen ---------- */
function viewProjectSettings(p) {
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Projekteinstellungen</h1></div></div>
    <div class="grid g2"><div class="card pad"><form id="project-form" data-id="${p.id}" class="grid" style="gap:12px">
      <label class="f">Name<input type="text" name="name" value="${esc(p.name)}" required></label>
      <label class="f">Schlüssel<input type="text" value="${esc(p.key)}" disabled></label>
      <label class="f">Beschreibung<textarea name="desc" rows="3">${esc(p.desc || "")}</textarea></label>
      <label class="f">Projektleitung<select name="leadId">${userOpts(p.leadId, "–")}</select></label>
      <label class="f">Standard-Team<select name="teamId">${teamOpts(p.teamId)}</select><span class="small muted" style="font-weight:400">Neue Vorgänge und Kundenanfragen landen im Eingang dieses Teams.</span></label>
      <label class="f">Farbe<select name="color">${PALETTE.map((c) => `<option value="${c}" ${c === p.color ? "selected" : ""} style="color:${c}">● ${c}</option>`).join("")}</select></label>
      ${me().role === "ADMIN" ? `<div class="row"><button class="btn primary" type="submit">Speichern</button><span class="sp"></span><button type="button" class="btn danger" data-act="delete-project" data-id="${p.id}">Projekt löschen</button></div>` : '<p class="small muted">Nur Administratoren können Projekteinstellungen ändern.</p>'}</form></div>
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Workflow</h3><div class="row">${workflowOf(p).map((s, k) => `${k ? "→" : ""}<span class="lozenge cat-${s.cat}">${esc(s.name)}</span>`).join(" ")}</div>
        <h3 style="font-size:15px;margin:16px 0 8px">Vorgangstypen</h3><div class="row">${PROJECT_TYPES[p.type].types.map((t) => `<span class="row nowrap">${typeIcon(t)} ${TYPES[t].label}</span>`).join("")}</div>
        ${p.type === "service" ? `<h3 style="font-size:15px;margin:16px 0 8px">SLA-Ziele</h3><table><thead><tr><th>Priorität</th><th>Erste Antwort</th><th>Lösung</th></tr></thead><tbody>${Object.entries(SLA).map(([k, v]) => `<tr><td>${prioIcon(k)} ${PRIOS[k].label}</td><td>${v[0]} h</td><td>${v[1]} h</td></tr>`).join("")}</tbody></table>` : ""}</div></div>`;
}

/* ---------- Ansicht: Dashboard ---------- */
function viewDashboard() {
  const open = db.issues.filter((i) => !isDone(i) && i.type !== "EPIC");
  const mine = open.filter((i) => i.assigneeId === db.currentUserId).sort((a, b) => (a.dueDate || "9").localeCompare(b.dueDate || "9")).slice(0, 8);
  const overdue = open.filter(isOverdue).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
  const stream = db.issues.flatMap((i) => i.history.map((h) => ({ ...h, i }))).concat(db.issues.flatMap((i) => i.comments.filter((c) => !c.internal).map((c) => ({ at: c.at, userId: c.userId, field: "Kommentar", to: c.text.slice(0, 80), i, author: c.author }))))
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  const risk = open.filter((i) => ["first", "resolve"].some((k) => { const s = slaInfo(i, k); return s && !s.stopped && (s.breached || s.risk); }));
  return `<div class="page-head"><div><h1>Dashboard</h1><span class="small muted">Alle Projekte</span></div><button class="btn" data-act="export-all-xlsx">${icon("download")} Excel-Auswertung</button></div>
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="v">${open.length}</div><div class="l">offene Vorgänge</div></div>
      <div class="card stat"><div class="v" style="${overdue.length ? "color:var(--danger)" : ""}">${open.filter(isOverdue).length}</div><div class="l">überfällig</div></div>
      <div class="card stat"><div class="v">${open.filter((i) => !i.assigneeId).length}</div><div class="l">nicht zugewiesen</div></div>
      <div class="card stat"><div class="v" style="${risk.length ? "color:var(--danger)" : ""}">${risk.length}</div><div class="l">SLA gefährdet/verletzt</div></div></div>
    <div class="grid g2">
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Mir zugewiesen</h3>${mine.length ? `<div class="tbl-wrap"><table><tbody>${mine.map((i) => issueRow(i)).join("")}</tbody></table></div>` : '<p class="muted">Nichts offen. 🎉</p>'}</div>
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Überfällig</h3>${overdue.length ? `<div class="tbl-wrap"><table><tbody>${overdue.map((i) => issueRow(i, `<td>${avatar(i.assigneeId)}</td>`)).join("")}</tbody></table></div>` : '<p class="muted">Keine überfälligen Vorgänge.</p>'}</div>
      <div class="card pad"><h3 style="font-size:15px">Erstellt vs. erledigt</h3><p class="small muted" style="margin:2px 0 8px">Alle Projekte</p>${createdResolvedChart(db.issues)}</div>
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Arbeitslast</h3>${workloadBars(db.issues)}
        <h3 style="font-size:15px;margin:16px 0 8px">Offen je Projekt</h3>${hbars(db.projects.map((p) => ({ label: p.name, value: open.filter((i) => i.projectId === p.id).length })))}</div>
      ${quarterCard()}
      <div class="card pad" style="grid-column:1/-1"><h3 style="font-size:15px;margin-bottom:8px">Aktivitäten</h3>
        ${stream.map((h) => `<div class="row nowrap small" style="padding:6px 0;border-bottom:1px solid var(--border)">${h.userId ? avatar(h.userId) : custAvatar({ name: h.author || "Kunde" })}<span class="trunc" style="flex:1"><b>${esc(h.userId ? uname(h.userId) : h.author || "Kunde")}</b> · ${esc(h.field)}${h.to ? `: ${esc(h.to)}` : ""} · <a href="#" data-act="open" data-id="${h.i.id}">${keyOf(h.i)}</a> ${esc(h.i.summary)}</span><span class="muted">${ago(h.at)}</span></div>`).join("")}</div>
    </div>`;
}

/** Quartalsvergleich der letzten vier Quartale (Dashboard). */
function quarterCard() {
  if (!ui.archiveLoaded) return `<div class="card pad" style="grid-column:1/-1"><div class="row"><h3 style="font-size:15px;flex:1;margin:0">Quartalsvergleich</h3><button class="btn sm" data-act="load-archive">Archiv laden und vergleichen</button></div><p class="small muted" style="margin:6px 0 0">Für den Vergleich über vier Quartale werden auch ältere, archivierte Vorgänge gebraucht (${db.archiveInfo.count}).</p></div>`;
  const qs = lastQuarters(5).map((p) => periodStats(db.issues, p)); const show = qs.slice(1).reverse(); // aktuelles Quartal zuerst
  const pct = (x) => (x == null ? "–" : `${Math.round(x * 100)} %`); const num1 = (x) => (x == null ? "–" : x.toFixed(1).replace(".", ","));
  const cell = (cur, prev, f, better = "up") => { const d = cur == null || prev == null ? 0 : cur - prev; const tone = better === "none" ? "" : (better === "up" ? d > 0 : d < 0) ? "good" : "bad";
    return `<td class="num">${f(cur)}${d ? ` <span class="qd ${tone}">${d > 0 ? "▲" : "▼"}</span>` : ""}</td>`; };
  return `<div class="card pad" style="grid-column:1/-1"><div class="row" style="margin-bottom:8px"><h3 style="font-size:15px;flex:1">Quartalsvergleich</h3>
      <button class="btn sm" data-act="export-quarter-xlsx" data-q="${show[0].p.y}:${show[0].p.q}">${icon("download")} Excel ${esc(show[0].p.label)}</button><button class="btn sm" data-act="export-quarter-xlsx" data-q="${show[1].p.y}:${show[1].p.q}">${icon("download")} Excel ${esc(show[1].p.label)}</button></div>
    <div class="tbl-wrap"><table class="qtable"><thead><tr><th>Quartal</th><th class="num">Erstellt</th><th class="num">Erledigt</th><th class="num">Ø Durchlaufzeit (Tage)</th><th class="num">Termintreue</th><th class="num">SLA eingehalten</th><th class="num">Einsatzstunden</th></tr></thead><tbody>
    ${show.map((q, k) => { const pv = qs[qs.length - 2 - k];
      return `<tr><td><b>${esc(q.p.label)}</b>${k === 0 ? ' <span class="chip blue">läuft</span>' : ""}</td>${cell(q.created, pv.created, String, "none")}${cell(q.done, pv.done, String)}${cell(q.dur, pv.dur, num1, "down")}${cell(q.onTime, pv.onTime, pct)}${cell(q.sla, pv.sla, pct)}${cell(q.hours, pv.hours, num1, "none")}</tr>`; }).join("")}
    </tbody></table></div><p class="small muted" style="margin:6px 0 0">▲▼ Veränderung zum jeweiligen Vorquartal (grün = besser). Termintreue = Anteil der Vorgänge mit Frist, die bis zur Frist erledigt wurden.</p></div>`;
}

/* ---------- Ansicht: Einstellungen ---------- */
/** Sichtbereich einer Person festlegen (Administration). */
function scopeForm(x) {
  const ctx = accessContext({ ...x, scope: "area" }, { projects: db.projects, teams: db.teams }); const teams = db.teams.filter((t) => ctx.teamIds.has(t.id));
  openModal(`<div class="modal-h"><h2>Sichtbereich: ${esc(x.name)}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="scope-form" data-id="${x.id}"><div class="modal-b">
      <p class="small muted" style="margin:0">Rolle: <b>${esc(ROLES[x.role])}</b> – ${esc(ROLE_INFO[x.role])}</p>
      <label class="row nowrap"><input type="radio" name="scope" value="all" ${userScope(x) === "all" ? "checked" : ""}> <span><b>Alle Projekte</b> – sieht sämtliche Vorgänge</span></label>
      <label class="row nowrap" style="align-items:flex-start"><input type="radio" name="scope" value="area" ${userScope(x) === "area" ? "checked" : ""}> <span><b>Eigener Bereich</b> – Projekte der Teams ${teams.length ? teams.map((t) => `„${esc(t.name)}“`).join(", ") : "(noch in keinem Team)"}, plus unten gewählte Projekte, plus alles, was der Person zugewiesen ist, was sie gemeldet hat oder beobachtet</span></label>
      <div class="f"><span>Zusätzlich freigegebene Projekte (bei „Eigener Bereich“)</span><div class="grid g2" style="gap:6px">${db.projects.map((p) => `<label class="row nowrap small"><input type="checkbox" name="projectIds" value="${p.id}" ${(x.projectIds || []).includes(p.id) ? "checked" : ""} ${ctx.projectIds.has(p.id) && !(x.projectIds || []).includes(p.id) ? "checked disabled title='über Team bereits enthalten'" : ""}> <span class="pavatar sm" style="background:${p.color}">${esc(p.key.slice(0, 3))}</span> ${esc(p.name)}</label>`).join("")}</div></div>
      <p class="small muted" style="margin:0">Änderungen wirken sofort – auch auf bereits geöffnete Browser der Person.</p></div>
    <div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div></form>`);
}
/** Startseite je Person: selbst gewählt oder passend zur Rolle. */
function homeRoute(u = me()) {
  if (u.home && (!u.home.startsWith("p/") || projByKey(u.home.split("/")[1]))) return u.home;
  if (u.role === "MANAGEMENT") return "dashboard";
  if (u.role === "COORDINATOR") { const p = db.projects.find((x) => x.type === "service"); if (p) return `p/${p.key}/dispatch`; }
  return "your-work";
}
const homeOptions = () => [["", `Passend zur Rolle (${ROLES[me().role]})`], ["your-work", "Mein Tag"], ["dashboard", "Dashboard"], ["filters?state=open", "Suche"], ["customers", "Kunden & Anlagen"],
  ...db.projects.flatMap((p) => projectViews(p).filter(([v]) => v !== "settings").map(([v, l]) => [`p/${p.key}/${v}`, `${p.key} – ${l}`]))];
/** Zugangsstatus einer Person (nur Administration). */
function accountLine(x) {
  const a = ui.accounts?.accounts?.[x.id]; if (!ui.accounts || ui.accounts.standalone) return "";
  if (!a) return `<div class="small" style="color:var(--warn-text,#a54800)">Noch kein Zugang</div>`;
  const parts = [];
  if (a.account) parts.push(a.lastLogin ? `zuletzt angemeldet ${ago(new Date(a.lastLogin).toISOString())}` : "noch nie angemeldet");
  else parts.push("Noch kein Passwort");
  if (a.inviteUntil) parts.push(`Einladung offen bis ${fmtDay(dayKey(new Date(a.inviteUntil)))}`);
  if (a.sessions) parts.push(`${a.sessions} Gerät${a.sessions === 1 ? "" : "e"}`);
  return `<div class="small muted trunc">${parts.join(" · ")}</div>`;
}
function accountMenu(x) {
  const a = ui.accounts?.accounts?.[x.id]; const st = !ui.accounts || ui.accounts.standalone;
  return `<details class="menu-d"><summary class="btn subtle sm" aria-label="Zugang verwalten">Zugang ▾</summary><div class="menu-pop">
    ${st ? "" : `<button data-act="user-invite" data-id="${x.id}" ${x.active ? "" : "disabled"}>${a?.account ? "Link zum Zurücksetzen" : a?.inviteUntil ? "Einladung erneut senden" : "Einladen"}</button>`}
    <button data-act="set-password" data-id="${x.id}">Passwort direkt setzen</button>
    ${!st && a?.sessions && x.id !== db.currentUserId ? `<button data-act="user-logout" data-id="${x.id}">Auf allen Geräten abmelden</button>` : ""}</div></details>`;
}
const BRAND_COLORS = ["#2436e8", "#1f4e8c", "#0b7a75", "#1a7f37", "#c9372c", "#d35400", "#6e3fbf", "#2b2f36"];
function brandCard() {
  const b = ui.brand || {}; const server = location.protocol.startsWith("http") && !window.GFT_STANDALONE;
  return `<div class="card pad" style="grid-column:1/-1"><h3 id="sec-brand" style="font-size:15px;margin:0 0 4px">Erscheinungsbild</h3><p class="small muted" style="margin:0 0 12px">Name, Firmenfarbe und Logo erscheinen in der App, auf der Anmeldeseite, im Kundenportal, in E-Mails und in der installierten App.</p>
    <form id="brand-form" class="brand-grid"><label class="f">Name der App<input type="text" name="appName" value="${esc(b.appName || "GF Tracker")}" maxlength="40" placeholder="z. B. DLC Service"></label>
      <label class="f">Firmenname (Portal, E-Mails)<input type="text" name="company" value="${esc(b.company || sync.company || "")}" maxlength="120"></label>
      <div class="f"><span>Firmenfarbe</span><div class="row nowrap" style="gap:6px">${BRAND_COLORS.map((c) => `<button type="button" class="swatch ${c === (b.color || "#2436e8") ? "on" : ""}" style="--c:${c}" data-act="brand-swatch" data-v="${c}" aria-label="Farbe ${c}"></button>`).join("")}<input type="color" name="color" value="${esc(b.color || "#2436e8")}" aria-label="Eigene Farbe" style="width:40px;height:30px;padding:0"></div></div>
      <div class="f"><span>Logo <span class="muted small">(PNG, JPG, SVG; quer, mind. 64 px hoch)</span></span><div class="row nowrap">${b.logo ? `<img src="${esc(b.logo)}" alt="Logo" style="height:32px;max-width:160px;object-fit:contain;background:var(--surface-2);border-radius:4px;padding:2px">` : '<span class="small muted">kein Logo</span>'}
        <label class="btn sm" style="cursor:pointer">${icon("upload")} ${b.logo ? "Ersetzen" : "Hochladen"}<input type="file" id="brand-logo" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></label>${b.logo ? `<button type="button" class="btn subtle sm" data-act="brand-logo-del">Entfernen</button>` : ""}</div></div>
      <div style="grid-column:1/-1" class="row"><button class="btn primary" type="submit" ${server ? "" : "disabled"}>Speichern</button>${server ? `<span class="small muted">Vorschau: Farbe wird sofort angezeigt, gilt für alle nach dem Speichern.</span>` : '<span class="small muted">Das Erscheinungsbild wird in der Server-Version eingestellt.</span>'}</div></form></div>`;
}
/** Einzeldatei-Version: wo die Daten liegen, wie viel Platz belegt ist, Hinweis auf Sicherung. */
function localStorageInfo() {
  const st = ui.saStorage; if (!st) { GFTLocal.storage().then((r) => { ui.saStorage = r; if (route().parts[0] === "settings") render(); }); }
  const files = db.issues.reduce((n, i) => n + (i.attachments || []).length, 0); const mb = (b) => `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;
  return `<div class="note ${st && !st.idb ? "err" : "info"}" style="margin:0 0 12px"><b>Alle Daten und ${files} Anhänge liegen nur in diesem Browser auf diesem PC.</b>${st?.used != null ? ` Belegt: ${mb(st.used)}${st.quota ? ` von ${st.quota > 10737418240 ? "über 10 GB" : mb(st.quota)} verfügbar` : ""}.` : ""}${st && !st.idb ? " Achtung: Der Browser erlaubt keine dauerhafte Ablage (privater Modus?) – Anhänge sind nicht möglich, Daten gehen beim Schließen verloren." : ""}
    <br>Bitte regelmäßig <b>„Sicherung herunterladen“</b> – die Datei enthält auch alle Anhänge und lässt sich jederzeit wieder einspielen oder in die Server-Version übernehmen.</div>`;
}
function viewSettings() {
  const u = me(); const isAdmin = u.role === "ADMIN";
  return `<div class="page-head"><h1>Einstellungen</h1></div><div class="grid g2">
    <div class="card pad"><h3 id="sec-profile" style="font-size:15px;margin-bottom:10px">Mein Profil</h3>
      <form id="profile-form" class="grid" style="gap:10px"><label class="f">Name<input type="text" name="name" value="${esc(u.name)}" required maxlength="120"></label>
        <label class="f">E-Mail<input type="email" value="${esc(u.email)}" disabled></label>
        <label class="f">Startseite<select name="home">${homeOptions().map(([v, l]) => `<option value="${esc(v)}" ${(u.home || "") === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <label class="row nowrap small"><input type="checkbox" name="notifyTeams" ${u.notifyTeams !== false ? "checked" : ""}> Benachrichtigungen auch in Microsoft Teams (Aktivität 🔔), sofern eingerichtet</label>
        <label class="row nowrap small"><input type="checkbox" name="notifyEmail" ${u.notifyEmail !== false ? "checked" : ""}> Benachrichtigungen zusätzlich per E-Mail erhalten${sync.mail ? "" : ' <span class="muted">(E-Mail-Versand ist noch nicht eingerichtet)</span>'}</label>
        <div><button class="btn primary" type="submit">Speichern</button></div></form>
      <h3 style="font-size:15px;margin:20px 0 10px">Passwort ändern</h3>
      <form id="password-form" class="grid" style="gap:10px"><input type="password" name="current" placeholder="Aktuelles Passwort" autocomplete="current-password" required aria-label="Aktuelles Passwort">
        <input type="password" name="next" placeholder="Neues Passwort (mind. 10 Zeichen)" minlength="10" autocomplete="new-password" required aria-label="Neues Passwort">
        <input type="password" name="repeat" placeholder="Neues Passwort wiederholen" minlength="10" autocomplete="new-password" required aria-label="Neues Passwort wiederholen">
        <div><button class="btn" type="submit">Passwort ändern</button></div></form>
      <h3 id="sec-devices" style="font-size:15px;margin:20px 0 6px">Angemeldete Geräte</h3>
      ${(() => { const d = ui.mySessions; if (!d) { if (!ui.mySessionsLoading) { ui.mySessionsLoading = true; api("/api/me/sessions").then((r) => { ui.mySessions = r.sessions; }).catch(() => { ui.mySessions = "n/a"; }).finally(() => { ui.mySessionsLoading = false; if (route().parts[0] === "settings") render(); }); } return '<p class="small muted">Lade …</p>'; }
        if (d === "n/a") return '<p class="small muted" style="margin:0">Die Geräteübersicht gibt es in der Server-Version.</p>';
        return `${d.map((x) => `<div class="row nowrap" style="padding:6px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0"><div class="b trunc">${esc(x.device)}${x.current ? ' <span class="chip green">dieses Gerät</span>' : ""}</div><div class="small muted">aktiv ${ago(new Date(x.lastSeen).toISOString())}${x.ip ? ` · ${esc(x.ip)}` : ""} · angemeldet seit ${fmtDay(dayKey(new Date(x.createdAt)))}</div></div>${x.current ? "" : `<button class="btn subtle sm" data-act="session-revoke" data-id="${x.id}">Abmelden</button>`}</div>`).join("")}
          ${d.length > 1 ? `<div style="margin-top:8px"><button class="btn sm" data-act="session-revoke-others">Alle anderen Geräte abmelden</button></div>` : ""}`; })()}
      <h3 id="sec-calendar" style="font-size:15px;margin:20px 0 6px">Outlook-Kalender abonnieren</h3>
      ${(() => { const c = ui.calFeed; if (!c) { if (!ui.calFeedLoading) { ui.calFeedLoading = true; api("/api/me/calendar").then((r) => { ui.calFeed = r; if (route().parts[0] === "settings") render(); }).catch(() => {}); } return '<p class="small muted">Lade …</p>'; }
        if (c.standalone) return '<p class="small muted" style="margin:0">Das Kalender-Abo gibt es in der Server-Version.</p>';
        return `<p class="small muted" style="margin:0 0 6px">Ihre Einsätze, Fristen (mit Erinnerung am Vortag) und Abwesenheiten erscheinen als eigener Kalender in Outlook – auf PC, im Web und auf dem Handy.</p>
        <div class="secret"><code>${esc(c.url)}</code><button class="btn sm" data-act="copy" data-v="${esc(c.url)}">Kopieren</button></div>
        <div class="row" style="margin-top:8px"><a class="btn sm primary" href="${esc(c.webcal)}">In Outlook öffnen</a><button class="btn sm" data-act="copy" data-v="${esc(c.teamUrl)}">Team-Kalender kopieren</button><button class="btn subtle sm" data-act="cal-reset">Neuen Link erzeugen</button></div>
        <details class="ihelp"><summary>So geht's in Outlook</summary><ol><li><b>Outlook im Web / neues Outlook:</b> Kalender → „Kalender hinzufügen“ → „Aus dem Internet abonnieren“ → Link einfügen, Namen vergeben.</li>
          <li><b>Klassisches Outlook (Windows):</b> Kalender → „Kalender hinzufügen“ → „Aus dem Internet …“ → Link einfügen.</li><li><b>iPhone/Android:</b> erscheint automatisch, wenn das Outlook-Konto auf dem Handy eingerichtet ist.</li>
          <li>Outlook aktualisiert abonnierte Kalender selbst (je nach Version alle paar Stunden). Sofort und mit Erinnerung im eigenen Kalender erscheinen Einsätze, wenn die Administration die Outlook-Kalender-Anbindung eingeschaltet hat.</li>
          <li>Der Link ist persönlich – nicht weitergeben. Bei Bedarf „Neuen Link erzeugen“, dann ist der alte ungültig.</li></ol></details>`; })()}
      <h3 id="sec-outlook" style="font-size:15px;margin:20px 0 6px">Outlook-Add-in</h3>
      ${(() => { const o = ui.outlook; if (!o) { if (!ui.outlookLoading) { ui.outlookLoading = true; api("/api/me/outlook").then((r) => { ui.outlook = r; if (route().parts[0] === "settings") render(); }).catch(() => { ui.outlook = { standalone: true }; }); } return '<p class="small muted">Lade …</p>'; }
        if (o.standalone) return '<p class="small muted" style="margin:0">Das Outlook-Add-in gibt es in der Server-Version.</p>';
        return `<p class="small muted" style="margin:0 0 6px">In jeder E-Mail in Outlook: Kunde zum Absender mit offenen Vorgängen sehen, mit einem Klick einen Vorgang anlegen (inkl. Anhänge) oder die Mail an einen Vorgang hängen.</p>
        <p class="small" style="margin:0 0 8px">${o.key ? `✓ Verbunden seit ${fmtDT(new Date(o.key.created_at).toISOString())}${o.key.last_used_at ? ` · zuletzt genutzt ${fmtDT(new Date(o.key.last_used_at).toISOString())}` : ""}` : "Noch nicht verbunden."}</p>
        <div class="row"><button class="btn sm primary" data-act="outlook-token">${o.key ? "Neuen Zugangsschlüssel erzeugen" : "Zugangsschlüssel erzeugen"}</button><a class="btn sm" href="/outlook/manifest.xml">Manifest herunterladen</a></div>
        <details class="ihelp"><summary>Add-in in Outlook hinzufügen</summary><ol>
          <li><b>Für alle auf einmal (empfohlen, Administration):</b> Microsoft 365 Admin Center → Einstellungen → <i>Integrierte Apps</i> → „Benutzerdefinierte Apps hochladen“ → App-Typ „Office-Add-in“ → Manifest-URL <code class="copy" data-act="copy" data-v="${esc(o.manifestUrl)}">${esc(o.manifestUrl)}</code>. Nach einigen Stunden erscheint „GF Tracker“ bei allen.</li>
          <li><b>Nur für mich:</b> In Outlook im Web / neuem Outlook <code>aka.ms/olksideload</code> öffnen → „Meine Add-Ins“ → „Benutzerdefiniertes Add-In hinzufügen“ → „Aus Datei“ → heruntergeladenes Manifest wählen.</li>
          <li>Eine E-Mail öffnen → in der Menüleiste <b>GF Tracker</b> (ggf. unter „Apps“ / „…“) → Zugangsschlüssel einfügen. Die Anmeldung gilt danach auf allen Geräten mit diesem Outlook-Konto.</li>
          ${o.https ? "" : "<li><b>Hinweis:</b> Outlook verlangt eine HTTPS-Adresse (APP_URL mit https://).</li>"}</ol></details>`; })()}
      <h3 id="sec-app" style="font-size:15px;margin:20px 0 6px">Als App nutzen</h3>
      ${location.protocol.startsWith("http") ? `<div class="row nowrap" style="align-items:flex-start;gap:14px;margin-bottom:8px"><div class="qr-box">${(() => { try { return QR.svg(location.origin + "/", { size: 132 }); } catch { return ""; } })()}</div><p class="small muted" style="margin:0;line-height:1.6"><b>Aufs Handy holen:</b> QR-Code mit der Kamera scannen, anmelden und dann „Zum Home-Bildschirm“ (iPhone) bzw. „App installieren“ (Android) wählen.<br><span class="small">${esc(location.origin)}</span></p></div>` : ""}
      ${isStandalone() ? '<p class="small muted" style="margin:0">Sie nutzen den GF Tracker bereits als installierte App. ✓</p>'
        : `${installPrompt ? `<button class="btn primary" data-act="install-app">${icon("download")} GF Tracker als App installieren</button>` : ""}
        <p class="small muted" style="margin:6px 0 0;line-height:1.6"><b>PC (Edge/Chrome):</b> in der Adresszeile auf das Symbol „App installieren“ klicken bzw. Menü ⋯ → Apps → „Diese Website als App installieren“. Danach eigenes Fenster, Startmenü- und Taskleisten-Eintrag.<br>
        <b>iPhone/iPad:</b> in Safari „Teilen“ → „Zum Home-Bildschirm“. <b>Android:</b> Chrome-Menü → „App installieren“.</p>`}
      <h3 style="font-size:15px;margin:20px 0 6px">Tastenkürzel</h3><div class="small" style="line-height:2"><span class="kbd">c</span> Vorgang erstellen · <span class="kbd">/</span> Suche · <span class="kbd">Esc</span> Schließen · <span class="kbd">Strg</span>+<span class="kbd">Enter</span> Kommentar senden</div></div>
    <div class="card pad"><h3 id="sec-people" style="font-size:15px;margin-bottom:10px">Personen</h3>
      ${(() => { if (isAdmin && !ui.accounts && !ui.accountsLoading) { ui.accountsLoading = true; api("/api/admin/accounts").then((r) => { ui.accounts = r; }).catch(() => { ui.accounts = { standalone: true, accounts: {} }; }).finally(() => { ui.accountsLoading = false; if (route().parts[0] === "settings") render(); }); } return ""; })()}
      ${db.users.map((x) => `<div class="row nowrap" style="padding:7px 0;border-bottom:1px solid var(--border);${x.active ? "" : "opacity:.5"}">${avatar(x.id)}<div style="flex:1;min-width:0"><div class="b trunc">${esc(x.name)}</div><div class="small muted trunc">${esc(x.email)}</div>${isAdmin ? accountLine(x) : ""}</div>
        ${isAdmin ? `<select style="width:auto" data-act="user-role" data-id="${x.id}" ${x.id === u.id ? "disabled" : ""}>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === x.role ? "selected" : ""}>${v}</option>`).join("")}</select>
        <button class="btn subtle sm" data-act="user-scope" data-id="${x.id}" title="Sichtbereich" ${FULL_ACCESS.has(x.role) ? "disabled" : ""}>${userScope(x) === "all" ? "Alle Projekte" : "Eigener Bereich"}</button>
        <label class="small row nowrap"><input type="checkbox" data-act="user-active" data-id="${x.id}" ${x.active ? "checked" : ""} ${x.id !== u.id ? "" : "disabled"}> aktiv</label>
        ${accountMenu(x)}` : `<span class="small muted">${ROLES[x.role] || x.role}</span>`}</div>`).join("")}
      ${isAdmin ? `<h3 style="font-size:15px;margin:16px 0 8px">Person hinzufügen</h3><form id="user-form" class="grid g2" style="gap:8px"><input type="text" name="name" placeholder="Name" required aria-label="Name"><input type="email" name="email" placeholder="E-Mail" required aria-label="E-Mail">
        <select name="role" aria-label="Rolle">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === "MEMBER" ? "selected" : ""}>${v}</option>`).join("")}</select><input type="text" name="password" placeholder="Startpasswort – leer lassen für Einladung" minlength="10" aria-label="Startpasswort (optional)">
        <div style="grid-column:1/-1" class="row"><button class="btn primary" type="submit">${icon("plus")} Person anlegen</button><span class="small muted">Ohne Startpasswort erhält die Person einen Einladungslink${sync.mail ? " per E-Mail" : " zum Weitergeben"} und legt ihr Passwort selbst fest.</span></div></form>
        <details class="ihelp"><summary>Rollen und Sichtbereiche</summary><ul style="margin:6px 0 0;padding-left:18px">${Object.entries(ROLES).map(([k, v]) => `<li><b>${v}</b> – ${ROLE_INFO[k]}</li>`).join("")}</ul>
          <p class="small muted" style="margin:6px 0 0"><b>Eigener Bereich</b> = Projekte der eigenen Teams (bzw. als Projektleitung) + zusätzlich freigegebene Projekte + alles, was der Person zugewiesen ist, was sie gemeldet hat oder beobachtet. Einstellbar je Person über „Bereich“.</p></details>` : '<p class="small muted">Personen verwalten nur Administratoren.</p>'}</div>
    <div class="card pad"><div class="row" style="margin-bottom:6px"><h3 style="font-size:15px;flex:1">Teams</h3>${isAdmin ? `<button class="btn sm" data-act="team-new">${icon("plus")} Team anlegen</button>` : ""}</div>
      ${db.teams.map((t) => `<div class="row nowrap" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="tavatar sm" style="--tc:${t.color}">${esc(teamInitials(t.name))}</span><div style="flex:1;min-width:0"><a href="#/teams/${t.id}" class="b trunc">${esc(t.name)}</a><div class="small muted trunc">Leitung: ${esc(t.leadId ? uname(t.leadId) : "–")}</div></div><span class="avatars">${teamMembers(t).map((u) => avatar(u.id)).join("")}</span>${canManageTeam(t) ? `<button class="btn subtle sm" data-act="team-edit" data-id="${t.id}">Bearbeiten</button>` : ""}</div>`).join("") || '<p class="small muted">Noch keine Teams.</p>'}
      <p class="small muted">Teams bündeln Personen, die sich abstimmen. Vorgänge mit Team, aber ohne verantwortliche Person, landen im <b>Team-Eingang</b> – alle Mitglieder werden benachrichtigt und sehen sie unter „Mein Tag“.</p></div>
    ${isAdmin ? `<div class="card pad" style="grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="font-size:15px;margin:0 0 4px">Integrationen &amp; Schnittstellen</h3><p class="small muted" style="margin:0">Microsoft 365 (E-Mail, Postfach, Kalender, Anmeldung), Factorial, REST-API für Ihre Programme, Webhooks für Teams, Datenimport.</p></div><a class="btn primary" href="#/integrations">Integrationen öffnen</a></div>` : ""}
    ${isAdmin ? brandCard() : ""}
    ${isAdmin ? `<div class="card pad" style="grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="font-size:15px;margin:0 0 4px">System &amp; Protokoll</h3><p class="small muted" style="margin:0">Sicherungen (Datenbank und Anhänge), Speicher, Auslastung, Fehler und das Audit-Protokoll: wer hat wann was geändert.</p></div><a class="btn" href="#/system">System öffnen</a></div>` : ""}
    ${isAdmin ? `<div class="card pad" style="grid-column:1/-1;display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3 style="font-size:15px;margin:0 0 4px">Automatik</h3><p class="small muted" style="margin:0">Regeln für den Arbeitsablauf: neue Vorgänge automatisch im Team verteilen, liegengebliebene eskalieren, Wiedervorlagen („Wartet auf Kunde“ nachfassen).</p></div><a class="btn" href="#/automation">Regeln öffnen</a></div>` : ""}
    ${isAdmin ? `<div class="card pad"><h3 style="font-size:15px;margin-bottom:6px">Daten &amp; Sicherung</h3>${window.GFTLocal ? localStorageInfo() : `<p class="small muted" style="margin:0 0 12px">Der Server sichert die Datenbank automatisch jede Nacht (Ordner <code>data/backups</code>). Zusätzlich können Sie hier eine Sicherung herunterladen oder eine Sicherung bzw. Daten aus der Einzel-HTML-Version (inkl. Anhänge) einspielen.</p>`}
      <div class="row"><button class="btn" data-act="export-json">${icon("download")} Sicherung herunterladen</button><button class="btn" data-act="import-json">${icon("upload")} Sicherung einspielen</button><input type="file" id="json-file" accept=".json,application/json" hidden><button class="btn" data-act="goto" data-href="#/import">${icon("upload")} Daten importieren (Excel/CSV)</button><button class="btn primary" data-act="export-all-xlsx">${icon("download")} Excel-Auswertung (alle Daten)</button><button class="btn" data-act="export-all-csv">${icon("download")} Alle Vorgänge (CSV)</button></div>
      <h3 style="font-size:15px;margin:18px 0 6px">E-Mail-Versand</h3><p class="small muted" style="margin:0 0 8px">${sync.mail ? "Eingerichtet über Microsoft 365." : "Nicht eingerichtet – Benachrichtigungen erscheinen nur in der App. Einrichtung siehe ARCHITEKTUR.md (Microsoft-365-App-Registrierung)."}</p>
      ${sync.mail ? `<button class="btn" data-act="mail-test">Test-E-Mail an mich senden</button>` : ""}
      <h3 style="font-size:15px;margin:18px 0 6px">Kundenportal auf Ihrer Website</h3><p class="small muted" style="margin:0 0 8px">Öffentliche Adresse: <a href="/portal" target="_blank" rel="noopener">${esc(location.origin)}/portal</a> – als Link/Button „Störung melden“ verwenden oder direkt in eine Seite einbetten:</p>
      <textarea id="embed-code" class="jql" rows="3" readonly>&lt;iframe src="${esc(location.origin)}/portal?embed=1" title="Service-Portal" style="width:100%;min-height:900px;border:0" loading="lazy"&gt;&lt;/iframe&gt;</textarea>
      <div class="row" style="margin-top:6px"><button class="btn sm" data-act="copy-embed">Code kopieren</button><span class="small muted">Für das Einbetten muss Ihre Website-Adresse in <code>PORTAL_FRAME_ANCESTORS</code> stehen (siehe ARCHITEKTUR.md).</span></div></div>` : `<div class="card pad"><h3 style="font-size:15px;margin-bottom:6px">Export</h3><button class="btn" data-act="goto" data-href="#/import">${icon("upload")} Daten importieren (Excel/CSV)</button><button class="btn primary" data-act="export-all-xlsx">${icon("download")} Excel-Auswertung (alle Daten)</button><button class="btn" data-act="export-all-csv">${icon("download")} Alle Vorgänge (CSV)</button></div>`}
    </div>`;
}

/* ---------- Ansicht: Automatik-Regeln (Administration) ---------- */
function loadAutomation() {
  ui.autoLoading = true;
  api("/api/admin/automation").then((r) => { ui.auto = r; }).catch((e) => { ui.auto = { error: e.status === 404 ? "Die Automatik läuft auf dem Server und gibt es in der Server-Version." : e.message }; })
    .finally(() => { ui.autoLoading = false; if (route().parts[0] === "automation") render(); });
}
const allStatuses = () => { const m = new Map(); for (const p of db.projects) for (const st of workflowOf(p)) if (!m.has(st.id) && st.cat !== "done") m.set(st.id, st.name); return [...m]; };
function ruleText(r) {
  const pk = r.projectId ? proj(r.projectId)?.key || "?" : "allen Projekten"; const A = ui.auto;
  if (r.kind === "assign") return `Neue ${r.types?.length ? r.types.map((t) => TYPES[t]?.label || t).join(", ") : "Vorgänge"} in ${pk} ohne Verantwortliche gehen ${r.method === "load" ? "an die Person mit den wenigsten offenen Vorgängen" : "reihum"} im Team ${r.teamId ? `„${team(r.teamId)?.name || "?"}“` : "des Vorgangs"} – heute Abwesende werden übersprungen.`;
  if (r.kind === "escalate") return `Wenn „${A.triggers[r.trigger]}“${r.trigger === "sla" ? "" : ` seit ${r.hours} Std.`}${r.minPriority ? ` (ab Priorität ${PRIOS[r.minPriority].label})` : ""} in ${pk}: ${[r.raise && "Priorität erhöhen", r.label && "Label „eskaliert“", r.notifyLead && "Projekt-/Teamleitung benachrichtigen", r.notifyUserId && `${uname(r.notifyUserId)} benachrichtigen`].filter(Boolean).join(", ") || "Verlauf vermerken"} – einmal je Vorgang.`;
  return `Wenn ein Vorgang in ${pk} ${r.status ? `seit ${r.days} Tagen „${allStatuses().find(([k]) => k === r.status)?.[1] || r.status}“ ist` : `seit ${r.days} Tagen unverändert ist`}: Verantwortliche erinnern${r.comment ? " und interne Notiz schreiben" : ""}${r.repeat ? `, alle ${r.days} Tage wiederholen` : ""}.`;
}
function viewAutomation() {
  if (me().role !== "ADMIN") return `<div class="empty">Nur für Administratoren.</div>`;
  const A = ui.auto; const head = (extra = "") => `<div class="page-head"><div><div class="crumbs"><a href="#/settings">Einstellungen</a></div><h1>Automatik</h1></div>${extra}</div>`;
  if (!A) { if (!ui.autoLoading) loadAutomation(); return head() + '<p class="muted">Lade …</p>'; }
  if (A.error) return head() + `<div class="card pad">${esc(A.error)}</div>`;
  const kindIcon = { assign: "👤", escalate: "⚠️", remind: "⏰" };
  return head(`<div class="row"><button class="btn" data-act="rule-run">Jetzt prüfen</button><details class="menu-d"><summary class="btn primary">${icon("plus")} Neue Regel ▾</summary><div class="menu-pop">${Object.entries(A.kinds).map(([k, v]) => `<button data-act="rule-new" data-kind="${k}">${kindIcon[k]} ${esc(v)}</button>`).join("")}</div></details></div>`) + `
    <p class="muted" style="margin:-6px 0 14px;max-width:820px">Regeln nehmen Routinearbeit ab: neue Vorgänge automatisch verteilen, liegengebliebene eskalieren und an Wiedervorlagen erinnern. Der Server prüft jede Minute; jede Regel greift je Vorgang nur einmal (Wiedervorlagen auf Wunsch wiederholt). Alles steht im Verlauf des Vorgangs.</p>
    ${A.rules.length ? A.rules.map((r) => `<div class="card pad row nowrap" style="margin-bottom:10px;align-items:flex-start;${r.enabled ? "" : "opacity:.6"}"><span style="font-size:20px;line-height:1">${kindIcon[r.kind]}</span>
      <div style="flex:1;min-width:0"><div class="row" style="gap:8px"><b>${esc(r.name)}</b><span class="chip gray">${esc(A.kinds[r.kind])}</span>${r.enabled ? "" : '<span class="chip">pausiert</span>'}</div><div class="small muted" style="margin-top:4px">${esc(ruleText(r))}</div></div>
      <label class="small row nowrap"><input type="checkbox" data-act="rule-toggle" data-id="${r.id}" ${r.enabled ? "checked" : ""}> aktiv</label><button class="btn subtle sm" data-act="rule-edit" data-id="${r.id}">Bearbeiten</button><button class="btn subtle sm icon" data-act="rule-del" data-id="${r.id}" aria-label="Regel löschen">${icon("trash")}</button></div>`).join("")
      : `<div class="empty">Noch keine Regeln. Beispiele: <b>Störungen reihum im Service-Team verteilen</b> · <b>Unzugewiesene Anfragen nach 2 Stunden eskalieren</b> · <b>„Wartet auf Kunde“ nach 3 Tagen nachfassen</b>.</div>`}
    <div class="card pad" style="margin-top:14px"><h3 class="h3">Zuletzt ausgeführt</h3>
      ${A.recent.length ? `<div class="tbl-wrap"><table><tbody>${A.recent.map((x) => `<tr${x.key ? ` class="click" data-act="open" data-id="${x.issue_id}"` : ""}><td class="small nowrap">${fmtTs(x.at)}</td><td class="small">${esc(x.rule)}</td><td class="key small">${esc(x.key || "–")}</td><td class="small trunc" style="max-width:340px">${esc(x.summary || "")}</td><td class="small muted">${esc(x.action || "")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="small muted" style="margin:0">Noch nichts ausgeführt.</p>'}</div>`;
}
function ruleForm(r) {
  const A = ui.auto; const isNew = !r.id; const pOpts = (all) => `${all ? '<option value="">Alle Projekte</option>' : ""}${db.projects.map((p) => `<option value="${p.id}" ${r.projectId === p.id ? "selected" : ""}>${esc(p.key)} – ${esc(p.name)}</option>`).join("")}`;
  const k = r.kind; let body = "";
  if (k === "assign") body = `<label class="f">Projekt<select name="projectId" required>${pOpts(false)}</select></label>
    <div class="f"><span>Nur für Vorgangstypen <span class="muted small">(keine Auswahl = alle)</span></span><div class="row" style="gap:10px">${Object.entries(TYPES).filter(([t]) => t !== "EPIC" && t !== "SUBTASK").map(([t, v]) => `<label class="small row nowrap"><input type="checkbox" name="types" value="${t}" ${r.types?.includes(t) ? "checked" : ""}> ${esc(v.label)}</label>`).join("")}</div></div>
    <label class="f">Verteilen im Team<select name="teamId"><option value="">Team des Vorgangs bzw. Projekts</option>${db.teams.map((t) => `<option value="${t.id}" ${r.teamId === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
    <div class="f"><span>Verfahren</span><label class="small row nowrap"><input type="radio" name="method" value="round" ${r.method !== "load" ? "checked" : ""}> Reihum (gleichmäßig nacheinander)</label><label class="small row nowrap"><input type="radio" name="method" value="load" ${r.method === "load" ? "checked" : ""}> Geringste Auslastung (wenigste offene Vorgänge)</label></div>`;
  if (k === "escalate") body = `<label class="f">Projekt<select name="projectId">${pOpts(true)}</select></label>
    <div class="grid g2" style="gap:10px"><label class="f">Auslöser<select name="trigger">${Object.entries(A.triggers).map(([t, v]) => `<option value="${t}" ${r.trigger === t ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
      <label class="f">nach … Stunden <span class="muted small">(nicht bei SLA)</span><input type="number" name="hours" min="0" max="2160" value="${r.hours ?? 4}"></label></div>
    <label class="f">Nur ab Priorität<select name="minPriority"><option value="">alle Prioritäten</option>${Object.entries(PRIOS).map(([p, v]) => `<option value="${p}" ${r.minPriority === p ? "selected" : ""}>${esc(v.label)}</option>`).join("")}</select></label>
    <div class="f"><span>Dann</span><label class="small row nowrap"><input type="checkbox" name="raise" ${r.raise ? "checked" : ""}> Priorität um eine Stufe erhöhen</label><label class="small row nowrap"><input type="checkbox" name="label" ${r.label !== false ? "checked" : ""}> Label „eskaliert“ setzen</label><label class="small row nowrap"><input type="checkbox" name="notifyLead" ${r.notifyLead !== false ? "checked" : ""}> Projekt- und Teamleitung benachrichtigen (plus Verantwortliche)</label></div>
    <label class="f">Zusätzlich benachrichtigen<select name="notifyUserId"><option value="">niemanden</option>${db.users.filter((u) => u.active).map((u) => `<option value="${u.id}" ${r.notifyUserId === u.id ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>`;
  if (k === "remind") body = `<label class="f">Projekt<select name="projectId">${pOpts(true)}</select></label>
    <div class="grid g2" style="gap:10px"><label class="f">Status<select name="status"><option value="">beliebig – keine Änderung</option>${allStatuses().map(([id, n]) => `<option value="${id}" ${r.status === id ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label class="f">seit … Tagen<input type="number" name="days" min="1" max="365" value="${r.days ?? 3}" required></label></div>
    <label class="small row nowrap"><input type="checkbox" name="repeat" ${r.repeat ? "checked" : ""}> alle … Tage wiederholen, solange sich nichts ändert</label>
    <label class="f">Interne Notiz im Vorgang <span class="muted small">(optional)</span><textarea name="comment" rows="2" placeholder="z. B. Bitte beim Kunden nachfragen, ob das Problem behoben ist.">${esc(r.comment || "")}</textarea></label>`;
  openModal(`<div class="modal-h"><h2>${isNew ? "Neue Regel" : "Regel bearbeiten"}: ${esc(A.kinds[k])}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="rule-form" data-id="${r.id || ""}" data-kind="${k}"><div class="modal-b grid" style="gap:12px"><label class="f">Name<input type="text" name="name" value="${esc(r.name || "")}" maxlength="120" placeholder="${esc(A.kinds[k])}" required></label>${body}</div>
    <div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div></form>`);
}
function saveRules(rules, runNow = false) {
  return api("/api/admin/automation", { method: "PUT", body: { rules, runNow } }).then((r) => { ui.auto = { ...ui.auto, rules: r.rules, recent: r.recent }; render(); return r; });
}

/* ---------- Ansicht: System & Protokoll (Administration) ---------- */
const fmtBytes = (n) => (n >= 1073741824 ? `${(n / 1073741824).toFixed(1).replace(".", ",")} GB` : fmtSize(n || 0));
function loadSystem() {
  ui.sysLoading = true;
  Promise.all([api("/api/admin/system"), api(`/api/admin/audit?${new URLSearchParams(ui.auditQ || {})}`)])
    .then(([sys, a]) => { ui.sys = sys; ui.audit = a; }).catch((e) => { ui.sys = { error: e.status === 404 ? "Systemstatus und Protokoll gibt es in der Server-Version." : e.message }; })
    .finally(() => { ui.sysLoading = false; if (route().parts[0] === "system") render(); });
}
function viewSystem() {
  if (me().role !== "ADMIN") return `<div class="empty">Nur für Administratoren.</div>`;
  const y = ui.sys; if (!y) { if (!ui.sysLoading) loadSystem(); return `<div class="page-head"><h1>System &amp; Protokoll</h1></div><p class="muted">Lade …</p>`; }
  if (y.error) return `<div class="page-head"><h1>System &amp; Protokoll</h1></div><div class="card pad">${esc(y.error)}</div>`;
  const tile = (v, l, sub = "", warn = false) => `<div class="card stat"${warn ? ' style="border-left:3px solid var(--danger,#c9372c)"' : ""}><div class="v">${v}</div><div class="l">${l}</div>${sub ? `<div class="small muted">${sub}</div>` : ""}</div>`;
  const lastB = y.backups.last; const bAge = lastB ? (Date.now() - lastB.at) / 36e5 : Infinity; const diskLow = y.disk && y.disk.free < 2 * 1073741824;
  const A = ui.audit || { entries: [], actions: {} }; const q = ui.auditQ || {};
  return `<div class="page-head"><div><div class="crumbs"><a href="#/settings">Einstellungen</a></div><h1>System &amp; Protokoll</h1></div><button class="btn" data-act="sys-reload">Aktualisieren</button></div>
    <div class="grid g4" style="margin-bottom:14px">
      ${tile(esc(y.version), "Version", `Node ${esc(y.node)}`)}
      ${tile(ago(new Date(y.startedAt).toISOString()).replace(/^vor /, ""), "Server läuft seit", fmtDT(new Date(y.startedAt).toISOString()))}
      ${tile(`${y.online}`, "Gerade online", `${y.activeToday} Personen heute aktiv · ${y.sessions.n} Sitzungen`)}
      ${tile(lastB ? ago(new Date(lastB.at).toISOString()) : "nie", "Letzte Sicherung", lastB ? `${esc(lastB.file)}` : "", bAge > 26)}
      ${tile(fmtBytes(y.db.bytes + y.db.wal), "Datenbank", `Schema-Version ${y.schema}`)}
      ${tile(`${y.files.count}`, "Anhänge", fmtBytes(y.files.bytes))}
      ${tile(fmtBytes(y.memory.rss), "Arbeitsspeicher", `davon Daten ${fmtBytes(y.memory.heap)}`)}
      ${tile(y.disk ? fmtBytes(y.disk.free) : "–", "Freier Plattenplatz", y.disk ? `von ${fmtBytes(y.disk.total)}${diskLow ? " – bitte aufräumen!" : ""}` : "", diskLow)}
    </div>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="card pad"><div class="row" style="margin-bottom:8px"><h3 class="h3" style="flex:1;margin:0">Sicherungen</h3><button class="btn sm primary" data-act="sys-backup">Jetzt sichern</button></div>
        <p class="small muted" style="margin:0 0 8px">Jede Nacht automatisch: Datenbank-Kopie (die letzten ${y.backups.keep} bleiben) und alle Anhänge (${y.backups.mirror.count} Dateien, ${fmtBytes(y.backups.mirror.bytes)}) in <code>data/backups</code>. Diesen Ordner zusätzlich außerhalb des Servers sichern (NAS/Cloud).</p>
        <div class="tbl-wrap" style="max-height:260px;overflow:auto"><table><tbody>${y.backups.list.map((b) => `<tr><td class="small">${esc(b.name)}</td><td class="small muted">${fmtTs(b.at)}</td><td class="small muted">${fmtBytes(b.bytes)}</td><td><a class="btn subtle sm" href="${authUrl(`/api/admin/backups/${encodeURIComponent(b.name)}`)}" download>Herunterladen</a></td></tr>`).join("") || '<tr><td class="muted small">Noch keine Sicherung.</td></tr>'}</tbody></table></div></div>
      <div class="card pad"><h3 class="h3">Daten &amp; Leistung</h3>
        <div class="kv" style="grid-template-columns:max-content 1fr">${[["Vorgänge", `${y.counts.issues}${y.snapshot ? ` · ${y.snapshot.archived} im Archiv (älter als ${y.archiveDays} Tage erledigt)` : ""}`], ["Kunden", y.counts.customers], ["Personen / Teams", `${y.counts.users} / ${y.counts.teams}`], ["Projekte", y.counts.projects], ["Benachrichtigungen", y.counts.notifications],
          ["Startdaten", y.snapshot ? `${fmtBytes(y.snapshot.gz)} übertragen (${fmtBytes(y.snapshot.bytes)} entpackt), erstellt in ${y.snapshot.ms} ms` : "–"], ["Webhooks", `${y.webhooks.pending || 0} wartend · ${y.webhooks.failed || 0} fehlgeschlagen`], ["E-Mail-Versand", y.mail ? "eingerichtet" : "nicht eingerichtet"]]
          .map(([k, v]) => `<span>${k}</span><span>${esc(String(v))}</span>`).join("")}</div>
        ${y.errors.length ? `<h3 class="h3" style="margin-top:14px">Fehler der letzten 7 Tage</h3>${y.errors.map((e) => `<div class="small" style="padding:4px 0;border-bottom:1px solid var(--border)"><span class="muted">${fmtTs(e.at)} · ${esc(e.source)}</span><br>${esc(e.message)}</div>`).join("")}` : '<p class="small muted" style="margin-top:12px">✓ Keine Fehler in den letzten 7 Tagen.</p>'}</div>
    </div>
    <div class="card pad"><h3 class="h3">Audit-Protokoll</h3><p class="small muted" style="margin:0 0 8px">Wer hat wann was Wichtiges getan: Anmeldungen, Personen und Rechte, Löschungen, Schlüssel, Einstellungen, Sicherungen. Einträge bleiben 2 Jahre.</p>
      <form id="audit-form" class="row" style="margin-bottom:8px"><input type="search" name="q" value="${esc(q.q || "")}" placeholder="Suchen: Person, E-Mail, Vorgang, IP" style="width:min(320px,100%)" aria-label="Protokoll durchsuchen">
        <select name="action" style="width:auto" aria-label="Art"><option value="">Alle Arten</option>${Object.entries(A.actions).map(([k, v]) => `<option value="${k}" ${q.action === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select><button class="btn" type="submit">Filtern</button></form>
      <div class="tbl-wrap"><table><thead><tr><th>Zeit</th><th>Person</th><th>Aktion</th><th>Details</th><th class="hide-m">IP</th></tr></thead><tbody>
        ${A.entries.map((e) => `<tr><td class="small nowrap">${fmtTs(e.at)}</td><td class="small">${esc(e.user_name || "–")}</td><td><span class="chip ${e.action === "login.failed" || e.action === "delete" ? "red" : e.action.startsWith("login") || e.action === "logout" ? "gray" : "blue"}">${esc(A.actions[e.action] || e.action)}</span></td><td class="small">${esc(e.detail || "")}</td><td class="small muted hide-m">${esc(e.ip || "")}</td></tr>`).join("") || '<tr><td colspan="5" class="muted small">Keine Einträge.</td></tr>'}</tbody></table>
        ${A.entries.length >= 100 ? `<div class="row" style="justify-content:center;padding:10px"><button class="btn sm" data-act="audit-more">Ältere Einträge</button></div>` : ""}</div></div>`;
}

/* ---------- Vorgang: Detailansicht ---------- */
function openModal(html, wide = false, kind = "form") {
  const m = $("#modal");
  if (!ui.modal && document.activeElement && document.activeElement !== document.body) ui.modalReturnFocus = document.activeElement;
  m.className = "modal open" + (wide ? " wide" : ""); m.innerHTML = html; m.scrollTop = 0; m.tabIndex = -1; ui.modal = kind; ui.modalDirty = false;
  $("#overlay").classList.add("open"); document.body.classList.add("modal-open");
  setTimeout(() => { if (!m.contains(document.activeElement)) m.focus({ preventScroll: true }); }, 40);
}
/* ---------- Hauptmenü (☰): alle Bereiche und Funktionen auf einen Blick ---------- */
// Breite Bildschirme: dauerhaft sichtbare Seitenleiste (☰ klappt sie ein/aus); schmal: ausklappbares Menü
const dockMQ = matchMedia("(min-width: 1180px)");
const docked = () => dockMQ.matches && localState.sidenav !== false;
function renderSidenav() {
  const el = $("#sidenav"); if (!el) return;
  const on = docked(); document.body.classList.toggle("has-sidenav", on); el.hidden = !on; if (!on) return;
  const a = document.activeElement; if (a && a.id === "drawer-q" && el.contains(a) && a.value) return; // Suche im Menü nicht beim Tippen überschreiben
  el.innerHTML = drawerHtml({ docked: true });
}
dockMQ.addEventListener?.("change", () => { closeDrawer(); render(); });
function drawerHtml({ docked: dock = false } = {}) {
  const { parts, params } = route(); const cur = `#/${parts.join("/")}`; const admin = me().role === "ADMIN"; const meId = db.currentUserId;
  const mineOpen = db.issues.filter((i) => i.assigneeId === meId && !isDone(i)).length; const unassigned = db.issues.filter((i) => !i.assigneeId && !isDone(i) && i.type !== "EPIC").length;
  const overdue = db.issues.filter((i) => isOverdue(i) && (i.assigneeId === meId || i.reporterId === meId)).length;
  const it = (href, label, ic, { badge = 0, warn = false, act = "", data = "", ext = false, kw = "" } = {}) => {
    const on = href && (cur === href.split("?")[0] || (href.startsWith(cur + "?") && cur !== "#/filters"));
    const attrs = act ? `href="#" data-act="${act}" ${data}` : `href="${href}"${ext ? ' target="_blank" rel="noopener"' : ""}`;
    return `<a class="dr-item ${on ? "on" : ""}" ${attrs} data-kw="${esc(norm(`${label} ${kw}`))}">${icon(ic)}<span class="trunc">${esc(label)}</span>${badge ? `<span class="dr-badge ${warn ? "warn" : ""}">${badge}</span>` : ""}${ext ? '<span class="small muted">↗</span>' : ""}</a>`;
  };
  const sec = (title, body, open = true) => `<details class="dr-sec" ${open ? "open" : ""}><summary>${title}</summary>${body}</details>`;
  const projects = db.projects.map((p) => `<details class="dr-proj" ${parts[0] === "p" && parts[1] === p.key ? "open" : ""}><summary><span class="pavatar sm" style="background:${p.color}">${esc(p.key.slice(0, 3))}</span><span class="trunc">${esc(p.name)}</span><span class="dr-badge">${projIssues(p).filter((i) => !isDone(i) && i.type !== "EPIC").length}</span></summary>
      ${projectViews(p).map(([v, l, ic]) => it(`#/p/${p.key}/${v}`, l, ic, { kw: `${p.key} ${p.name}` })).join("")}</details>`).join("");
  const b = ui.brand || {}; const AUSWERTEN = sec(me().role === "MANAGEMENT" ? "Überblick &amp; Auswertungen" : "Suchen &amp; Auswerten", it("#/filters?state=open", "Suche", "search", { kw: "finden text" }) + DEFAULT_FILTERS.slice(0, 3).map((f) => it(`#/filters?filter=${f.id}`, f.name, "filter")).join("")
        + db.filters.map((f) => it(`#/filters?filter=${f.id}`, f.name, "star", { kw: "gespeichert filter" })).join("") + it("#/dashboard", "Dashboard", "chart", { kw: "kennzahlen quartal auswertung" }) + it(window.GFT_STANDALONE || !location.protocol.startsWith("http") ? "systemlandschaft.html" : "/landschaft", "Systemlandschaft (3D)", "layers", { kw: "3d digitale welt standorte programme landschaft karte level prozesse", ext: true })
        + it("", "Excel-Auswertung", "chart", { act: "export-all-xlsx", kw: "export xlsx bericht quartal" }));
  return `<div class="dr-head">${b.logo ? `<img class="brand-logo" src="${esc(b.logo)}" alt="">` : `<img class="app-icon" src="/icons/icon-64.png" alt="">`}<div class="trunc" style="flex:1"><div class="b trunc">${esc(b.appName || "GF Tracker")}</div><div class="small muted trunc">${esc(me().name)} · ${esc(ROLES[me().role] || "")}</div></div>${dock ? `<button class="btn subtle icon" data-act="menu" title="Seitenleiste einklappen" aria-label="Seitenleiste einklappen">«</button>` : `<button class="btn subtle icon" data-act="drawer-close" aria-label="Menü schließen">${icon("x")}</button>`}</div>
    <div class="dr-search">${icon("search")}<input type="search" id="drawer-q" placeholder="Funktion finden … (z. B. Import, Kunden, Board)" aria-label="Menü durchsuchen" autocomplete="off"></div>
    <nav class="dr-body">
      ${me().role === "MANAGEMENT" ? AUSWERTEN : ""}
      ${sec("Arbeiten", it("#/your-work", "Mein Tag", "home", { badge: mineOpen, kw: "start übersicht aufgaben" }) + it("#/your-work?tab=watching", "Beobachtet", "eye") + it("#/your-work?tab=recent", "Zuletzt angesehen", "clock")
        + it("", "Neuer Vorgang", "plus", { act: "create", kw: "erstellen anlegen ticket aufgabe" }) + it("#/filters?filter=f-overdue", "Überfällig", "alert", { badge: overdue, warn: true }) + it("#/filters?filter=f-unassigned", "Nicht zugewiesen", "users", { badge: unassigned }))}
      ${sec("Projekte", projects + it("#/projects", "Alle Projekte", "grid", { kw: "projekt anlegen übersicht" }))}
      ${sec("Teams", db.teams.map((t) => it(`#/teams/${t.id}`, t.name, "users", { badge: db.issues.filter((i) => i.teamId === t.id && !i.assigneeId && !isDone(i)).length, kw: "team eingang" })).join("") + it("#/teams", "Alle Teams", "grid"), false)}
      ${me().role === "MANAGEMENT" ? "" : AUSWERTEN}
      ${sec("Kunden &amp; Service", it("#/customers", "Kunden &amp; Anlagen".replace("&amp;", "&"), "building", { badge: db.customers.length, kw: "kunde anlage wartung seriennummer" }) + it("", "Kunde anlegen", "plus", { act: "customer-new" })
        + it("/portal", "Kundenportal", "send", { ext: true, kw: "störung melden kunden" }) + it("", "Kundenstamm als Excel", "list", { act: "export-customers", kw: "export" }))}
      ${sec("Daten", it("#/import", "Daten importieren (Excel/CSV)", "upload", { kw: "import warenwirtschaft" }) + it("", "Alle Vorgänge als CSV", "list", { act: "export-all-csv", kw: "export" })
        + it("#/settings?sec=calendar", "Kalender in Outlook", "clock", { kw: "outlook ics abo" }) + it("#/settings?sec=app", "Als App / aufs Handy", "grid", { kw: "installieren qr handy" }), false)}
      ${sec("Mein Konto", it("#/settings?sec=profile", "Profil &amp; Benachrichtigungen".replace("&amp;", "&"), "gear") + it("#/settings?sec=devices", "Passwort &amp; Geräte".replace("&amp;", "&"), "shield", { kw: "sitzung abmelden" }) + it("#/settings?sec=outlook", "Outlook-Add-in", "send"), false)}
      ${admin ? sec("Verwaltung", it("#/settings?sec=people", "Personen &amp; Zugänge".replace("&amp;", "&"), "users", { kw: "einladen benutzer rolle passwort" }) + it("#/settings?sec=brand", "Erscheinungsbild", "star", { kw: "logo farbe name" })
        + it("#/integrations", "Integrationen", "link", { kw: "microsoft teams outlook factorial api webhook" }) + it("#/automation", "Automatik", "zap", { kw: "regeln zuweisung eskalation wiedervorlage" }) + it("#/system", "System &amp; Protokoll".replace("&amp;", "&"), "shield", { kw: "sicherung backup audit" })
        + it("", "Sicherung herunterladen", "upload", { act: "export-json", kw: "backup json" }), false) : ""}
    </nav>
    <div class="dr-foot"><a class="dr-item" href="#" data-act="theme">${icon("sun")}<span>Hell / Dunkel</span></a><a class="dr-item" href="#" data-act="shortcuts">${icon("help")}<span>Tastenkürzel</span></a><a class="dr-item" href="#" data-act="logout">${icon("logout")}<span>Abmelden</span></a></div>`;
}
function openDrawer() {
  let d = $("#drawer");
  if (!d) { d = document.createElement("aside"); d.id = "drawer"; d.className = "drawer"; d.setAttribute("aria-label", "Hauptmenü"); document.body.append(d); const ov = document.createElement("div"); ov.id = "drawer-ov"; ov.className = "drawer-ov"; ov.addEventListener("click", closeDrawer); document.body.append(ov); }
  d.innerHTML = drawerHtml(); d.classList.add("open"); $("#drawer-ov").classList.add("open"); document.body.classList.add("drawer-open");
  setTimeout(() => (matchMedia("(pointer: fine)").matches ? $("#drawer-q") : d.querySelector(".dr-item.on") || d)?.focus?.(), 60);
}
function closeDrawer() { $("#drawer")?.classList.remove("open"); $("#drawer-ov")?.classList.remove("open"); document.body.classList.remove("drawer-open"); }
const drawerOpen = () => !!$("#drawer")?.classList.contains("open");

/* ---------- Erscheinungsbild (Firmenfarbe, Logo, Name) ---------- */
const hexRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const rgbHex = (a) => `#${a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mixHex = (h, w, t) => rgbHex(hexRgb(h).map((v, k) => v + (hexRgb(w)[k] - v) * t));
const lum = (h) => { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function applyBrand(b = ui.brand) {
  ui.brand = b || ui.brand || { appName: "GF Tracker", color: "#2436e8", logo: null }; const c = ui.brand.color; const st = document.documentElement.style;
  const dark = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  if (!c || c === "#2436e8") { for (const k of ["--primary", "--primary-hover", "--primary-soft", "--sel", "--primary-fg"]) st.removeProperty(k); }
  else if (dark) { let x = c; for (let k = 0; k < 10 && lum(x) < 0.3; k++) x = mixHex(x, "#ffffff", 0.2); st.setProperty("--primary", x); st.setProperty("--primary-hover", mixHex(x, "#ffffff", 0.2)); st.setProperty("--primary-soft", mixHex(x, "#2a2b2f", 0.8)); st.setProperty("--sel", mixHex(x, "#2a2b2f", 0.78)); st.setProperty("--primary-fg", "#1e1f22"); }
  else { st.setProperty("--primary", c); st.setProperty("--primary-hover", mixHex(c, "#000000", 0.15)); st.setProperty("--primary-soft", mixHex(c, "#ffffff", 0.9)); st.setProperty("--sel", mixHex(c, "#ffffff", 0.9)); st.setProperty("--primary-fg", lum(c) > 0.5 ? "#172b4d" : "#ffffff"); }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c);
}
/** Fenstertitel = aktuelle Ansicht bzw. Vorgang – erscheint im Verlauf, in Lesezeichen, in der Taskleiste und in Teams. */
function setTitle() {
  const i = ui.modal === "issue" && ui.openIssue && issue(ui.openIssue); const h = $("#view h1")?.textContent.trim();
  document.title = `${i ? `${keyOf(i)} ${i.summary}` : h || "Mein Tag"} · ${ui.brand?.appName || "GF Tracker"}`;
}
function closeModal({ fromNav = false } = {}) {
  if (ui.modal === "issue" && !fromNav && route().params.get("issue")) { // Vorgang geschlossen: Verlaufsschritt zurücknehmen
    if (history.state?.gftIssue) { ui.modal = null; history.go(-history.state.gftIssue); } else // ganz zurück zur Ansicht, auch nach Sprüngen zwischen Vorgängen
 history.replaceState(null, "", baseHash());
  }
  const m = $("#modal"); m.className = "modal"; m.innerHTML = ""; ui.modal = null; ui.openIssue = null; ui.editingDesc = false; ui.modalDirty = false; ui.stepReturn = null;
  $("#overlay").classList.remove("open"); document.body.classList.remove("modal-open");
  const f = ui.modalReturnFocus; ui.modalReturnFocus = null; if (f && document.contains(f)) f.focus({ preventScroll: true });
  setTitle();
}
/** Schließen durch Nutzer (Esc, Klick daneben, ×): fragt bei ungespeicherten Eingaben nach; Arbeitsschritte kehren zum Vorgang zurück. */
function dismissModal() {
  if (!ui.modal) return;
  const typed = ui.modalDirty || [...$("#modal").querySelectorAll("#comment-text, #desc-edit, textarea[name=description]")].some((t) => t.value.trim() && t.defaultValue !== t.value);
  if (typed && !confirm("Ihre Eingaben sind noch nicht gespeichert. Trotzdem schließen?")) return;
  const back = ui.modal === "form" ? ui.stepReturn : null; ui.stepReturn = null;
  closeModal(); if (back && issue(back)) openIssue(back);
}
function openIssue(id, { push = true } = {}) { const i = issue(id); if (!i) return toast("Vorgang nicht gefunden.");
  if (push && route().params.get("issue") !== keyOf(i)) { const b = baseHash(); history.pushState({ gftIssue: (history.state?.gftIssue || 0) + 1 }, "", `${b}${b.includes("?") ? "&" : "?"}issue=${encodeURIComponent(keyOf(i))}`); updateNavButtons(); } ui.openIssue = id; ui.editingDesc = false; ui.addingSub = false; ui.addingLink = false; ui.issueTab = ui.issueTab || "comments"; pushRecent(id); openModal("", true, "issue"); renderIssue(); setTitle(); }
function renderIssue() {
  const i = issue(ui.openIssue); if (!i) { closeModal(); return; }
  const p = proj(i.projectId); const s = statusOf(i); const ch = children(i); const isSvc = p.type === "service";
  const parent = issue(i.parentId), epic = issue(i.epicId);
  const crumbs = `<a href="#/p/${p.key}" data-act="close">${esc(p.name)}</a>${epic ? ` / <a href="#" data-act="open" data-id="${epic.id}">${keyOf(epic)}</a>` : ""}${parent ? ` / <a href="#" data-act="open" data-id="${parent.id}">${keyOf(parent)}</a>` : ""} / <span class="row nowrap" style="display:inline-flex">${typeIcon(i.type)} ${keyOf(i)}</span>`;
  const tab = ui.issueTab;
  const comments = i.comments.map((c) => `<div class="comment ${c.internal ? "internal" : ""}">${c.userId ? avatar(c.userId, true) : custAvatar({ name: c.author, email: i.customer?.email })}
    <div class="body"><div class="small"><b>${esc(c.userId ? uname(c.userId) : c.author + " (Kunde)")}</b> <span class="muted">${fmtDT(c.at)}</span>${c.internal ? ' <span class="chip yellow">intern</span>' : isSvc && c.userId ? ' <span class="chip gray">für Kunden sichtbar</span>' : ""}</div>
    <div class="text">${highlightMentions(c.text)}</div></div></div>`).join("") || '<p class="muted small">Noch keine Kommentare.</p>';
  const history = i.history.map((h) => `<div class="hist">${avatar(h.userId)} <b>${esc(h.by || (h.userId ? uname(h.userId) : "Kunde/System"))}</b> hat <b>${esc(h.field)}</b> ${h.from && h.from !== "–" ? `von „${esc(h.from)}“ ` : ""}${h.to === "erstellt" ? "erstellt" : `auf „${esc(h.to)}“ geändert`} <span class="muted small">· ${fmtDT(h.at)}</span></div>`).join("");
  const timePct = i.estimateH ? Math.min(100, (i.loggedH / i.estimateH) * 100) : 0;
  const sf = slaInfo(i, "first"), sr = slaInfo(i, "resolve");
  $("#modal").innerHTML = `
    <div class="modal-h" style="padding-bottom:8px">${window.history.state?.gftIssue > 1 ? `<button class="btn subtle sm" data-act="nav-back" title="Zum vorherigen Vorgang (Alt+←)">‹ Zurück</button>` : ""}<div class="small muted mh-crumbs" style="flex:1">${crumbs}</div>
      <div class="mh-sticky">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><b>${esc(i.summary)}</b>${lozenge(i)}${actionButton(i)}</div>
      <button class="btn subtle sm" data-act="watch" title="Beobachten">${icon("eye")} ${i.watchers.includes(db.currentUserId) ? "Beobachtet" : "Beobachten"} (${i.watchers.length})</button>
      <button class="btn subtle sm icon" data-act="clone" title="Klonen">${icon("copy")}</button>
      <button class="btn subtle sm icon" data-act="delete-issue" title="Löschen">${icon("trash")}</button>
      <button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <div class="issue-wrap">
      <div style="min-width:0">
        <input class="issue-sum" data-f="summary" value="${esc(i.summary)}" aria-label="Zusammenfassung">
        <div class="row" style="margin:8px 0 16px">${i.type !== "SUBTASK" && i.type !== "EPIC" ? `<button class="btn sm" data-act="add-subtask">${icon("sub")} Teilaufgabe</button>` : ""}<button class="btn sm" data-act="add-link">${icon("link")} Verknüpfen</button>${i.type === "EPIC" ? `<button class="btn sm" data-act="create" data-project="${p.id}" data-epic="${i.id}">${icon("plus")} Vorgang im Epic</button>` : ""}</div>
        ${i.customer ? `<div class="note info" style="margin-bottom:14px">${customer(i.customerId) ? `<a href="#/customers/${i.customerId}" class="b">${esc(customer(i.customerId).name)}</a>${customer(i.customerId).no ? ` <span class="small muted">(${esc(customer(i.customerId).no)})</span>` : ""}${assetOf(customer(i.customerId), i.assetId) ? ` · Anlage <b>${esc(assetOf(customer(i.customerId), i.assetId).name)}</b>${assetOf(customer(i.customerId), i.assetId).serial ? ` (SN ${esc(assetOf(customer(i.customerId), i.assetId).serial)})` : ""}` : ""}${customerAddress(customer(i.customerId)) ? `<div class="small" style="margin:2px 0 4px">${esc(customerAddress(customer(i.customerId)))}</div>` : "<br>"}` : ""}<b>${esc(i.customer.name)}</b> · ${esc(i.customer.company || "")} · <a href="mailto:${encodeURIComponent(i.customer.email)}?subject=${encodeURIComponent(`[${keyOf(i)}] ${i.summary}`)}">${esc(i.customer.email)}</a>${i.customer.phone ? ` · ${esc(i.customer.phone)}` : ""}</div>` : ""}
        ${reportBlock(i)}
        <div class="sec-title">Beschreibung</div>
        ${ui.editingDesc ? `<textarea id="desc-edit" rows="8">${esc(i.description)}</textarea><div class="row" style="margin-top:6px"><button class="btn primary sm" data-act="save-desc">Speichern</button><button class="btn subtle sm" data-act="cancel-desc">Abbrechen</button></div>`
          : `<div class="desc-view" data-act="edit-desc" title="Klicken zum Bearbeiten">${i.description ? esc(i.description) : '<span class="muted">Beschreibung hinzufügen…</span>'}</div>`}
        ${i.type === "EPIC" ? `<div class="sec-title" style="margin-top:18px">Vorgänge im Epic <span class="small muted">${epicChildren(i).filter(isDone).length}/${epicChildren(i).length} erledigt</span></div>
          ${epicChildren(i).length ? `<div class="progress" style="margin-bottom:8px"><i style="width:${epicChildren(i).filter(isDone).length / epicChildren(i).length * 100}%;background:var(--ok)"></i></div>` : ""}
          <div>${epicChildren(i).map((c) => `<div class="subrow" data-act="open" data-id="${c.id}">${typeIcon(c.type)}<span class="key">${keyOf(c)}</span><span class="trunc" style="flex:1">${esc(c.summary)}</span>${prioIcon(c.priority)}${avatar(c.assigneeId)}${lozenge(c)}</div>`).join("") || '<p class="muted small">Noch keine Vorgänge.</p>'}</div>` : ""}
        ${ch.length || ui.addingSub ? `<div class="sec-title" style="margin-top:18px">Teilaufgaben <span class="small muted">${ch.filter(isDone).length}/${ch.length}</span></div>
          ${ch.length ? `<div class="progress" style="margin-bottom:8px"><i style="width:${ch.filter(isDone).length / ch.length * 100}%;background:var(--ok)"></i></div>` : ""}
          <div>${ch.map((c) => `<div class="subrow" data-act="open" data-id="${c.id}">${typeIcon(c.type)}<span class="key">${keyOf(c)}</span><span class="trunc" style="flex:1">${esc(c.summary)}</span>${avatar(c.assigneeId)}${lozenge(c)}</div>`).join("")}</div>
          ${ui.addingSub ? `<form id="sub-form" class="row nowrap" style="margin-top:6px"><input type="text" name="summary" placeholder="Was ist zu tun?" required autofocus><select name="assigneeId" style="width:160px">${userOpts(null)}</select><button class="btn primary" type="submit">Erstellen</button></form>` : ""}` : ""}
        ${i.links.length || ui.addingLink ? `<div class="sec-title" style="margin-top:18px">Verknüpfte Vorgänge</div>
          <div>${i.links.map((l, k) => { const o = issue(l.issueId); return o ? `<div class="linkrow" data-act="open" data-id="${o.id}"><span class="small muted" style="width:150px">${LINK_LABEL[l.type]}</span>${typeIcon(o.type)}<span class="key">${keyOf(o)}</span><span class="trunc" style="flex:1">${esc(o.summary)}</span>${lozenge(o)}<button class="btn subtle sm icon" data-act="unlink" data-v="${k}" aria-label="Verknüpfung entfernen">${icon("x")}</button></div>` : ""; }).join("")}</div>
          ${ui.addingLink ? `<form id="link-form" class="row nowrap" style="margin-top:6px"><select name="type" style="width:190px">${Object.entries(LINK_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><input type="text" name="key" list="issue-keys" placeholder="Schlüssel, z. B. DIG-3" required><datalist id="issue-keys">${db.issues.filter((x) => x.id !== i.id).map((x) => `<option value="${keyOf(x)}">${esc(x.summary)}</option>`).join("")}</datalist><button class="btn primary" type="submit">Verknüpfen</button></form>` : ""}` : ""}
        <div class="sec-title row" style="margin-top:20px">Anhänge${(i.attachments || []).length ? ` <span class="badge-count">${i.attachments.length}</span>` : ""}<span class="sp"></span><label class="btn subtle sm" style="cursor:pointer">${icon("upload")} Datei hinzufügen<input type="file" id="att-input" data-id="${i.id}" multiple hidden></label></div>
        <div class="att-drop" data-att-drop="${i.id}">${(i.attachments || []).length ? `<div class="att-grid">${i.attachments.map((a) => attTile(i, a)).join("")}</div>` : `<p class="small muted" style="margin:0">Keine Anhänge – Dateien hierher ziehen, „Datei hinzufügen“ wählen oder ein Bildschirmfoto mit <span class="kbd">Strg</span>+<span class="kbd">V</span> einfügen.${window.GFTLocal ? "" : " Anhänge aus E-Mails an das Service-Postfach werden automatisch übernommen."}</p>`}</div>
        <div class="sec-title" style="margin-top:22px">Aktivität</div>
        <div class="tabs"><button class="${tab === "comments" ? "on" : ""}" data-act="issue-tab" data-v="comments">Kommentare (${i.comments.length})</button><button class="${tab === "history" ? "on" : ""}" data-act="issue-tab" data-v="history">Verlauf</button></div>
        ${tab === "comments" ? `<form id="comment-form" class="grid" style="gap:6px;margin-bottom:10px"><textarea name="text" id="comment-text" rows="2" placeholder="Kommentar hinzufügen … (@Name erwähnt Personen)"></textarea>
          <div class="row"><button class="btn primary sm" type="submit">${isSvc ? "Antwort an Kunden" : "Speichern"}</button>${isSvc ? `<button class="btn sm" type="submit" name="internal" value="1">Interne Notiz</button>` : ""}<span class="small muted">Strg+Enter zum Senden</span></div></form>${comments}` : history}
      </div>
      <div>
        <div style="margin-bottom:12px">${workflowPanel(i)}</div>
        ${i.appointmentAt ? `<div class="details" style="margin-bottom:12px"><div class="drow" style="padding:10px 14px"><span>Termin</span><span class="b">${fmtAppt(i.appointmentAt)}${i.assigneeId ? ` · ${esc(uname(i.assigneeId))}` : ""}</span></div></div>` : ""}
        ${isSvc && (sf || sr) ? `<div class="details" style="margin-bottom:12px"><div class="dh">SLA</div><div class="drow"><span>Erste Antwort</span><span>${slaChip(sf)} <span class="small muted">Ziel ${SLA[i.priority][0]} h</span></span></div><div class="drow" style="padding-bottom:10px"><span>Lösung</span><span>${slaChip(sr)} <span class="small muted">Ziel ${SLA[i.priority][1]} h</span></span></div></div>` : ""}
        <div class="details"><div class="dh">Details</div>
          <div class="drow"><span>Team</span><span><select data-f="teamId">${teamOpts(i.teamId)}</select></span></div>
          ${isSvc || i.customerId ? `<div class="drow"><span>Kunde</span><span><select data-f="customerId">${custOpts(i.customerId)}</select></span></div>
          ${customer(i.customerId) ? `<div class="drow"><span>Anlage</span><span><select data-f="assetId"><option value="">–</option>${(customer(i.customerId).assets || []).map((a) => `<option value="${a.id}" ${a.id === i.assetId ? "selected" : ""}>${esc(a.name)}${a.serial ? ` (${esc(a.serial)})` : ""}</option>`).join("")}</select></span></div>` : ""}` : ""}
          <div class="drow"><span>Verantwortlich</span><span><select data-f="assigneeId">${userOpts(i.assigneeId, undefined, i.teamId)}</select>${i.assigneeId !== db.currentUserId ? `<a href="#" class="small" data-act="assign-me">Mir zuweisen</a>` : ""}</span></div>
          <div class="drow"><span>Melder</span><span>${i.reporterId ? `<select data-f="reporterId">${userOpts(i.reporterId, "–")}</select>` : `<span class="row nowrap">${custAvatar(i.customer)} ${esc(i.customer?.name || "–")} <span class="small muted">(Kunde)</span></span>`}</span></div>
          <div class="drow"><span>Priorität</span><span class="row nowrap">${prioIcon(i.priority)}<select data-f="priority">${prioOpts(i.priority)}</select></span></div>
          <div class="drow"><span>Vorgangstyp</span><span class="row nowrap">${typeIcon(i.type)}<select data-f="type" ${i.type === "SUBTASK" || i.type === "EPIC" ? "disabled" : ""}>${PROJECT_TYPES[p.type].types.filter((t) => i.type === t || (t !== "SUBTASK" && t !== "EPIC")).map((t) => `<option value="${t}" ${t === i.type ? "selected" : ""}>${TYPES[t].label}</option>`).join("")}</select></span></div>
          <div class="drow"><span>Labels</span><span><input type="text" data-f="labels" value="${esc(i.labels.join(", "))}" placeholder="Komma-getrennt"></span></div>
          ${p.type === "software" && i.type !== "EPIC" && i.type !== "SUBTASK" ? `<div class="drow"><span>Sprint</span><span><select data-f="sprintId"><option value="">Backlog</option>${db.sprints.filter((x) => x.projectId === p.id && (x.state !== "closed" || x.id === i.sprintId)).map((x) => `<option value="${x.id}" ${x.id === i.sprintId ? "selected" : ""}>${esc(x.name)}${x.state === "active" ? " (aktiv)" : x.state === "closed" ? " (abgeschlossen)" : ""}</option>`).join("")}</select></span></div>` : ""}
          ${i.type !== "EPIC" && i.type !== "SUBTASK" && epicsOf(p).length ? `<div class="drow"><span>Epic</span><span><select data-f="epicId"><option value="">–</option>${epicsOf(p).map((e) => `<option value="${e.id}" ${e.id === i.epicId ? "selected" : ""}>${esc(e.summary)}</option>`).join("")}</select></span></div>` : ""}
          ${p.type === "software" && i.type !== "EPIC" ? `<div class="drow"><span>Story Points</span><span><input type="number" min="0" step="1" data-f="storyPoints" value="${i.storyPoints ?? ""}"></span></div>` : ""}
          ${i.type === "EPIC" ? `<div class="drow"><span>Startdatum</span><span><input type="date" data-f="startDate" value="${i.startDate || ""}"></span></div>` : ""}
          <div class="drow"><span>Fällig</span><span><input type="date" data-f="dueDate" value="${i.dueDate || ""}"> ${isOverdue(i) ? '<span class="chip red">überfällig</span>' : ""}</span></div>
          <div class="drow" style="align-items:start"><span>Zeiterfassung</span><span><div class="progress" style="margin:6px 0 4px"><i style="width:${timePct}%;background:${i.estimateH && i.loggedH > i.estimateH ? "var(--danger)" : "var(--s1)"}"></i></div>
            <span class="small muted">${i.loggedH || 0} h erfasst${i.estimateH ? ` von ${i.estimateH} h geschätzt` : ""}</span>
            <form id="time-form" class="row nowrap" style="margin-top:6px"><input type="number" name="h" min="0.25" step="0.25" placeholder="Stunden" style="width:90px" aria-label="Stunden erfassen"><button class="btn sm" type="submit">+ erfassen</button></form>
            <label class="row nowrap small muted" style="margin-top:6px">Schätzung <input type="number" data-f="estimateH" min="0" step="0.5" value="${i.estimateH ?? ""}" style="width:80px" aria-label="Schätzung in Stunden"> h</label></span></div>
          <div style="padding:8px 14px 12px" class="small muted">Erstellt ${fmtDT(i.createdAt)}<br>Aktualisiert ${ago(i.updatedAt)}${i.resolvedAt ? `<br>Erledigt ${fmtDT(i.resolvedAt)}` : ""}</div>
        </div>
        <p class="small muted" style="margin-top:10px">Teilen: <code>#/issue/${keyOf(i)}</code></p>
      </div>
    </div>`;
}

/** Hebt @Erwähnungen hervor – vollständiger Name, sonst Vorname. */
function highlightMentions(text) {
  let html = esc(text);
  const names = activeUsers().flatMap((u) => [u.name, u.name.split(" ")[0]]).sort((a, b) => b.length - a.length);
  if (!names.length) return html;
  const re = new RegExp(`@(${names.map((n) => esc(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\wäöüß])`, "gi");
  return html.replace(re, (m) => `<span class="mention">${m}</span>`);
}

/* ---------- Formulare ---------- */
let createFiles = [];
function addCreateFiles(files) { createFiles.push(...files); ui.modalDirty = true; renderCreateFiles(); }
function renderCreateFiles() { const l = $("#cf-list"); if (l) l.innerHTML = createFiles.map((f, k) => `<span class="chip gray">📎 ${esc(f.name)} <span class="muted">${fmtSize(f.size)}</span> <button type="button" class="btn subtle sm icon" data-act="cf-file-del" data-v="${k}" aria-label="Entfernen" style="height:18px;width:18px">${icon("x")}</button></span>`).join(""); }
function createForm(prefill = {}) {
  createFiles = [];
  const pid = prefill.projectId || (route().parts[0] === "p" && projByKey(route().parts[1])?.id) || ui.lastProject || db.projects[0]?.id;
  if (!pid) return toast("Bitte zuerst ein Projekt anlegen.");
  const p = proj(pid); const types = PROJECT_TYPES[p.type].types.filter((t) => t !== "SUBTASK");
  const type = prefill.type && types.includes(prefill.type) ? prefill.type : types[0];
  openModal(`<div class="modal-h"><h2>Vorgang erstellen</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="create-form"><div class="modal-b">
      <div class="grid g2" style="gap:12px"><label class="f"><span>Projekt <span class="req">*</span></span><select name="projectId" id="cf-project">${db.projects.map((x) => `<option value="${x.id}" ${x.id === pid ? "selected" : ""}>${esc(x.name)} (${x.key})</option>`).join("")}</select></label>
        <label class="f"><span>Vorgangstyp <span class="req">*</span></span><select name="type">${types.map((t) => `<option value="${t}" ${t === type ? "selected" : ""}>${TYPES[t].label}</option>`).join("")}</select></label></div>
      <label class="f"><span>Zusammenfassung <span class="req">*</span></span><input type="text" name="summary" required maxlength="255" autofocus></label>
      <label class="f">Beschreibung<textarea name="description" rows="4"></textarea></label>
      <div class="grid g2" style="gap:12px">
        <label class="f">Team<select name="teamId">${teamOpts(prefill.teamId !== undefined ? prefill.teamId : p.teamId || null)}</select></label>
        <label class="f">Verantwortlich<select name="assigneeId">${userOpts(prefill.assigneeId ?? null, "Nicht zugewiesen (Team-Eingang)", prefill.teamId !== undefined ? prefill.teamId : p.teamId)}</select></label>
        <label class="f">Priorität<select name="priority">${prioOpts(prefill.priority || "MEDIUM")}</select></label>
        <label class="f">Fälligkeitsdatum<input type="date" name="dueDate"></label>
        <label class="f">Labels<input type="text" name="labels" placeholder="z. B. portal, kunde"></label>
        ${p.type === "software" ? `<label class="f">Story Points<input type="number" name="storyPoints" min="0" step="1"></label>
        <label class="f">Sprint<select name="sprintId"><option value="">Backlog</option>${db.sprints.filter((x) => x.projectId === p.id && x.state !== "closed").map((x) => `<option value="${x.id}" ${prefill.sprintId === x.id ? "selected" : ""}>${esc(x.name)}${x.state === "active" ? " (aktiv)" : ""}</option>`).join("")}</select></label>` : ""}
        ${epicsOf(p).length ? `<label class="f">Epic<select name="epicId"><option value="">–</option>${epicsOf(p).map((e) => `<option value="${e.id}" ${prefill.epicId === e.id ? "selected" : ""}>${esc(e.summary)}</option>`).join("")}</select></label>` : ""}
        ${p.type === "service" ? (() => { const cu = customer(prefill.customerId);
          return `<label class="f" style="grid-column:1/-1">Kunde<select name="customerId" id="cf-customer">${custOpts(prefill.customerId, "– Kunde wählen (oder unten neu eintragen) –")}</select></label>
          ${cu ? `<label class="f">Ansprechpartner<select name="contactId">${(cu.contacts || []).map((k) => `<option value="${k.id}">${esc(k.name)}${k.email ? ` · ${esc(k.email)}` : ""}</option>`).join("") || '<option value="">–</option>'}</select></label>
            <label class="f">Anlage<select name="assetId"><option value="">– keine bestimmte Anlage –</option>${(cu.assets || []).filter((a) => a.active !== false).map((a) => `<option value="${a.id}" ${a.id === prefill.assetId ? "selected" : ""}>${esc(a.name)}${a.serial ? ` (SN ${esc(a.serial)})` : ""}</option>`).join("")}</select></label>`
          : `<label class="f">Kunde (Name)<input type="text" name="cname"></label><label class="f">Firma<input type="text" name="ccompany"></label><label class="f">Kunden-E-Mail<input type="email" name="cemail"></label>`}`; })() : ""}
      </div></div>
      <div class="f" style="margin-top:12px"><span>Anhänge</span><div class="att-drop cf-drop" id="cf-drop"><label class="btn subtle sm" style="cursor:pointer">${icon("upload")} Dateien wählen<input type="file" id="cf-files" multiple hidden></label>
        <span class="small muted">oder hierher ziehen · Bildschirmfoto mit <span class="kbd">Strg</span>+<span class="kbd">V</span> einfügen</span><div id="cf-list" class="cf-list"></div></div></div></div>
      <div class="modal-f"><label class="small row nowrap" style="margin-right:auto"><input type="checkbox" name="another"> Weiteren Vorgang erstellen</label><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Erstellen</button></div></form>`);
}
function sprintForm(s) {
  const t = today();
  openModal(`<div class="modal-h"><h2>Sprint starten: ${esc(s.name)}</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="sprint-form" data-id="${s.id}"><div class="modal-b">
      <p class="small muted" style="margin:0">${db.issues.filter((i) => i.sprintId === s.id).length} Vorgänge · ${db.issues.filter((i) => i.sprintId === s.id).reduce((a, i) => a + (i.storyPoints || 0), 0)} Story Points werden in diesen Sprint aufgenommen.</p>
      <label class="f">Name<input type="text" name="name" value="${esc(s.name)}" required></label>
      <div class="grid g3" style="gap:12px"><label class="f">Dauer<select name="weeks"><option value="1">1 Woche</option><option value="2" selected>2 Wochen</option><option value="3">3 Wochen</option><option value="4">4 Wochen</option></select></label>
        <label class="f">Start<input type="date" name="start" value="${t}" required></label><label class="f">Ende<input type="date" name="end" value="${addDays(t, 14)}" required></label></div>
      <label class="f">Sprintziel<textarea name="goal" rows="2">${esc(s.goal || "")}</textarea></label></div>
      <div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Starten</button></div></form>`);
}
function completeSprintForm(s) {
  const list = db.issues.filter((i) => i.sprintId === s.id && i.type !== "SUBTASK"); const done = list.filter(isDone); const open = list.filter((i) => !isDone(i));
  const futures = db.sprints.filter((x) => x.projectId === s.projectId && x.state === "future");
  openModal(`<div class="modal-h"><h2>${esc(s.name)} abschließen</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="complete-form" data-id="${s.id}"><div class="modal-b">
      <div class="grid g2"><div class="card stat"><div class="v" style="color:var(--ok)">${done.length}</div><div class="l">erledigte Vorgänge (${done.reduce((a, i) => a + (i.storyPoints || 0), 0)} SP)</div></div>
        <div class="card stat"><div class="v">${open.length}</div><div class="l">offene Vorgänge (${open.reduce((a, i) => a + (i.storyPoints || 0), 0)} SP)</div></div></div>
      ${open.length ? `<label class="f">Offene Vorgänge verschieben nach<select name="target"><option value="backlog">Backlog</option>${futures.map((f) => `<option value="${f.id}">${esc(f.name)}</option>`).join("")}<option value="new">Neuer Sprint</option></select></label>` : ""}</div>
      <div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Sprint abschließen</button></div></form>`);
}
function projectForm() {
  openModal(`<div class="modal-h"><h2>Projekt erstellen</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="new-project-form"><div class="modal-b">
      <label class="f"><span>Name <span class="req">*</span></span><input type="text" name="name" id="np-name" required autofocus></label>
      <label class="f"><span>Schlüssel <span class="req">*</span></span><input type="text" name="key" id="np-key" required maxlength="6" pattern="[A-Za-z][A-Za-z0-9]{1,5}" title="2–6 Zeichen, beginnt mit Buchstabe"></label>
      <label class="f">Vorlage<select name="type">${Object.entries(PROJECT_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join("")}</select></label>
      <p class="small muted" style="margin:0"><b>Scrum</b>: Backlog, Sprints, Burndown – für Entwicklungsvorhaben. <b>Kanban</b>: fortlaufender Arbeitsfluss – für Fach- und Verwaltungsaufgaben. <b>Service-Desk</b>: Kundenanfragen mit Portal und SLA.</p>
      <label class="f">Projektleitung<select name="leadId">${userOpts(db.currentUserId, "–")}</select></label></div>
      <div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">Erstellen</button></div></form>`);
}

/* ---------- Drag & Drop ---------- */
let dragId = null;
function bindDnD() {
  const dz = $("#imp-drop");
  if (dz) { dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drop-on"); }); dz.addEventListener("dragleave", () => dz.classList.remove("drop-on"));
    dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("drop-on"); const f = e.dataTransfer.files?.[0]; if (f) importFile(f); }); }
  $$("[data-drag-assign]").forEach((el) => {
    el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/assign", el.dataset.dragAssign); el.classList.add("dragging"); });
    el.addEventListener("dragend", () => el.classList.remove("dragging"));
  });
  $$("[data-drop-assign]").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop-on"); });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop-on"); });
    col.addEventListener("drop", (e) => {
      e.preventDefault(); col.classList.remove("drop-on");
      const i = issue(e.dataTransfer.getData("text/assign")); const to = col.dataset.dropAssign; if (!i || i.assigneeId === to) return;
      updateIssue(i, { assigneeId: to }); render(); toast(`${keyOf(i)} an ${uname(to)} übergeben`);
    });
  });
  $$("[data-drag-appt]").forEach((el) => el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/appt", el.dataset.dragAppt); el.classList.add("dragging"); }));
  $$("[data-drag-appt]").forEach((el) => el.addEventListener("dragend", () => el.classList.remove("dragging")));
  $$("[data-drop-appt]").forEach((cell) => {
    cell.addEventListener("dragover", (e) => { e.preventDefault(); cell.classList.add("drop-on"); });
    cell.addEventListener("dragleave", (e) => { if (!cell.contains(e.relatedTarget)) cell.classList.remove("drop-on"); });
    cell.addEventListener("drop", (e) => {
      e.preventDefault(); cell.classList.remove("drop-on");
      const i = issue(e.dataTransfer.getData("text/appt")); if (!i) return;
      const [userId, day] = cell.dataset.dropAppt.split("|");
      const ab = absenceOn(userId, day); if (ab && !confirm(`${uname(userId)} ist abwesend: ${absenceText(ab)}. Trotzdem einplanen?`)) return;
      if (i.status === "SCHEDULED") {
        const old = new Date(i.appointmentAt); const [y, m, d] = day.split("-").map(Number);
        const next = new Date(y, m - 1, d, old.getHours(), old.getMinutes());
        if (next.toISOString() === i.appointmentAt && i.assigneeId === userId) return;
        updateIssue(i, { assigneeId: userId, appointmentAt: next.toISOString() }); render();
        toast(`${keyOf(i)} verschoben auf ${fmtAppt(next.toISOString())} (${uname(userId)})${i.customer?.email ? " – Kunde wird informiert" : ""}`);
        return;
      }
      const t = stepsFor(i).find((x) => x.to === "SCHEDULED");
      if (!t) return toast(`${keyOf(i)} kann im Status „${statusOf(i).name}“ nicht eingeplant werden.`);
      const [y, m, d] = day.split("-").map(Number);
      stepForm(i, t, { assigneeId: userId, appointmentAt: new Date(y, m - 1, d, 8, 0).toISOString() });
    });
  });
  $$("[data-drag]").forEach((el) => {
    el.addEventListener("dragstart", (e) => { dragId = el.dataset.drag; e.dataTransfer.setData("text/plain", dragId); el.classList.add("dragging"); });
    el.addEventListener("dragend", () => { el.classList.remove("dragging"); dragId = null; $$(".drop-on,.drop-before").forEach((x) => x.classList.remove("drop-on", "drop-before")); });
  });
  $$("[data-drop-status]").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop-on"); });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop-on"); });
    col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("drop-on"); const i = issue(e.dataTransfer.getData("text/plain"));
      if (i && i.status !== col.dataset.dropStatus) { updateIssue(i, { status: col.dataset.dropStatus }); render(); toast(`${keyOf(i)} → ${statusOf(i).name}`); } });
  });
  $$("[data-drop-sprint]").forEach((box) => {
    box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("drop-on"); const row = e.target.closest("[data-drop-row]"); $$(".drop-before").forEach((x) => x.classList.remove("drop-before")); if (row && row.dataset.dropRow !== dragId) row.classList.add("drop-before"); });
    box.addEventListener("dragleave", (e) => { if (!box.contains(e.relatedTarget)) box.classList.remove("drop-on"); });
    box.addEventListener("drop", (e) => {
      e.preventDefault(); box.classList.remove("drop-on"); const i = issue(e.dataTransfer.getData("text/plain")); if (!i) return;
      const target = box.dataset.dropSprint === "backlog" ? null : box.dataset.dropSprint; const row = e.target.closest("[data-drop-row]");
      if (row && row.dataset.dropRow !== i.id) { const before = issue(row.dataset.dropRow); const prev = db.issues.filter((x) => x.rank < before.rank).sort((a, b) => b.rank - a.rank)[0]; i.rank = prev ? (prev.rank + before.rank) / 2 : before.rank - 1; }
      if ((i.sprintId || null) !== target) { updateIssue(i, { sprintId: target }); children(i).forEach((c) => (c.sprintId = target)); toast(`${keyOf(i)} → ${target ? sprint(target).name : "Backlog"}`); }
      save(); render();
    });
  });
}

/* ---------- CSV ---------- */
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportCsv(list, name) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Schlüssel", "Typ", "Zusammenfassung", "Status", "Priorität", "Verantwortlich", "Melder", "Projekt", "Sprint", "Epic", "Story Points", "Labels", "Fällig", "Erstellt", "Erledigt", "Kunde", "Firma", "Beschreibung"]]
    .concat(list.map((i) => [keyOf(i), TYPES[i.type].label, i.summary, statusOf(i).name, PRIOS[i.priority].label, i.assigneeId ? uname(i.assigneeId) : "", i.reporterId ? uname(i.reporterId) : i.customer?.name || "", proj(i.projectId).name, sprint(i.sprintId)?.name || "", issue(i.epicId)?.summary || "", i.storyPoints ?? "", i.labels.join(", "), i.dueDate ? fmtDay(i.dueDate) : "", fmtDT(i.createdAt), i.resolvedAt ? fmtDT(i.resolvedAt) : "", i.customer?.name || "", i.customer?.company || "", i.description]));
  download(name, "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n"), "text/csv;charset=utf-8");
}

/* ---------- Zeiträume: Quartale und Jahre ---------- */
const quarterOf = (dk) => { const [y, m] = dk.split("-").map(Number); return { y, q: Math.floor((m - 1) / 3) + 1 }; };
function quarterRange(y, q) {
  const sm = (q - 1) * 3 + 1; const next = q === 4 ? `${y + 1}-01-01` : `${y}-${pad(sm + 3)}-01`;
  return { kind: "q", y, q, start: `${y}-${pad(sm)}-01`, end: addDays(next, -1), label: `Q${q} ${y}` };
}
const prevQuarter = (p) => (p.q === 1 ? quarterRange(p.y - 1, 4) : quarterRange(p.y, p.q - 1));
const yearRange = (y) => ({ kind: "y", y, start: `${y}-01-01`, end: `${y}-12-31`, label: `Jahr ${y}` });
const currentQuarter = () => { const c = quarterOf(today()); return quarterRange(c.y, c.q); };
/** Die letzten n Quartale bis einschließlich des aktuellen (älteste zuerst). */
const lastQuarters = (n) => { let p = currentQuarter(); const out = [p]; while (out.length < n) { p = prevQuarter(p); out.unshift(p); } return out; };
/** Im Zeitraum aktiv: bis zum Ende erstellt und nicht vor dem Beginn erledigt. */
const activeIn = (i, p) => dayKey(i.createdAt) <= p.end && (!i.resolvedAt || dayKey(i.resolvedAt) >= p.start);
const inRange = (iso, p) => { if (!iso) return false; const d = dayKey(iso); return d >= p.start && d <= p.end; };
/** Kennzahlen eines Zeitraums: erstellt, erledigt, Durchlaufzeit, Termintreue, SLA, Einsatzstunden. */
function periodStats(list, p) {
  const created = list.filter((i) => inRange(i.createdAt, p)); const done = list.filter((i) => inRange(i.resolvedAt, p));
  const withDue = done.filter((i) => i.dueDate); const late = withDue.filter((i) => dayKey(i.resolvedAt) > i.dueDate).length;
  const sl = done.map((i) => slaInfo(i, "resolve")).filter((x) => x && x.stopped);
  return { p, created: created.length, done: done.length,
    dur: done.length ? done.reduce((s, i) => s + (new Date(i.resolvedAt) - new Date(i.createdAt)) / 864e5, 0) / done.length : null,
    onTime: withDue.length ? 1 - late / withDue.length : null, sla: sl.length ? sl.filter((x) => x.met).length / sl.length : null,
    hours: done.reduce((s, i) => s + (Number(i.resolution?.hours) || 0), 0), service: done.filter((i) => proj(i.projectId)?.type === "service" && i.type !== "SUBTASK").length };
}
/** Quartale ab dem ersten mit Daten (mindestens 4) bis heute. */
function quarterSeries(list, min = 4, max = 12) {
  const first = list.reduce((m, i) => (i.createdAt < m ? i.createdAt : m), new Date().toISOString());
  const all = lastQuarters(max); const f = quarterOf(dayKey(first)); const idx = all.findIndex((p) => p.y > f.y || (p.y === f.y && p.q >= f.q));
  return all.slice(Math.min(Math.max(0, idx), all.length - min));
}
const delta = (a, b, fmt = (x) => x) => (a == null || b == null ? "" : a > b ? `▲ ${fmt(a - b)}` : a < b ? `▼ ${fmt(b - a)}` : "± 0");

/** Auswahl des Zeitraums vor dem Excel-Export. */
function xlsxDialog(scopeFn, base, title) {
  const scope = scopeFn(); ui.xlsx = { scopeFn, scope, base, title };
  const cur = currentQuarter(), prev = prevQuarter(cur); const older = lastQuarters(8).reverse().slice(2);
  const years = [...new Set(scope.map((i) => Number(i.createdAt.slice(0, 4))).concat(cur.y))].sort((a, b) => b - a);
  const opt = (v, l) => `<option value="${v}">${esc(l)}</option>`;
  openModal(`<div class="modal-h"><h2>Excel-Auswertung</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <form id="xlsx-form"><div class="modal-b">
      <div class="small muted">${esc(title)} · ${scope.length} Vorgänge</div>
      <label class="f">Zeitraum<select name="period">${opt("all", "Gesamter Zeitraum")}<optgroup label="Quartale">${opt(`q:${cur.y}:${cur.q}`, `Aktuelles Quartal – ${cur.label}`)}${opt(`q:${prev.y}:${prev.q}`, `Vorquartal – ${prev.label}`)}${older.map((p) => opt(`q:${p.y}:${p.q}`, p.label)).join("")}</optgroup>
        <optgroup label="Jahre">${years.map((y) => opt(`y:${y}`, `Jahr ${y}`)).join("")}</optgroup></select></label>
      <p class="small muted" style="margin:0">Ein Quartal enthält alle Vorgänge, die darin erstellt, bearbeitet oder erledigt wurden. Das Dashboard vergleicht automatisch mit dem Vorquartal; das Blatt „Quartale“ zeigt die Entwicklung über alle Quartale.</p>
    </div><div class="modal-f"><button type="button" class="btn subtle" data-act="close">Abbrechen</button><button class="btn primary" type="submit">${icon("download")} Excel erstellen</button></div></form>`);
}

/** Dashboard-Blatt für die Excel-Auswertung: Kennzahlen, native Excel-Diagramme, Listen „Überfällig“ und „Nächste Termine“.
    Die Diagrammdaten stehen im Blatt „Diagrammdaten“, damit die Diagramme in Excel bearbeitbar bleiben. */
function xlsxDashboard(list, title, svc, { period = null, scope = list } = {}) {
  // Farben: Kategorien in fester Reihenfolge, Status (überfällig) nur für Verzug
  const C = { blue: "#2A78D6", orange: "#EB6834", aqua: "#1BAF7A", critical: "#D03B3B", ink: "#1F2328", muted: "#5B6270", line: "#E3E5E8", tile: "#F4F6F8", navy: "#1F3A5F" };
  const tk = today(); const open = list.filter((i) => !isDone(i) && i.type !== "EPIC"); const overdue = open.filter(isOverdue);
  // Ohne Zeitraum: letzte 30 Tage bzw. alles; mit Zeitraum: genau dieses Quartal/Jahr, beim Quartal mit Vergleich zum Vorquartal
  const win = period || { start: addDays(tk, -29), end: tk, label: "30 Tage" };
  const cur = periodStats(list, win); const prevQ = period?.kind === "q" ? periodStats(scope, prevQuarter(period)) : null;
  const doneAll = period ? list.filter((i) => inRange(i.resolvedAt, period)) : list.filter((i) => i.resolvedAt);
  const avgDays = doneAll.length ? doneAll.reduce((s, i) => s + (new Date(i.resolvedAt) - new Date(i.createdAt)) / 864e5, 0) / doneAll.length : null;
  const svcDone = period ? svc.filter((i) => inRange(i.resolvedAt, period)) : svc;
  const sla = svcDone.map((i) => slaInfo(i, "resolve")).filter((x) => x && x.stopped); const slaQ = sla.length ? sla.filter((x) => x.met).length / sla.length : null;
  const hours = svcDone.reduce((s, i) => s + (Number(i.resolution?.hours) || 0), 0);
  const vs = prevQ ? ` ggü. ${prevQ.p.label}` : "";
  // Abgeschlossener Zeitraum: offene und überfällige Vorgänge zum Stichtag (Ende des Zeitraums)
  const past = !!period && period.end < tk;
  const openK = past ? list.filter((i) => i.type !== "EPIC" && dayKey(i.createdAt) <= period.end && (!i.resolvedAt || dayKey(i.resolvedAt) > period.end)) : open;
  const overdueK = past ? openK.filter((i) => i.dueDate && i.dueDate < period.end) : overdue;
  const inbox = open.filter((i) => !i.assigneeId && i.type !== "SUBTASK");

  /* --- Diagrammdaten --- */
  const DS = "Diagrammdaten"; const data = []; let dc = 0;
  const block = (head, rows) => { // rows: [[label, v1, v2...]]
    const c0 = dc; head.forEach((h, k) => data.push({ r: 0, c: c0 + k, v: h, s: { b: true, color: "#FFFFFF", fill: C.navy } }));
    rows.forEach((row, ri) => row.forEach((v, k) => data.push({ r: ri + 1, c: c0 + k, v, t: k ? "n" : "s" })));
    dc += head.length + 1; const n = Math.max(rows.length, 1);
    return { cats: { ref: XLSX.ref(DS, c0, 1, c0, n), vals: rows.map((r) => String(r[0])) }, ser: (k, name, color) => ({ name, nameRef: XLSX.ref(DS, c0 + k, 0), ref: XLSX.ref(DS, c0 + k, 1, c0 + k, n), vals: rows.map((r) => r[k]), color }) };
  };
  // Verlauf: Kalenderwochen des Quartals, Monate des Jahres oder die letzten 12 Wochen
  let buckets;
  if (period?.kind === "y") buckets = Array.from({ length: 12 }, (_, m) => ({ start: `${period.y}-${pad(m + 1)}-01`, end: addDays(m === 11 ? `${period.y + 1}-01-01` : `${period.y}-${pad(m + 2)}-01`, -1), label: new Date(period.y, m, 1).toLocaleDateString("de-DE", { month: "short" }) }));
  else if (period) { buckets = []; const stop = period.end < tk ? period.end : tk; // laufendes Quartal: nur bis heute
    for (let d = period.start; d <= stop; d = addDays(d, 7)) { const e = addDays(d, 6) > period.end ? period.end : addDays(d, 6); buckets.push({ start: d, end: e, label: `KW ${isoWeek(d)}` }); } }
  else buckets = Array.from({ length: 12 }, (_, k) => { const end = addDays(tk, -7 * (11 - k)); return { start: addDays(end, -6), end, label: `KW ${isoWeek(end)}` }; });
  const weeks = buckets;
  const trend = block([period?.kind === "y" ? "Monat" : "Woche", "Erstellt", "Erledigt"], weeks.map((w) => [w.label, list.filter((i) => { const d = dayKey(i.createdAt); return d >= w.start && d <= w.end; }).length, list.filter((i) => i.resolvedAt && dayKey(i.resolvedAt) >= w.start && dayKey(i.resolvedAt) <= w.end).length]));
  const qRows = quarterSeries(scope).map((p) => { const st = periodStats(scope, p); return [p.label, st.created, st.done, st.dur == null ? null : Math.round(st.dur * 10) / 10]; });
  const qBlock = block(["Quartal", "Erstellt", "Erledigt", "Ø Durchlaufzeit (Tage)"], qRows);
  const stNames = []; open.forEach((i) => { const n = statusOf(i).name; if (!stNames.includes(n)) stNames.push(n); });
  const byStatus = block(["Status", "Offen"], stNames.map((n) => [n, open.filter((i) => statusOf(i).name === n).length]).sort((a, b) => b[1] - a[1]));
  const ppl = activeUsers().map((u) => { const l = open.filter((i) => i.assigneeId === u.id); const od = l.filter(isOverdue).length; return [u.name, l.length - od, od]; }).filter((r) => r[1] + r[2] > 0).sort((a, b) => b[1] + b[2] - (a[1] + a[2])).slice(0, 10);
  const load = block(["Person", "Offen im Plan", "Überfällig"], ppl);
  const teamRows = db.teams.map((t) => [t.name, open.filter((i) => i.teamId === t.id).length]).filter((r) => r[1] > 0);
  const noTeam = open.filter((i) => !team(i.teamId)).length; if (noTeam) teamRows.push(["Ohne Team", noTeam]);
  const byTeam = block(["Team", "Offen"], teamRows.sort((a, b) => b[1] - a[1]));
  const prioRows = Object.entries(PRIOS).sort((a, b) => b[1].rank - a[1].rank).map(([k, p]) => [p.label, open.filter((i) => i.priority === k).length]);
  const byPrio = block(["Priorität", "Offen"], prioRows);
  let sixth;
  if (svc.length) {
    const firms = {}; svc.forEach((i) => { const f = i.customer?.company || i.customer?.name || "Unbekannt"; firms[f] = (firms[f] || 0) + 1; });
    sixth = { title: "Top-Kunden nach Serviceanfragen", sub: "Anzahl Anfragen in dieser Auswertung", b: block(["Kunde", "Anfragen"], Object.entries(firms).sort((a, b) => b[1] - a[1]).slice(0, 8)), name: "Anfragen", fmt: "0" };
  } else {
    sixth = { title: "Erfasste Stunden je Person", sub: "Zeiterfassung in dieser Auswertung", b: block(["Person", "Stunden"], activeUsers().map((u) => [u.name, Math.round(list.filter((i) => i.assigneeId === u.id).reduce((s, i) => s + (Number(i.loggedH) || 0), 0) * 10) / 10]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 8)), name: "Stunden", fmt: "0.0" };
  }

  /* --- Layout: Spalte A Rand, 6 Kacheln à 2 Spalten mit schmalen Abständen (B…R) --- */
  const cols = [{ w: 2 }]; for (let k = 0; k < 6; k++) { cols.push({ w: 11 }, { w: 11 }); if (k < 5) cols.push({ w: 1.6 }); }
  const tileCol = (k) => 1 + k * 3; const LAST = 17; const MID = 9; // Spalte J trennt die Diagrammhälften
  const cells = [], merges = [], heights = { 0: 10, 1: 32, 2: 18, 3: 10, 4: 20, 5: 40, 6: 20, 7: 14 };
  const put = (r, c, v, s, t) => cells.push({ r, c, v, s, t });
  const box = (r1, c1, r2, c2, v, s, t) => { for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) put(r, c, r === r1 && c === c1 ? v : null, s, t); if (r1 !== r2 || c1 !== c2) merges.push(`${XLSX.colName(c1)}${r1 + 1}:${XLSX.colName(c2)}${r2 + 1}`); };
  box(1, 1, 1, LAST, `Dashboard · ${title}`, { b: true, sz: 20, color: C.ink, valign: "center" });
  box(2, 1, 2, LAST, `${period ? `Zeitraum ${fmtDay(period.start)} – ${fmtDay(period.end)} · ` : ""}Stand ${fmtDT(new Date().toISOString())} · erstellt von ${uname(db.currentUserId)} · ${list.length} Vorgänge · Details in den folgenden Tabellenblättern`, { sz: 10, color: C.muted });
  const tiles = [
    [past ? "Offen zum Stichtag" : "Offene Vorgänge", openK.length, "0", past ? `Stand ${fmtDay(period.end)}` : inbox.length ? `davon ${inbox.length} nicht verteilt` : "alle verteilt", C.blue],
    ["Überfällig", overdueK.length, "0", past ? `zum ${fmtDay(period.end)}` : overdue.length ? "Fälligkeit überschritten" : "nichts überfällig ✓", overdueK.length ? C.critical : C.aqua],
    [period ? `Erledigt ${period.label}` : "Erledigt (30 Tage)", cur.done, "0", prevQ ? `${delta(cur.done, prevQ.done)}${vs} · ${cur.created} neu` : `${cur.created} neu erstellt`, C.aqua],
    ["Ø Durchlaufzeit", avgDays, '0.0" Tage"', prevQ && prevQ.dur != null ? `${prevQ.p.label}: ${prevQ.dur.toFixed(1).replace(".", ",")} Tage` : "von Erstellung bis erledigt", C.blue],
    ["SLA eingehalten", slaQ, "0%", prevQ && prevQ.sla != null ? `${prevQ.p.label}: ${Math.round(prevQ.sla * 100)} %` : sla.length ? `${sla.length} gelöste Serviceanfragen` : "noch keine Serviceanfragen", slaQ != null && slaQ < 0.9 ? C.orange : C.aqua],
    ["Einsatzstunden", Math.round(hours * 10) / 10, '0.0" h"', prevQ ? `${prevQ.p.label}: ${String(Math.round(prevQ.hours * 10) / 10).replace(".", ",")} h` : "laut Serviceberichten", C.orange],
  ];
  tiles.forEach(([label, v, fmt, hint, accent], k) => {
    const c = tileCol(k); const base = { fill: C.tile };
    box(4, c, 4, c + 1, label.toUpperCase(), { ...base, b: true, sz: 9, color: C.muted, indent: 1, border: { top: { color: accent, style: "thick" } } });
    box(5, c, 5, c + 1, v ?? "–", { ...base, b: true, sz: 26, color: label === "Überfällig" && v ? C.critical : C.ink, indent: 1, numFmt: fmt, align: "left" }, typeof v === "number" ? "n" : "s");
    box(6, c, 6, c + 1, hint, { ...base, sz: 9, color: C.muted, indent: 1 });
  });
  // Diagramme: 2 je Reihe, je 17 Zeilen hoch
  const charts = []; const H = 17; let row = 8;
  const pair = (left, right) => { if (left) charts.push({ ...left, at: [1, row, MID, row + H] }); if (right) charts.push({ ...right, at: [MID + 1, row, LAST + 1, row + H] }); row += H + 1; };
  pair({ type: "col", title: "Erstellt vs. erledigt", subtitle: period?.kind === "y" ? `je Monat, ${period.label}` : period ? `je Kalenderwoche, ${period.label}` : "je Kalenderwoche, letzte 12 Wochen", cats: trend.cats, series: [trend.ser(1, "Erstellt", C.blue), trend.ser(2, "Erledigt", C.orange)], labels: false, gap: 80 },
    { type: "bar", title: "Offene Vorgänge nach Status", subtitle: period ? "aktueller Stand" : "Anzahl", cats: byStatus.cats, series: [byStatus.ser(1, "Offen", C.blue)], hideValAx: true });
  pair({ type: "col", title: "Quartalsvergleich: erstellt vs. erledigt", subtitle: `${qRows[0][0]} bis ${qRows.at(-1)[0]}`, cats: qBlock.cats, series: [qBlock.ser(1, "Erstellt", C.blue), qBlock.ser(2, "Erledigt", C.orange)], labels: true, gap: 70 },
    { type: "col", title: "Ø Durchlaufzeit je Quartal", subtitle: "Tage von Erstellung bis erledigt", cats: qBlock.cats, series: [qBlock.ser(3, "Ø Tage", C.blue)], hideValAx: true, numFmt: "0.0", gap: 90 });
  pair(ppl.length ? { type: "bar", stacked: true, title: "Arbeitslast je Person", subtitle: "offene Vorgänge – rot: überfällig", cats: load.cats, series: [load.ser(1, "Offen im Plan", C.blue), load.ser(2, "Überfällig", C.critical)], labels: true, gap: 50 } : null,
    teamRows.length ? { type: "bar", title: "Offene Vorgänge je Team", subtitle: "Anzahl", cats: byTeam.cats, series: [byTeam.ser(1, "Offen", C.blue)], hideValAx: true } : null);
  pair({ type: "col", title: "Offene Vorgänge nach Priorität", subtitle: "Anzahl", cats: byPrio.cats, series: [byPrio.ser(1, "Offen", C.blue)], hideValAx: true, gap: 90 },
    sixth.b.cats.vals.length ? { type: "bar", title: sixth.title, subtitle: sixth.sub, cats: sixth.b.cats, series: [sixth.b.ser(1, sixth.name, C.blue)], hideValAx: true, numFmt: sixth.fmt } : null);
  for (let r = 8; r < row; r++) heights[r] = 15;

  // Listen: Überfällig (links) und nächste Termine (rechts)
  const hd = { b: true, color: "#FFFFFF", fill: C.navy, sz: 10, indent: 1 }; const td = (z) => ({ sz: 10, color: C.ink, indent: 1, fill: z ? "#FAFBFC" : "#FFFFFF", border: { bottom: { color: C.line } } });
  const listTitle = (c1, c2, text) => box(row, c1, row, c2, text, { b: true, sz: 13, color: C.ink });
  listTitle(1, MID - 1, `Überfällig – sofort klären (${overdue.length})`); listTitle(MID + 1, LAST, "Nächste Termine (7 Tage)"); heights[row] = 24; row++;
  box(row, 1, row, 1, "Vorgang", hd); box(row, 2, row, 5, "Zusammenfassung", hd); box(row, 6, row, 7, "Verantwortlich", hd); box(row, 8, row, 8, "Tage", { ...hd, align: "right" });
  box(row, MID + 1, row, MID + 2, "Termin", hd); box(row, MID + 3, row, MID + 6, "Vorgang", hd); box(row, MID + 7, row, LAST, "Techniker/in", hd); heights[row] = 20; row++;
  const ov = [...overdue].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12);
  const appts = open.filter((i) => i.appointmentAt && ACTIVE_APPT.includes(i.status) && dayKey(i.appointmentAt) >= tk && dayKey(i.appointmentAt) <= addDays(tk, 6)).sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt)).slice(0, 12);
  const n = Math.max(ov.length, appts.length, 1);
  for (let k = 0; k < n; k++) {
    const z = k % 2; const i = ov[k], a = appts[k];
    if (i) { box(row, 1, row, 1, keyOf(i), { ...td(z), b: true }); box(row, 2, row, 5, i.summary, td(z)); box(row, 6, row, 7, i.assigneeId ? uname(i.assigneeId) : "nicht zugewiesen", td(z)); box(row, 8, row, 8, daysBetween(i.dueDate, tk), { ...td(z), b: true, color: C.critical, align: "right", numFmt: "0" }, "n"); }
    else if (k === 0) box(row, 1, row, 8, "Nichts überfällig. ✓", { sz: 10, color: C.muted, indent: 1 });
    if (a) { box(row, MID + 1, row, MID + 2, a.appointmentAt, { ...td(z), numFmt: "dd.mm. hh:mm \"Uhr\"" }, "dt"); box(row, MID + 3, row, MID + 6, `${keyOf(a)} · ${a.customer?.company ? a.customer.company + " – " : ""}${a.summary}`, td(z)); box(row, MID + 7, row, LAST, a.assigneeId ? uname(a.assigneeId) : "–", td(z)); }
    else if (k === 0) box(row, MID + 1, row, LAST, "Keine Termine in den nächsten 7 Tagen.", { sz: 10, color: C.muted, indent: 1 });
    heights[row] = 18; row++;
  }
  const dash = { name: "Dashboard", free: true, grid: false, portrait: true, columns: cols, cells, merges, heights, charts, zoom: 90 };
  const dataSheet = { name: DS, free: true, columns: Array.from({ length: dc }, () => ({ w: 16 })), cells: data };
  return { dash, dataSheet };
}

/* ---------- Excel-Auswertung (.xlsx) ---------- */
/** Erstellt eine Excel-Mappe mit Dashboard (Kennzahlen und Diagramme), Übersicht, Vorgängen, Serviceeinsätzen, Personen, Monaten, Verlauf und Kommentaren. */
function exportXlsx(list, name, title, opts = {}) {
  list = list.filter(Boolean);
  const days = (a, b) => (a && b ? Math.round(((new Date(b) - new Date(a)) / 864e5) * 10) / 10 : null);
  const hrs = (a, b) => (a && b ? Math.round(((new Date(b) - new Date(a)) / 36e5) * 100) / 100 : null);
  const r2 = (n) => Math.round(n * 100) / 100;
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10 : null);
  const quota = (arr) => (arr.length ? arr.filter((x) => x.met).length / arr.length : null);
  const slaTxt = (i, kind) => { const x = slaInfo(i, kind); return !x ? "" : x.stopped ? (x.met ? "eingehalten" : "verletzt") : x.breached ? "verletzt (offen)" : "offen"; };
  const person = (id) => (id ? uname(id) : "");
  const hoursOf = (i) => Number(i.loggedH) || 0;
  const svc = list.filter((i) => proj(i.projectId)?.type === "service" && i.type !== "SUBTASK");
  const reports = svc.filter((i) => i.resolution || i.appointmentAt);
  const slaDone = (l) => l.map((i) => slaInfo(i, "resolve")).filter((x) => x && x.stopped);

  const vorg = { name: "Vorgänge", columns: [
    { h: "Schlüssel", w: 10 }, { h: "Projekt", w: 18 }, { h: "Typ", w: 14 }, { h: "Zusammenfassung", w: 46 }, { h: "Status", w: 20 }, { h: "Phase", w: 12 },
    { h: "Priorität", w: 11 }, { h: "Verantwortlich", w: 18 }, { h: "Team", w: 18 }, { h: "Melder", w: 20 }, { h: "Kundennr.", w: 10 }, { h: "Firma (Kunde)", w: 24 }, { h: "Ansprechpartner", w: 18 }, { h: "Kunden-E-Mail", w: 24 }, { h: "Anlage", w: 22 },
    { h: "Labels", w: 16 }, { h: "Sprint", w: 14 }, { h: "Epic", w: 22 }, { h: "Story Points", w: 8, t: "n" }, { h: "Schätzung (h)", w: 10, t: "h" }, { h: "Erfasst (h)", w: 10, t: "h" },
    { h: "Fällig", w: 11, t: "d" }, { h: "Überfällig", w: 9 }, { h: "Termin", w: 16, t: "dt" }, { h: "Erstellt", w: 16, t: "dt" }, { h: "Erledigt", w: 16, t: "dt" },
    { h: "Durchlaufzeit (Tage)", w: 11, t: "h" }, { h: "SLA Erste Antwort", w: 15 }, { h: "SLA Lösung", w: 15 }, { h: "Kommentare", w: 9, t: "n" }, { h: "Monat erstellt", w: 11 }],
    rows: list.map((i) => [keyOf(i), proj(i.projectId)?.name, TYPES[i.type]?.label, i.summary, statusOf(i).name, CAT_LABEL[statusOf(i).cat] || statusOf(i).cat,
      PRIOS[i.priority]?.label, person(i.assigneeId), team(i.teamId)?.name, i.reporterId ? person(i.reporterId) : i.customer?.name ? `${i.customer.name} (Kunde)` : "", customer(i.customerId)?.no, i.customer?.company, i.customer?.name, i.customer?.email, assetOf(customer(i.customerId), i.assetId)?.name,
      i.labels.join(", "), sprint(i.sprintId)?.name, issue(i.epicId)?.summary, i.storyPoints ?? null, i.estimateH ?? null, hoursOf(i),
      i.dueDate, isOverdue(i) ? "ja" : "nein", i.appointmentAt, i.createdAt, i.resolvedAt, days(i.createdAt, i.resolvedAt), slaTxt(i, "first"), slaTxt(i, "resolve"), i.comments.length, i.createdAt.slice(0, 7)]) };

  const eins = { name: "Serviceeinsätze", columns: [
    { h: "Schlüssel", w: 10 }, { h: "Kundennr.", w: 10 }, { h: "Firma", w: 24 }, { h: "Ansprechpartner", w: 18 }, { h: "Telefon", w: 14 }, { h: "Anlage", w: 22 }, { h: "Seriennr.", w: 14 }, { h: "Art", w: 14 }, { h: "Betreff", w: 40 }, { h: "Techniker/in", w: 18 },
    { h: "Termin", w: 16, t: "dt" }, { h: "Status", w: 20 }, { h: "Ursache", w: 30, wrap: true }, { h: "Durchgeführte Arbeiten", w: 50, wrap: true }, { h: "Material / Ersatzteile", w: 34, wrap: true },
    { h: "Arbeitszeit (h)", w: 10, t: "h" }, { h: "Bericht am", w: 16, t: "dt" }, { h: "Bericht von", w: 18 }, { h: "Gemeldet", w: 16, t: "dt" }, { h: "Reaktionszeit (h)", w: 10, t: "h" }, { h: "Lösungszeit (h)", w: 10, t: "h" }],
    rows: reports.map((i) => { const r = i.resolution || {};
      const cu = customer(i.customerId); const as = assetOf(cu, i.assetId);
      return [keyOf(i), cu?.no, i.customer?.company, i.customer?.name, i.customer?.phone, as?.name, as?.serial, TYPES[i.type]?.label, i.summary, person(i.assigneeId), i.appointmentAt, statusOf(i).name,
        r.cause, r.action, r.parts, typeof r.hours === "number" ? r.hours : null, r.at, person(r.by), i.createdAt, hrs(i.createdAt, i.firstResponseAt), hrs(i.createdAt, i.resolvedAt)]; }) };

  const people = db.users.filter((u) => list.some((i) => i.assigneeId === u.id));
  const pers = { name: "Personen", columns: [{ h: "Person", w: 20 }, { h: "Rolle", w: 18 }, { h: "Vorgänge gesamt", w: 10, t: "n" }, { h: "Zu erledigen", w: 9, t: "n" }, { h: "In Arbeit", w: 9, t: "n" },
    { h: "Erledigt", w: 9, t: "n" }, { h: "Überfällig", w: 9, t: "n" }, { h: "Einsätze mit Bericht", w: 11, t: "n" }, { h: "Stunden erfasst", w: 10, t: "h" }, { h: "Ø Durchlaufzeit (Tage)", w: 12, t: "h" }, { h: "SLA eingehalten", w: 10, t: "p" }],
    rows: people.map((u) => { const l = list.filter((i) => i.assigneeId === u.id);
      return [u.name, ROLES[u.role] || u.role, l.length, l.filter((i) => statusOf(i).cat === "todo").length, l.filter((i) => statusOf(i).cat === "progress").length, l.filter(isDone).length, l.filter(isOverdue).length,
        l.filter((i) => i.resolution).length, r2(l.reduce((s, i) => s + hoursOf(i), 0)), avg(l.filter((i) => i.resolvedAt).map((i) => days(i.createdAt, i.resolvedAt))), quota(slaDone(l))]; }) };

  const tms = { name: "Teams", columns: [{ h: "Team", w: 22 }, { h: "Leitung", w: 18 }, { h: "Mitglieder", w: 40 }, { h: "Vorgänge", w: 9, t: "n" }, { h: "Offen", w: 8, t: "n" }, { h: "Nicht verteilt", w: 10, t: "n" },
    { h: "Überfällig", w: 9, t: "n" }, { h: "Erledigt", w: 9, t: "n" }, { h: "Stunden erfasst", w: 10, t: "h" }],
    rows: db.teams.map((t) => { const l = list.filter((i) => i.teamId === t.id);
      return [t.name, person(t.leadId), teamMembers(t).map((u) => u.name).join(", "), l.length, l.filter((i) => !isDone(i)).length, l.filter(inTeamInbox).length, l.filter(isOverdue).length, l.filter(isDone).length, r2(l.reduce((s, i) => s + hoursOf(i), 0))]; }).filter((r) => r[3] > 0) };
  const months = [...new Set(list.flatMap((i) => [i.createdAt.slice(0, 7), i.resolvedAt?.slice(0, 7)]).filter(Boolean))].sort();
  const mon = { name: "Monate", columns: [{ h: "Monat", w: 10 }, { h: "Erstellt", w: 9, t: "n" }, { h: "Erledigt", w: 9, t: "n" }, { h: "davon Service", w: 10, t: "n" }, { h: "Einsatzstunden", w: 10, t: "h" }, { h: "SLA eingehalten", w: 10, t: "p" }],
    rows: months.map((m) => { const done = list.filter((i) => i.resolvedAt?.startsWith(m));
      return [m, list.filter((i) => i.createdAt.startsWith(m)).length, done.length, done.filter((i) => svc.includes(i)).length, r2(done.reduce((s, i) => s + (Number(i.resolution?.hours) || 0), 0)), quota(slaDone(done))]; }) };

  const byTime = (a, b) => String(a[1]).localeCompare(String(b[1]));
  const hist = { name: "Statusverlauf", columns: [{ h: "Schlüssel", w: 10 }, { h: "Zeitpunkt", w: 16, t: "dt" }, { h: "Person", w: 18 }, { h: "Feld", w: 16 }, { h: "Von", w: 22 }, { h: "Nach", w: 22 }],
    rows: list.flatMap((i) => i.history.map((h) => [keyOf(i), h.at, h.userId ? person(h.userId) : "Kunde/System", h.field, h.from, h.to])).sort(byTime) };
  const comm = { name: "Kommentare", columns: [{ h: "Schlüssel", w: 10 }, { h: "Zeitpunkt", w: 16, t: "dt" }, { h: "Von", w: 22 }, { h: "Sichtbarkeit", w: 16 }, { h: "Text", w: 80, wrap: true }],
    rows: list.flatMap((i) => i.comments.map((c) => [keyOf(i), c.at, c.userId ? person(c.userId) : `${c.author || "Kunde"} (Kunde)`, c.internal ? "intern" : "für Kunden sichtbar", c.text])).sort(byTime) };

  const open = list.filter((i) => !isDone(i) && i.type !== "EPIC"); const done = list.filter((i) => i.resolvedAt); const slr = slaDone(svc);
  const info = { name: "Übersicht", columns: [{ h: "Kennzahl", w: 40 }, { h: "Wert", w: 14, t: "h" }, { h: "Hinweis", w: 70 }], rows: [
    ["Auswertung", null, title], ["Erstellt am", null, fmtDT(new Date().toISOString())], ["Erstellt von", null, uname(db.currentUserId)],
    ["Vorgänge in dieser Auswertung", list.length, ""], ["davon offen", open.length, ""], ["davon überfällig", open.filter(isOverdue).length, "Fälligkeitsdatum überschritten"],
    ["davon erledigt", done.length, ""], ["Ø Durchlaufzeit erledigter Vorgänge (Tage)", avg(done.map((i) => days(i.createdAt, i.resolvedAt))), "von Erstellung bis Erledigung"],
    ["Serviceanfragen", svc.length, ""], ["Serviceeinsätze mit Bericht", svc.filter((i) => i.resolution).length, ""],
    ["Einsatzstunden laut Servicebericht", r2(svc.reduce((s, i) => s + (Number(i.resolution?.hours) || 0), 0)), ""],
    ["SLA Lösung eingehalten (%)", slr.length ? Math.round(quota(slr) * 1000) / 10 : null, "Anteil der gelösten Serviceanfragen innerhalb der Zielzeit"],
    ["Erfasste Stunden gesamt", r2(list.reduce((s, i) => s + hoursOf(i), 0)), ""],
    ["Tabellenblätter", null, "Quartale · Vorgänge · Serviceeinsätze · Teams · Personen · Monate · Statusverlauf · Kommentare – mit Filter in der Kopfzeile, direkt für Pivot-Tabellen nutzbar"]] };
  const qScope = opts.scope || list;
  const qs = quarterSeries(qScope, 1).map((p) => periodStats(qScope, p));
  const quart = { name: "Quartale", columns: [{ h: "Quartal", w: 10 }, { h: "Von", w: 11, t: "d" }, { h: "Bis", w: 11, t: "d" }, { h: "Erstellt", w: 9, t: "n" }, { h: "Erledigt", w: 9, t: "n" }, { h: "Veränderung erledigt", w: 12, t: "n" },
    { h: "davon Service", w: 10, t: "n" }, { h: "Einsatzstunden", w: 11, t: "h" }, { h: "Ø Durchlaufzeit (Tage)", w: 12, t: "h" }, { h: "Termintreue", w: 11, t: "p" }, { h: "SLA eingehalten", w: 11, t: "p" }],
    rows: qs.map((q, k) => [q.p.label, q.p.start, q.p.end, q.created, q.done, k ? q.done - qs[k - 1].done : null, q.service, r2(q.hours), q.dur == null ? null : Math.round(q.dur * 10) / 10, q.onTime, q.sla]) };
  const { dash, dataSheet } = xlsxDashboard(list, title, svc, { period: opts.period || null, scope: qScope });
  const sheets = [dash, quart, vorg, ...(reports.length ? [eins] : []), ...(tms.rows.length ? [tms] : []), pers, mon, hist, comm, info, dataSheet];
  download(name, XLSX.build(sheets, { title, author: sync.company || "GF Tracker" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  toast(`Excel-Datei „${name}“ mit ${list.length} Vorgängen erstellt.`);
}

/** Kundenstamm als Excel (gleiches Format wie der Import – zum Pflegen und Wiedereinspielen). */
function exportCustomersXlsx() {
  const cs = [...db.customers].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const sheets = [
    { name: "Kunden", columns: [{ h: "Kundennummer", w: 12 }, { h: "Firma", w: 30 }, { h: "Straße", w: 26 }, { h: "PLZ", w: 8 }, { h: "Ort", w: 18 }, { h: "Telefon", w: 16 }, { h: "E-Mail", w: 26 }, { h: "ERP-ID", w: 12 }, { h: "Notizen", w: 40, wrap: true }, { h: "Anlagen", w: 8, t: "n" }, { h: "Offene Vorgänge", w: 10, t: "n" }, { h: "Nächste Wartung", w: 12, t: "d" }],
      rows: cs.map((c) => [c.no, c.name, c.street, c.zip, c.city, c.phone, c.email, c.externalId, c.notes, (c.assets || []).length, custIssues(c).filter((i) => !isDone(i)).length, nextCustMaint(c)]) },
    { name: "Ansprechpartner", columns: [{ h: "Kundennummer", w: 12 }, { h: "Firma", w: 30 }, { h: "Name", w: 22 }, { h: "Funktion", w: 18 }, { h: "E-Mail", w: 28 }, { h: "Telefon", w: 16 }],
      rows: cs.flatMap((c) => (c.contacts || []).map((k) => [c.no, c.name, k.name, k.role, k.email, k.phone])) },
    { name: "Anlagen", columns: [{ h: "Kundennummer", w: 12 }, { h: "Firma", w: 28 }, { h: "Bezeichnung", w: 28 }, { h: "Hersteller", w: 14 }, { h: "Modell", w: 14 }, { h: "Seriennummer", w: 16 }, { h: "Baujahr", w: 8, t: "n" }, { h: "Standort", w: 14 }, { h: "Intervall (Monate)", w: 10, t: "n" }, { h: "Letzte Wartung", w: 12, t: "d" }, { h: "Nächste Wartung", w: 12, t: "d" }, { h: "In Betrieb", w: 8 }],
      rows: cs.flatMap((c) => (c.assets || []).map((a) => [c.no, c.name, a.name, a.manufacturer, a.model, a.serial, a.year ?? null, a.location, a.intervalMonths ?? null, a.lastMaintenance, nextMaintenance(a), a.active === false ? "nein" : "ja"])) },
  ];
  download(`kunden-anlagen-${today()}.xlsx`, XLSX.build(sheets, { title: "Kunden und Anlagen", author: sync.company || "GF Tracker" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  toast(`Excel mit ${cs.length} Kunden erstellt – kann bearbeitet und wieder importiert werden.`);
}

/* ---------- Benachrichtigungen ---------- */
function renderNotifs() {
  const list = db.notifications.filter((n) => n.userId === db.currentUserId).slice(0, 50); const unread = list.filter((n) => !n.read).length;
  const ic = { assign: "user", mention: "user", comment: "send", status: "check", overdue: "alert", due: "clock", sla: "clock", new: "queue" };
  const tone = { overdue: "red", sla: "red", due: "yellow", mention: "", assign: "", comment: "gray", status: "green", new: "" };
  $("#notifs").innerHTML = `<div class="row" style="padding:12px 14px;border-bottom:1px solid var(--border)"><b>Benachrichtigungen</b><span class="sp"></span>${unread ? `<button class="btn subtle sm" data-act="read-all">Alle als gelesen markieren</button>` : ""}</div>
    ${list.length ? list.map((n) => `<div class="notif ${n.read ? "" : "unread"}" data-act="open-notif" data-id="${n.id}"><span class="chip ${tone[n.type] || "gray"}" style="padding:4px;border-radius:50%">${icon(ic[n.type] || "bell")}</span>
      <div style="flex:1;min-width:0"><div class="${n.read ? "" : "b"}">${esc(n.title)}</div>${n.text ? `<div class="small muted">${esc(n.text)}</div>` : ""}<div class="small muted">${ago(n.at)}</div></div></div>`).join("") : '<p class="muted" style="padding:24px;text-align:center">Keine Benachrichtigungen.</p>'}`;
}

/* ---------- Ereignisse ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!e.target.closest("#notifs, .bell")) $("#notifs").classList.remove("open");
  if (!el) return;
  if (el.tagName === "SELECT" || (el.tagName === "INPUT" && el.type !== "checkbox")) return;
  const act = el.dataset.act, id = el.dataset.id;
  const cur = issue(ui.openIssue);
  if (el.closest("#drawer")) { if (el.getAttribute("href") === "#") e.preventDefault(); if (!["theme", "drawer-close"].includes(act)) closeDrawer(); } // Menüaktion: Menü schließen, dann ausführen
  switch (act) {
    case "open": if (e.target.closest("button:not([data-act=open]), select, input")) return; e.preventDefault(); openIssue(id); break;
    case "close": if (el.tagName === "A") closeModal({ fromNav: true }); else dismissModal(); break; // Link: Navigation übernimmt den Verlauf
    case "reload": location.reload(); break;
    case "goto": e.preventDefault(); go(el.dataset.href); break;
    case "menu": if (dockMQ.matches) { localState.sidenav = !docked(); saveLocal(); render(); } else openDrawer(); break;
    case "drawer-close": closeDrawer(); break;
    case "cf-file-del": createFiles.splice(Number(el.dataset.v), 1); renderCreateFiles(); break;
    case "shortcuts": openModal(`<div class="modal-h"><h2>Tastenkürzel</h2><button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
      <div class="modal-b"><div class="kv" style="grid-template-columns:max-content 1fr">${[["c", "Neuen Vorgang erstellen"], ["/", "Suchen (Suchfeld oben)"], ["Esc", "Fenster bzw. Menü schließen"], ["Alt + ← / →", "Zurück / Vor"], ["↑ ↓ Enter", "In den Suchvorschlägen wählen"], ["Strg + Enter", "Kommentar bzw. Formular absenden"]].map(([k, v]) => `<span><span class="kbd">${k}</span></span><span>${v}</span>`).join("")}</div></div>
      <div class="modal-f"><button class="btn primary" data-act="close">OK</button></div>`); break;
    case "theme": { const c = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = c === "dark" ? "light" : "dark"; try { localStorage.setItem("gft-theme", document.documentElement.dataset.theme); } catch {} applyBrand(); break; }
    case "notifs": { const p = $("#notifs"); p.classList.toggle("open"); if (p.classList.contains("open")) renderNotifs(); break; }
    case "read-all": db.notifications.forEach((n) => { if (n.userId === db.currentUserId) n.read = true; }); save(); renderNotifs(); renderTop(); break;
    case "open-notif": { const n = db.notifications.find((x) => x.id === id); if (n) { n.read = true; save(); $("#notifs").classList.remove("open"); renderTop(); if (n.issueId) openIssue(n.issueId); } break; }
    case "create": e.preventDefault(); createForm({ projectId: el.dataset.project || (el.dataset.team && db.projects.find((p) => p.teamId === el.dataset.team)?.id) || undefined, type: el.dataset.type, epicId: el.dataset.epic, ...(el.dataset.team ? { teamId: el.dataset.team } : {}) }); break;
    case "integ-reload": ui.integ = null; render(); break;
    case "load-archive": ensureArchive(); break;
    case "sys-reload": ui.sys = null; render(); break;
    case "brand-swatch": { const f = $("#brand-form"); f.color.value = el.dataset.v; f.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("on", x === el)); applyBrand({ ...ui.brand, color: el.dataset.v }); break; }
    case "brand-logo-del": api("/api/admin/brand/logo", { method: "DELETE" }).then((b) => { applyBrand(b); render(); toast("Logo entfernt"); }).catch((err) => toast(err.message)); break;
    case "nav-back": history.back(); break;
    case "m-search": e.preventDefault(); go("#/filters?state=open"); setTimeout(() => $("#ss-text")?.focus(), 80); break;
    case "sugg-issue": hideSuggestions(); $("#gsearch").value = ""; $("#gsearch").blur(); openIssue(id); break;
    case "sugg-goto": hideSuggestions(); $("#gsearch").value = ""; $("#gsearch").blur(); go(el.dataset.href); break;
    case "nav-fwd": history.forward(); break;
    case "rule-new": el.closest("details")?.removeAttribute("open"); ruleForm({ kind: el.dataset.kind, enabled: true }); break;
    case "rule-edit": ruleForm(ui.auto.rules.find((r) => r.id === id)); break;
    case "rule-del": { const r = ui.auto.rules.find((x) => x.id === id); if (!confirm(`Regel „${r.name}“ löschen?`)) break; saveRules(ui.auto.rules.filter((x) => x.id !== id)).then(() => toast("Regel gelöscht")).catch((err) => toast(err.message)); break; }
    case "rule-toggle": saveRules(ui.auto.rules.map((x) => (x.id === id ? { ...x, enabled: el.checked } : x))).then(() => toast(el.checked ? "Regel aktiv" : "Regel pausiert")).catch((err) => toast(err.message)); break;
    case "rule-run": { const n = ui.auto.recent.length; el.disabled = true; saveRules(ui.auto.rules, true).then((r) => toast(r.recent.length > n || (r.recent[0] && r.recent[0].at !== ui.auto.recent[0]?.at) ? "Regeln geprüft – neue Aktionen siehe „Zuletzt ausgeführt“." : "Regeln geprüft – nichts zu tun.")).catch((err) => toast(err.message)).finally(() => { el.disabled = false; }); break; }
    case "sys-backup": el.disabled = true; api("/api/admin/backup", { method: "POST" }).then((r) => { toast(`Sicherung erstellt: ${r.file}${r.copied ? ` · ${r.copied} Anhänge neu gesichert` : ""}`); ui.sys = null; render(); }).catch((err) => { el.disabled = false; toast(err.message); }); break;
    case "audit-more": { const last = ui.audit.entries.at(-1); api(`/api/admin/audit?${new URLSearchParams({ ...(ui.auditQ || {}), before: last.id })}`).then((r) => { ui.audit.entries.push(...r.entries); render(); }).catch((err) => toast(err.message)); break; }
    case "more-rows": ui.rowLimit += ROW_PAGE; renderSoft(); break;
    case "all-rows": ui.rowLimit = Number(el.dataset.n); renderSoft(); break;
    case "outlook-token": if (ui.outlook?.key && !confirm("Neuen Schlüssel erzeugen? Der bisherige funktioniert dann im Add-in nicht mehr.")) return;
      api("/api/me/outlook", { method: "POST" }).then((r) => { ui.outlook = { ...ui.outlook, key: r.key }; render();
        secretModal("Zugangsschlüssel für Outlook", "Diesen Schlüssel im Outlook-Add-in „GF Tracker“ einfügen (einmalig je Outlook-Konto). Das Add-in arbeitet dann in Ihrem Namen.", r.token); }).catch((err) => toast(err.message)); break;
    case "att-delete": if (!confirm("Anhang entfernen?")) return; api(`/api/issues/${id}/attachments/${el.dataset.k}`, { method: "DELETE" }).then(() => pull()).then(() => renderIssue()).catch((err) => toast(err.message)); break;
    case "cal-reset": if (!confirm("Neuen Kalender-Link erzeugen? Der bisherige Link funktioniert dann nicht mehr – das Abo in Outlook muss mit dem neuen Link neu eingerichtet werden.")) return;
      api("/api/me/calendar", { method: "POST" }).then((r) => { ui.calFeed = r; render(); toast("Neuer Link erzeugt."); }).catch((err) => toast(err.message)); break;
    case "copy": navigator.clipboard?.writeText(el.dataset.v).then(() => toast("In die Zwischenablage kopiert.")).catch(() => toast("Bitte markieren und mit Strg+C kopieren.")); break;
    case "integ-poll": api("/api/admin/mail/poll", { method: "POST" }).then((r) => { toast(r.skipped ? "Abruf ist deaktiviert." : r.error ? `Fehler: ${r.error}` : `Postfach abgerufen: ${r.created} neue Vorgänge, ${r.replies} Antworten.`); loadIntegrations(); }).catch((err) => toast(err.message)); break;
    case "factorial-sync": el.disabled = true; el.textContent = "Gleiche ab …"; api("/api/admin/factorial/sync", { method: "POST" }).then((r) => { toast(`Factorial: ${r.employees} Mitarbeiter, ${r.created} neu, ${r.absences} Abwesenheiten.`); loadIntegrations(); }).catch((err) => { toast(err.message); loadIntegrations(); }); break;
    case "apikey-revoke": if (!confirm("Schlüssel widerrufen? Programme, die ihn nutzen, verlieren sofort den Zugriff.")) return; api(`/api/admin/api-keys/${id}`, { method: "DELETE" }).then(loadIntegrations).catch((err) => toast(err.message)); break;
    case "hook-test": el.disabled = true; api(`/api/admin/webhooks/${id}/test`, { method: "POST" }).then((r) => toast(`Test erfolgreich (HTTP ${r.status}).`)).catch((err) => toast(err.message)).finally(loadIntegrations); break;
    case "hook-delete": if (!confirm("Webhook löschen?")) return; api(`/api/admin/webhooks/${id}`, { method: "DELETE" }).then(loadIntegrations).catch((err) => toast(err.message)); break;
    case "imp-type": ui.imp = { step: 2, update: true, type: el.dataset.v }; render(); break;
    case "imp-template": e.preventDefault(); importTemplate(ui.imp.type); break;
    case "imp-reset": ui.imp = null; render(); break;
    case "imp-check": { const imp = ui.imp; const T = IMPORT_TYPES[imp.type]; const miss = T.fields.filter((f) => f.req && !(imp.map[f.k] >= 0));
      if (miss.length) return toast(`Bitte Spalte zuordnen: ${miss.map((f) => f.label).join(", ")}`); imp.plan = planImport(imp); imp.step = 4; render(); break; }
    case "imp-run": { const imp = ui.imp; el.disabled = true; el.textContent = "Importiere …";
      runImport(imp, imp.plan).then((res) => { const n = imp.plan.filter((x) => x.action === "new").length, u = imp.plan.filter((x) => x.action === "update").length;
        imp.result = `Fertig: ${n} neu angelegt, ${u} aktualisiert${imp.plan.some((x) => x.action === "error") ? `, ${imp.plan.filter((x) => x.action === "error").length} Zeilen mit Fehler ausgelassen` : ""}.${res?.created != null ? ` (${res.created} Zugänge neu – Passwort unter Einstellungen setzen oder Anmeldung mit Microsoft nutzen.)` : ""}`;
        toast("Import abgeschlossen"); render(); }).catch((err) => { toast(err.message); el.disabled = false; el.textContent = "Erneut versuchen"; }); break; }
    case "customer-new": customerForm(); break;
    case "customer-edit": { const c = customer(id); if (c) customerForm(c); break; }
    case "customer-delete": { const c = customer(id); if (!c || !confirm(`Kunde „${c.name}“ löschen? Vorgänge bleiben erhalten (mit Kontaktdaten), verlieren aber die Verknüpfung.`)) return;
      db.customers = db.customers.filter((x) => x.id !== c.id); db.issues.forEach((i) => { if (i.customerId === c.id) { i.customerId = null; i.assetId = null; touch(i); } }); save(); go("#/customers"); toast(`Kunde „${c.name}“ gelöscht`); break; }
    case "customer-issue": { const sp = db.projects.find((p) => p.type === "service"); createForm({ projectId: sp?.id, customerId: id, type: "INCIDENT" }); break; }
    case "contact-new": { const c = customer(id); if (c) contactForm(c); break; }
    case "contact-edit": { const c = customer(id); const k = c?.contacts.find((x) => x.id === el.dataset.k); if (k) contactForm(c, k); break; }
    case "contact-delete": { const c = customer(id); if (!c) return; c.contacts = c.contacts.filter((x) => x.id !== el.dataset.k); c.updatedAt = new Date().toISOString(); save(); closeModal(); render(); break; }
    case "asset-new": { const c = customer(id); if (c) assetForm(c); break; }
    case "asset-edit": { const c = customer(id); const a = assetOf(c, el.dataset.k); if (a) assetForm(c, a); break; }
    case "asset-delete": { const c = customer(id); if (!c || !confirm("Anlage entfernen? Vorhandene Vorgänge bleiben erhalten.")) return; c.assets = c.assets.filter((x) => x.id !== el.dataset.k); c.updatedAt = new Date().toISOString(); save(); closeModal(); render(); break; }
    case "asset-maint": { const c = customer(id); const a = assetOf(c, el.dataset.k); const sp = db.projects.find((p) => p.type === "service"); if (!a || !sp) return;
      createIssue({ projectId: sp.id, ...maintenanceIssueData(c, a, nextMaintenance(a) || today()) }).then((i) => { render(); toast(`${keyOf(i)} angelegt`); openIssue(i.id); }).catch((err) => toast(err.message)); break; }
    case "export-customers": exportCustomersXlsx(); break;
    case "absence-new": absenceForm(team(id)); break;
    case "absence-delete": { const a = db.absences.find((x) => x.id === id); if (!a || !confirm(`Abwesenheit entfernen? ${uname(a.userId)}: ${absenceText(a)}`)) return; db.absences = db.absences.filter((x) => x.id !== id); save(); render(); break; }
    case "team-new": teamForm(); break;
    case "team-edit": { const t = team(id); if (t) teamForm(t); break; }
    case "team-delete": { const t = team(id); if (!t || !confirm(`Team „${t.name}“ löschen? Die Vorgänge bleiben erhalten, verlieren aber die Teamzuordnung.`)) return;
      db.teams = db.teams.filter((x) => x.id !== t.id); db.issues.forEach((i) => { if (i.teamId === t.id) { i.teamId = null; touch(i); } }); db.projects.forEach((p) => { if (p.teamId === t.id) p.teamId = null; });
      save(); closeModal(); go("#/teams"); toast(`Team „${t.name}“ gelöscht`); break; }
    case "export-team-xlsx": { const t = team(id); if (t) xlsxDialog(() => teamIssues(t), `auswertung-team-${t.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-")}`, `Team ${t.name}`); break; }
    case "yw-tab": setParam("tab", el.dataset.v); break;
    case "board-toggle": ui.board[el.dataset.v] = !ui.board[el.dataset.v]; render(); break;
    case "board-user": { const v = el.dataset.v; const a = ui.board.users; ui.board.users = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; render(); break; }
    case "backlog-epic": setParam("epic", el.dataset.v); break;
    case "tl-toggle": { ui.tlOpen ||= []; ui.tlOpen = ui.tlOpen.includes(id) ? ui.tlOpen.filter((x) => x !== id) : [...ui.tlOpen, id]; render(); break; }
    case "queue": setParam("q", el.dataset.v); break;
    case "new-project": projectForm(); break;
    case "new-sprint": { const p = proj(el.dataset.project); const n = db.sprints.filter((s) => s.projectId === p.id).length + 1; db.sprints.push({ id: uid(), projectId: p.id, name: `${p.key} Sprint ${n}`, goal: "", state: "future", start: null, end: null, committed: null, completed: null }); save(); render(); toast("Sprint erstellt"); break; }
    case "start-sprint": sprintForm(sprint(id)); break;
    case "complete-sprint": completeSprintForm(sprint(id)); break;
    case "delete-sprint": { const s = sprint(id); if (confirm(`${s.name} löschen? Vorgänge wandern ins Backlog.`)) { db.issues.forEach((i) => { if (i.sprintId === id) i.sprintId = null; }); db.sprints = db.sprints.filter((x) => x.id !== id); save(); render(); } break; }
    case "delete-project": { const p = proj(id); if (confirm(`Projekt „${p.name}“ mit ${projIssues(p).length} Vorgängen endgültig löschen?`)) { db.issues = db.issues.filter((i) => i.projectId !== id); db.sprints = db.sprints.filter((s) => s.projectId !== id); db.projects = db.projects.filter((x) => x.id !== id); save(); go("#/projects"); } break; }
    case "save-filter": { const jql = $("#jql") ? $("#jql").value.trim() : ui.lastJql; if (!jql) return; try { parseJql(jql); } catch (err) { return toast("Abfrage fehlerhaft: " + err.message); } const name = prompt("Name des Filters:"); if (name?.trim()) { const f = { id: uid(), name: name.trim(), jql, ownerId: db.currentUserId }; db.filters.push(f); save(); go(`#/filters?filter=${f.id}`); toast("Filter gespeichert"); } break; }
    case "delete-filter": db.filters = db.filters.filter((f) => f.id !== id); save(); go("#/filters"); break;
    case "col-toggle": { const cur = colList(); localState.cols = el.checked ? [...cur, el.dataset.v] : cur.filter((k) => k !== el.dataset.v); saveLocal(); render(); $(".col-chooser")?.setAttribute("open", ""); break; }
    case "col-reset": localState.cols = null; saveLocal(); render(); break;
    case "export-csv": exportCsv(ui.lastResults || [], `vorgaenge-${today()}.csv`); break;
    case "export-xlsx": { const res = ui.lastResults || []; xlsxDialog(() => res, "auswertung-filter", "Suchergebnis / Filter"); break; }
    case "export-all-xlsx": xlsxDialog(() => db.issues, "auswertung-gesamt", "Alle Projekte"); break;
    case "export-project-xlsx": { const pp = proj(el.dataset.project); if (pp) xlsxDialog(() => projIssues(pp), `auswertung-${pp.key}`, `Projekt ${pp.name}`); break; }
    case "export-quarter-xlsx": { const [y, q] = String(el.dataset.q).split(":").map(Number); const per = quarterRange(y, q);
      if (!ui.archiveLoaded) { ensureArchive().then(() => el.click()); break; }
      exportXlsx(db.issues.filter((i) => activeIn(i, per)), `auswertung-gesamt-${per.label.toLowerCase().replace(/\s+/g, "-")}-${today()}.xlsx`, `Alle Projekte · ${per.label}`, { period: per, scope: db.issues }); break; }
    case "export-all-csv": exportCsv(db.issues, `alle-vorgaenge-${today()}.csv`); break;
    case "export-json": location.href = authUrl("/api/admin/export"); break;
    case "import-json": $("#json-file").click(); break;
    case "logout": api("/api/logout", { method: "POST" }).finally(() => { if (TEAMS) { try { localStorage.removeItem("gft-teams-token"); } catch {} } location.href = LOGIN_URL; }); break;
    case "user-scope": scopeForm(user(id)); break;
    case "user-invite": { const u = user(id); el.closest("details")?.removeAttribute("open");
      api(`/api/admin/users/${id}/invite`, { method: "POST" }).then((r) => { ui.accounts = null; inviteModal(u, r); }).catch((err) => toast(err.message)); break; }
    case "user-logout": { const u = user(id); if (!confirm(`${u.name} auf allen Geräten abmelden?`)) break;
      api(`/api/admin/users/${id}/logout`, { method: "POST" }).then(() => { ui.accounts = null; render(); toast(`${u.name} wurde abgemeldet.`); }).catch((err) => toast(err.message)); break; }
    case "session-revoke": api(`/api/me/sessions/${id}`, { method: "DELETE" }).then(() => { ui.mySessions = null; render(); toast("Gerät abgemeldet."); }).catch((err) => toast(err.message)); break;
    case "session-revoke-others": api("/api/me/sessions/others", { method: "DELETE" }).then(() => { ui.mySessions = null; render(); toast("Alle anderen Geräte wurden abgemeldet."); }).catch((err) => toast(err.message)); break;
    case "set-password": { const u = user(id); const pw = prompt(`Neues Passwort für ${u.name} (mind. 10 Zeichen):`); if (!pw) break;
      api(`/api/admin/users/${id}/password`, { method: "POST", body: { password: pw } }).then(() => toast(`Passwort für ${u.name} gesetzt – bitte persönlich übergeben.`)).catch((err) => toast(err.message)); break; }
    case "install-app": if (installPrompt) { installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; render(); }); } break;
    case "copy-embed": navigator.clipboard?.writeText($("#embed-code").value).then(() => toast("In die Zwischenablage kopiert.")).catch(() => { $("#embed-code").select(); toast("Bitte mit Strg+C kopieren."); }); break;
    case "mail-test": api("/api/admin/mail-test", { method: "POST" }).then((r) => toast(`Test-E-Mail an ${r.to} gesendet.`)).catch((err) => toast(err.message)); break;
    case "user-active": { const u = user(id); if (u) { u.active = el.checked; save(); render(); } break; }
    // Vorgang
    case "issue-tab": ui.issueTab = el.dataset.v; renderIssue(); break;
    case "edit-desc": ui.editingDesc = true; renderIssue(); $("#desc-edit")?.focus(); break;
    case "cancel-desc": ui.editingDesc = false; renderIssue(); break;
    case "save-desc": if (cur) { updateIssue(cur, { description: $("#desc-edit").value }); ui.editingDesc = false; renderIssue(); } break;
    case "watch": if (cur) { const w = cur.watchers.includes(db.currentUserId); cur.watchers = w ? cur.watchers.filter((x) => x !== db.currentUserId) : [...cur.watchers, db.currentUserId]; save(); renderIssue(); toast(w ? "Beobachtung beendet" : "Sie beobachten diesen Vorgang"); } break;
    case "assign-me": e.preventDefault(); if (cur) { updateIssue(cur, { assigneeId: db.currentUserId }); render(); renderIssue(); } break;
    case "take": { const it = issue(id); if (it) { takeIssue(it); render(); if (ui.modal === "issue") renderIssue(); } break; }
    case "step": { const it = issue(id); const t = it && stepsFor(it).find((x) => x.id === el.dataset.t); if (t) stepForm(it, t); break; }
    case "step-cancel": dismissModal(); break;
    case "print-report": { const it = issue(id); if (it) printReport(it); break; }
    case "dispatch-week": ui.dispatchWeek = el.dataset.v === "0" ? 0 : (ui.dispatchWeek || 0) + Number(el.dataset.v); render(); break;
    case "quick-done": if (cur) { const wf = workflowOf(proj(cur.projectId)); updateIssue(cur, { status: wf.find((s) => s.cat === "done").id }); render(); renderIssue(); toast(`${keyOf(cur)} erledigt ✓`); } break;
    case "add-subtask": ui.addingSub = true; renderIssue(); $("#sub-form input")?.focus(); break;
    case "add-link": ui.addingLink = true; renderIssue(); $("#link-form input")?.focus(); break;
    case "unlink": if (cur) { const l = cur.links[Number(el.dataset.v)]; const o = issue(l.issueId); cur.links.splice(Number(el.dataset.v), 1); if (o) o.links = o.links.filter((x) => x.issueId !== cur.id); save(); renderIssue(); } break;
    case "clone": if (cur) { const { id: _id, no: _no, ...rest } = cur; createIssue({ ...rest, labels: [...cur.labels], summary: `KOPIE – ${cur.summary}`, reporterId: db.currentUserId }).then((c) => { toast(`${keyOf(c)} erstellt`); render(); openIssue(c.id); }).catch((err) => toast(err.message)); } break;
    case "delete-issue": if (cur && confirm(`${keyOf(cur)} ${children(cur).length ? `mit ${children(cur).length} Teilaufgaben ` : ""}endgültig löschen?`)) { deleteIssue(cur); closeModal(); render(); toast("Vorgang gelöscht"); } break;
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "board-lane") { ui.board.lane = el.value; render(); return; }
  if (el.hasAttribute("data-autosubmit")) { el.form.requestSubmit(); return; }
  if (el.dataset.act === "hook-active") { api(`/api/admin/webhooks/${el.dataset.id}`, { method: "PATCH", body: { active: el.checked } }).then(loadIntegrations).catch((err) => toast(err.message)); return; }
  if (el.dataset.act === "factorial-create") { api("/api/admin/integrations/settings", { method: "POST", body: { factorialCreateUsers: el.checked } }).then((r) => { ui.integ = r; render(); }).catch((err) => toast(err.message)); return; }
  if (el.id === "brand-logo" && el.files.length) { const file = el.files[0]; el.value = "";
    fetch("/api/admin/brand/logo", { method: "PUT", headers: { "Content-Type": file.type, "X-GFT": "1", ...authHeaders() }, body: file }).then(async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error); applyBrand(b); render(); toast("Logo gespeichert"); }).catch((err) => toast(err.message)); return; }
  if (el.form?.id === "brand-form" && el.name === "color") { el.form.querySelectorAll(".swatch").forEach((x) => x.classList.toggle("on", x.dataset.v === el.value)); applyBrand({ ...ui.brand, color: el.value }); return; }
  if (el.id === "cf-files" && el.files.length) { addCreateFiles([...el.files]); el.value = ""; return; }
  if (el.id === "att-input" && el.files.length) { uploadFiles(el.dataset.id, [...el.files]); el.value = ""; return; }
  if (el.id === "imp-file" && el.files[0]) { importFile(el.files[0]); el.value = ""; return; }
  if (el.id === "imp-sheet") { importSheet(Number(el.value)); return; }
  if (el.dataset.act === "imp-map") { ui.imp.map[el.dataset.k] = Number(el.value); ui.imp.plan = null; render(); return; }
  if (el.id === "imp-project") { ui.imp.projectId = el.value; ui.imp.plan = null; return; }
  if (el.id === "imp-update") { ui.imp.update = el.checked; ui.imp.plan = null; render(); return; }
  if (el.id === "cf-customer") { const f = el.form; const keep = { summary: f.summary.value, description: f.description.value, priority: f.priority.value }; createForm({ projectId: f.projectId.value, type: f.type.value, customerId: el.value || null, teamId: f.teamId?.value });
    const nf = $("#create-form"); nf.summary.value = keep.summary; nf.description.value = keep.description; nf.priority.value = keep.priority; return; }
  if (el.id === "dispatch-team") { ui.dispatchTeam = el.value; render(); return; }
  if (el.dataset.act === "team-assign") { const i = issue(el.dataset.id); if (i && el.value) { updateIssue(i, { assigneeId: el.value }); render(); toast(`${keyOf(i)} an ${uname(el.value)} verteilt`); } return; }
  if (el.id === "portal-project") { go(`#/portal/${el.value}`); return; }
  if (el.id === "cf-project") { const f = el.form; const data = { summary: f.summary.value, description: f.description.value }; ui.lastProject = el.value; createForm({ projectId: el.value }); $("#create-form").summary.value = data.summary; $("#create-form").description.value = data.description; return; }
  if (el.id === "json-file" && el.files[0]) {
    const r = new FileReader(); r.onload = async () => {
      let d; try { d = JSON.parse(r.result); } catch { return toast("Die Datei ist keine gültige Sicherung."); }
      if (!confirm("ACHTUNG: Alle Projekte und Vorgänge werden durch den Inhalt der Sicherung ersetzt. Fortfahren?")) return;
      try { const res = await api("/api/admin/import", { method: "POST", body: d }); await reloadState(); toast(`${res.imported} Vorgänge${res.files ? ` und ${res.files} Anhänge` : ""} importiert.${res.usersWithoutPassword.length ? ` Ohne Passwort: ${res.usersWithoutPassword.length} Personen – bitte unter Einstellungen Passwort setzen.` : ""}`); }
      catch (err) { toast(err.message); }
    }; r.readAsText(el.files[0]); el.value = ""; return;
  }
  if (el.dataset.act === "user-role") { const u = user(el.dataset.id); if (u) { u.role = el.value; save(); render(); toast(`${u.name}: ${ROLES[u.role]} – ${ROLE_INFO[u.role]}`); } return; }
  const cur = issue(ui.openIssue);
  if (el.dataset.f && cur) {
    const f = el.dataset.f; let v = el.value;
    if (f === "summary") { v = v.trim(); if (!v) { el.value = cur.summary; return; } }
    if (["assigneeId", "reporterId", "dueDate", "startDate", "sprintId", "epicId", "teamId", "assetId"].includes(f)) v = v || null;
    if (f === "customerId") { const c = customer(v); updateIssue(cur, { customerId: c?.id || null, assetId: null, ...(c ? { customer: customerSnapshot(c) } : {}) }); render(); renderIssue(); return; }
    if (f === "storyPoints" || f === "estimateH") v = v === "" ? null : Number(v);
    if (f === "labels") v = v.split(",").map((x) => x.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
    if (f === "sprintId") children(cur).forEach((c) => (c.sprintId = v));
    updateIssue(cur, { [f]: v }); render(); renderIssue();
  }
});
let ssTimer = null, gsTimer = null;
document.addEventListener("input", (e) => {
  if (e.target.id === "ss-text") { clearTimeout(ssTimer); ssTimer = setTimeout(() => { // Ergebnisse beim Tippen, ohne für jeden Buchstaben einen Verlaufsschritt
    const { params } = route(); const v = $("#ss-text").value; if (v.trim()) params.set("text", v); else params.delete("text"); params.delete("issue");
    history.replaceState(history.state, "", `#/filters?${params}`); lastBase = baseHash(); const pos = $("#ss-text").selectionStart; render(); const inp = $("#ss-text"); inp.focus(); inp.setSelectionRange(pos, pos); }, 250); }
  if (e.target.id === "drawer-q") { const q = norm(e.target.value.trim()); const d = e.target.closest(".drawer, .sidenav");
    d.querySelectorAll(".dr-item[data-kw]").forEach((a) => { a.hidden = !!q && !a.dataset.kw.includes(q); });
    d.querySelectorAll(".dr-proj, .dr-sec").forEach((x) => { const any = [...x.querySelectorAll(".dr-item[data-kw]")].some((a) => !a.hidden); x.hidden = !!q && !any; if (q && any) x.open = true; }); }
  if (e.target.id === "gsearch") { clearTimeout(gsTimer); gsTimer = setTimeout(() => showSuggestions(e.target.value), 120); }
  if (e.target.id === "cust-q") { ui.custQ = e.target.value; const pos = e.target.selectionStart; render(); const s = $("#cust-q"); s.focus(); s.setSelectionRange(pos, pos); }
  if (e.target.id === "board-q") { ui.board.q = e.target.value; const pos = e.target.selectionStart; render(); const s = $("#board-q"); s.focus(); s.setSelectionRange(pos, pos); }
  if (e.target.id === "np-name") { const k = $("#np-key"); if (!k.dataset.touched) k.value = e.target.value.replace(/[^A-Za-zÄÖÜäöü ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 4).toUpperCase().replace(/[ÄÖÜ]/g, (c) => ({ Ä: "A", Ö: "O", Ü: "U" })[c]) || e.target.value.slice(0, 3).toUpperCase(); }
  if (e.target.id === "np-key") e.target.dataset.touched = "1";
});
document.addEventListener("submit", async (e) => {
  const f = e.target; e.preventDefault();
  if (f.dataset.busy) return; f.dataset.busy = "1";
  const btns = $$("button[type=submit], button:not([type])", f); btns.forEach((b) => (b.disabled = true));
  try { await handleSubmit(e, f); } catch (err) { toast(err.message || "Aktion fehlgeschlagen."); }
  finally { delete f.dataset.busy; btns.forEach((b) => (b.disabled = false)); }
});
async function handleSubmit(e, f) {
  const fd = new FormData(f); const cur = issue(ui.openIssue);
  switch (f.id) {
    case "create-form": {
      const labels = String(fd.get("labels") || "").split(",").map((x) => x.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
      const cname = fd.get("cname"), cemail = fd.get("cemail");
      const i = await createIssue({ projectId: fd.get("projectId"), type: fd.get("type"), summary: fd.get("summary"), description: fd.get("description"), assigneeId: fd.get("assigneeId"), priority: fd.get("priority"), teamId: fd.get("teamId") || null,
        dueDate: fd.get("dueDate") || null, labels, storyPoints: fd.get("storyPoints") ? Number(fd.get("storyPoints")) : null, sprintId: fd.get("sprintId") || null, epicId: fd.get("epicId") || null,
        customerId: customer(fd.get("customerId"))?.id || null, assetId: fd.get("assetId") || null,
        customer: customer(fd.get("customerId")) ? customerSnapshot(customer(fd.get("customerId")), fd.get("contactId")) : cname || cemail ? { name: cname || cemail, company: fd.get("ccompany") || "", email: cemail || "", phone: "" } : null });
      ui.lastProject = i.projectId;
      if (createFiles.length) { const files = createFiles; createFiles = []; await syncNow(); await uploadFiles(i.id, files); }
      if (fd.get("another")) { const pid = i.projectId; createForm({ projectId: pid }); $("#create-form").another.checked = true; render(); toast(`${keyOf(i)} erstellt`); }
      else { closeModal(); render(); toast(`${keyOf(i)} erstellt`); openIssue(i.id); }
      break; }
    case "step-form": {
      const it = issue(f.dataset.id); const t = it && TRANSITIONS[PROJECT_TYPES[proj(it.projectId).type].workflow].find((x) => x.id === f.dataset.t);
      if (!it || !t) return;
      { const who = fd.get("assigneeId") || it.assigneeId, d = fd.get("date"); const ab = who && d && absenceOn(who, d);
        if (ab && !confirm(`${uname(who)} ist an diesem Tag abwesend: ${absenceText(ab)}. Trotzdem einplanen?`)) return; }
      performStep(it, t, fd); const back = ui.stepReturn; closeModal(); render(); toast(`${keyOf(it)}: ${t.label} ✓`); if (back) openIssue(back);
      break; }
    case "comment-form": {
      const text = String(fd.get("text") || "").trim(); if (!text || !cur) return;
      const internal = e.submitter?.name === "internal";
      addComment(cur, text, { internal }); render(); renderIssue(); break; }
    case "sub-form": { if (!cur) return; const c = await createIssue({ projectId: cur.projectId, type: "SUBTASK", summary: fd.get("summary"), assigneeId: fd.get("assigneeId"), parentId: cur.id, priority: cur.priority });
      cur.history.unshift({ id: uid(), at: new Date().toISOString(), userId: db.currentUserId, field: "Teilaufgabe", from: "", to: keyOf(c) }); ui.addingSub = false; save(); render(); renderIssue(); toast(`${keyOf(c)} erstellt`); break; }
    case "link-form": { if (!cur) return; const o = byKey(fd.get("key")); if (!o) return toast("Vorgang nicht gefunden."); if (o.id === cur.id) return toast("Ein Vorgang kann nicht mit sich selbst verknüpft werden."); linkIssues(cur, fd.get("type"), o); ui.addingLink = false; renderIssue(); break; }
    case "time-form": { if (!cur) return; const h = Number(fd.get("h")); if (!h || h <= 0) return; cur.loggedH = Math.round(((cur.loggedH || 0) + h) * 100) / 100;
      cur.history.unshift({ id: uid(), at: new Date().toISOString(), userId: db.currentUserId, field: "Arbeitszeit", from: "", to: `${h} h erfasst` }); touch(cur); save(); renderIssue(); break; }
    case "jql-form": go(`#/filters?jql=${encodeURIComponent($("#jql").value.trim())}`); break;
    case "sprint-form": {
      const s = sprint(f.dataset.id); const p = proj(s.projectId); if (activeSprint(p)) return toast("Es läuft bereits ein Sprint.");
      Object.assign(s, { name: fd.get("name"), start: fd.get("start"), end: fd.get("end"), goal: fd.get("goal"), state: "active", committed: db.issues.filter((i) => i.sprintId === s.id && i.type !== "SUBTASK").reduce((a, i) => a + (i.storyPoints || 0), 0) });
      save(); closeModal(); go(`#/p/${p.key}/board`); toast(`${s.name} gestartet`); break; }
    case "complete-form": {
      const s = sprint(f.dataset.id); const p = proj(s.projectId); const list = db.issues.filter((i) => i.sprintId === s.id);
      let target = fd.get("target") || "backlog";
      if (target === "new") { const ns = { id: uid(), projectId: p.id, name: `${p.key} Sprint ${db.sprints.filter((x) => x.projectId === p.id).length + 1}`, goal: "", state: "future", start: null, end: null, committed: null, completed: null }; db.sprints.push(ns); target = ns.id; }
      list.filter((i) => !isDone(i)).forEach((i) => { i.sprintId = target === "backlog" ? null : target; });
      s.completed = list.filter((i) => isDone(i) && i.type !== "SUBTASK").reduce((a, i) => a + (i.storyPoints || 0), 0); s.state = "closed"; s.completedAt = new Date().toISOString(); s.end = s.end && s.end < today() ? s.end : today();
      save(); closeModal(); go(`#/p/${p.key}/reports`); toast(`${s.name} abgeschlossen: ${s.completed} SP erledigt`); break; }
    case "new-project-form": {
      const key = String(fd.get("key")).toUpperCase(); if (projByKey(key)) return toast(`Schlüssel ${key} ist bereits vergeben.`);
      const p = { id: uid(), key, name: String(fd.get("name")).trim(), type: fd.get("type"), leadId: fd.get("leadId") || db.currentUserId, color: PALETTE[db.projects.length % PALETTE.length], nextNo: 1, desc: "" };
      db.projects.push(p); if (p.type === "software") db.sprints.push({ id: uid(), projectId: p.id, name: `${key} Sprint 1`, goal: "", state: "future", start: null, end: null, committed: null, completed: null });
      save(); closeModal(); go(`#/p/${key}`); toast(`Projekt ${p.name} erstellt`); break; }
    case "project-form": { const p = proj(f.dataset.id); Object.assign(p, { name: fd.get("name"), desc: fd.get("desc"), leadId: fd.get("leadId") || p.leadId, color: fd.get("color"), teamId: fd.get("teamId") || null }); save(); render(); toast("Gespeichert"); break; }
    case "xlsx-form": {
      const x = ui.xlsx; if (!x) break; const v = String(fd.get("period")); let per = null;
      if (!ui.archiveLoaded) await ensureArchive(); // ältere Quartale brauchen das Archiv
      x.scope = x.scopeFn();
      if (v.startsWith("q:")) { const [, y, q] = v.split(":").map(Number); per = quarterRange(y, q); } else if (v.startsWith("y:")) per = yearRange(Number(v.slice(2)));
      const l = per ? x.scope.filter((i) => activeIn(i, per)) : x.scope;
      closeModal(); exportXlsx(l, `${x.base}${per ? "-" + per.label.toLowerCase().replace(/\s+/g, "-") : ""}-${today()}.xlsx`, per ? `${x.title} · ${per.label}` : x.title, { period: per, scope: x.scope }); break; }
    case "customer-form": {
      const data = Object.fromEntries(["name", "no", "street", "zip", "city", "phone", "email", "externalId", "notes"].map((k) => [k, String(fd.get(k) || "").trim()]));
      if (data.no && db.customers.some((x) => x.no === data.no && x.id !== f.dataset.id)) return toast(`Kundennummer ${data.no} ist bereits vergeben.`);
      let c = customer(f.dataset.id); const now = new Date().toISOString();
      if (c) Object.assign(c, data, { updatedAt: now }); else { c = { id: uid(), ...data, contacts: [], assets: [], createdAt: now, updatedAt: now }; db.customers.push(c); }
      save(); closeModal(); go(`#/customers/${c.id}`); render(); toast(`${c.name} gespeichert`); break; }
    case "contact-form": {
      const c = customer(f.dataset.id); if (!c) break; const data = Object.fromEntries(["name", "role", "email", "phone"].map((k) => [k, String(fd.get(k) || "").trim()]));
      const k = c.contacts.find((x) => x.id === f.dataset.k); if (k) Object.assign(k, data); else c.contacts.push({ id: uid(), ...data });
      if (!c.email && data.email && c.contacts.length === 1) c.email = data.email; c.updatedAt = new Date().toISOString(); save(); closeModal(); render(); break; }
    case "asset-form": {
      const c = customer(f.dataset.id); if (!c) break; const num = (k) => (fd.get(k) === "" || fd.get(k) == null ? null : Number(fd.get(k)));
      const data = { name: String(fd.get("name")).trim(), manufacturer: String(fd.get("manufacturer") || "").trim(), model: String(fd.get("model") || "").trim(), serial: String(fd.get("serial") || "").trim(), year: num("year"), location: String(fd.get("location") || "").trim(),
        intervalMonths: num("intervalMonths"), lastMaintenance: fd.get("lastMaintenance") || null, nextMaintenance: fd.get("nextMaintenance") || null, active: fd.get("active") === "on" };
      const a = assetOf(c, f.dataset.k); if (a) Object.assign(a, data); else c.assets.push({ id: uid(), ...data });
      c.updatedAt = new Date().toISOString(); save(); closeModal(); render(); toast(`Anlage „${data.name}“ gespeichert`); break; }
    case "integ-m365": {
      const body = { mailInbox: fd.get("mailInbox"), calendarMinutes: Number(fd.get("calendarMinutes")), mailInEnabled: fd.get("mailInEnabled") === "on", calendarSync: fd.get("calendarSync") === "on", calendarPull: fd.get("calendarPull") === "on", calendarInviteCustomer: fd.get("calendarInviteCustomer") === "on", ...(f.ssoMicrosoft.disabled ? {} : { ssoMicrosoft: fd.get("ssoMicrosoft") === "on" }) };
      ui.integ = await api("/api/admin/integrations/settings", { method: "POST", body }); render(); toast("Gespeichert"); break; }
    case "integ-teams": ui.integ = await api("/api/admin/integrations/settings", { method: "POST", body: { teamsNotify: fd.get("teamsNotify") === "on" } }); render(); toast("Gespeichert"); break;
    case "apikey-form": {
      const r = await api("/api/admin/api-keys", { method: "POST", body: { name: fd.get("name"), scope: fd.get("scope") } }); f.reset(); await loadIntegrations();
      const base = location.origin;
      secretModal("API-Schlüssel erstellt", `Schlüssel für <b>${esc(String(fd.get("name")))}</b> (${fd.get("scope") === "write" ? "lesen + schreiben" : "nur lesen"}):`, r.token,
        `<details open><summary class="small b">Beispiel</summary><pre class="code">curl -H "Authorization: Bearer ${esc(r.token)}" \\
  "${esc(base)}/api/v1/issues?project=SD&statusCategory=progress"</pre></details>`);
      break; }
    case "hook-form": {
      const h = await api("/api/admin/webhooks", { method: "POST", body: { name: fd.get("name"), url: fd.get("url"), format: fd.get("format"), events: fd.getAll("events") } }); f.reset(); await loadIntegrations();
      secretModal("Webhook angelegt", `Signaturschlüssel für <b>${esc(h.name)}</b> – damit kann das Zielsystem prüfen, dass Nachrichten wirklich vom GF Tracker kommen (HMAC-SHA256 über den Nachrichtentext, Header <code>X-GFT-Signature</code>):`, h.secret,
        `<p class="small muted" style="margin:0">Tipp: Mit „Testen“ eine Probenachricht senden.</p>`);
      break; }
    case "absence-form": {
      const a = { id: uid(), userId: fd.get("userId"), start: fd.get("start"), end: fd.get("end"), type: fd.get("type"), note: String(fd.get("note") || "").trim(), source: "manual" };
      if (a.end < a.start) return toast("„Bis“ liegt vor „Von“.");
      db.absences.push(a); save(); closeModal(); render(); toast(`Abwesenheit eingetragen: ${uname(a.userId)}, ${absenceText(a)}`); break; }
    case "team-form": {
      const members = fd.getAll("m"); const t = team(f.dataset.id);
      const fix = (x) => { if (x.leadId && !x.memberIds.includes(x.leadId)) x.memberIds.unshift(x.leadId); return x; };
      if (t) { if (me().role === "ADMIN") Object.assign(t, { name: String(fd.get("name")).trim(), color: fd.get("color"), leadId: fd.get("leadId") || null, site: fd.get("site") || null }); t.memberIds = members; t.desc = String(fd.get("desc") || ""); fix(t); }
      else db.teams.push(fix({ id: uid(), name: String(fd.get("name")).trim(), color: fd.get("color"), site: fd.get("site") || null, leadId: fd.get("leadId") || null, memberIds: members, desc: String(fd.get("desc") || "") }));
      save(); closeModal(); render(); toast(t ? `Team „${t.name}“ gespeichert` : "Team angelegt"); break; }
    case "rule-form": {
      const k = f.dataset.kind; const r = { id: f.dataset.id || uid(), kind: k, name: String(fd.get("name") || "").trim(), projectId: fd.get("projectId") || null, enabled: ui.auto.rules.find((x) => x.id === f.dataset.id)?.enabled ?? true };
      if (k === "assign") Object.assign(r, { types: fd.getAll("types"), teamId: fd.get("teamId") || null, method: fd.get("method") });
      if (k === "escalate") Object.assign(r, { trigger: fd.get("trigger"), hours: Number(fd.get("hours")), minPriority: fd.get("minPriority") || null, raise: !!fd.get("raise"), label: !!fd.get("label"), notifyLead: !!fd.get("notifyLead"), notifyUserId: fd.get("notifyUserId") || null });
      if (k === "remind") Object.assign(r, { status: fd.get("status") || null, days: Number(fd.get("days")), repeat: !!fd.get("repeat"), comment: String(fd.get("comment") || "") });
      const list = f.dataset.id ? ui.auto.rules.map((x) => (x.id === r.id ? r : x)) : [...ui.auto.rules, r];
      await saveRules(list); closeModal(); render(); toast(`Regel „${r.name}“ gespeichert`); break; }
    case "scope-form": { const x = user(f.dataset.id); x.scope = fd.get("scope"); x.projectIds = fd.getAll("projectIds"); save(); closeModal(); render(); toast(`Sichtbereich von ${x.name}: ${x.scope === "all" ? "alle Projekte" : "eigener Bereich"}`); break; }
    case "brand-form": { const b = await api("/api/admin/brand", { method: "POST", body: { appName: fd.get("appName"), company: fd.get("company"), color: fd.get("color") } }); sync.company = b.company; applyBrand(b); render(); toast("Erscheinungsbild gespeichert"); break; }
    case "simple-search": { const ps = new URLSearchParams(); for (const [k, v] of fd) if (String(v).trim()) ps.set(k, String(v).trim()); const { params } = route(); for (const k of ["sort", "dir"]) if (params.get(k)) ps.set(k, params.get(k)); go(`#/filters?${ps}`); break; }
    case "audit-form": ui.auditQ = Object.fromEntries([...fd].filter(([, v]) => v)); ui.sys = null; render(); break;
    case "user-form": {
      const pw = String(fd.get("password") || "");
      const r = await api("/api/admin/users", { method: "POST", body: { name: fd.get("name"), email: fd.get("email"), role: fd.get("role"), ...(pw ? { password: pw } : { invite: true }) } });
      applyServer({ type: "users", id: r.user.id, data: r.user }); f.reset(); ui.accounts = null; render();
      if (r.invite) inviteModal(r.user, r.invite); else toast(`${r.user.name} angelegt – Zugangsdaten bitte persönlich übergeben.`); break; }
    case "profile-form": { const u = user(db.currentUserId); u.name = String(fd.get("name")).trim() || u.name; u.notifyEmail = !!fd.get("notifyEmail"); u.notifyTeams = !!fd.get("notifyTeams"); u.home = fd.get("home") || undefined; if (!u.home) delete u.home; save(); render(); toast("Gespeichert"); break; }
    case "password-form": {
      if (fd.get("next") !== fd.get("repeat")) return toast("Die neuen Passwörter stimmen nicht überein.");
      await api("/api/me/password", { method: "POST", body: { current: fd.get("current"), next: fd.get("next") } }); f.reset(); toast("Passwort geändert. Andere Sitzungen wurden abgemeldet."); break; }
  }
  const q = f.dataset.quick;
  if (q !== undefined) {
    const input = f.querySelector("input"); const summary = input.value.trim(); if (!summary) return;
    const p = projByKey(route().parts[1]); const i = await createIssue({ projectId: p.id, type: PROJECT_TYPES[p.type].types[0], summary, sprintId: q === "backlog" ? null : q, epicId: ui.backlogEpic || null });
    render(); toast(`${keyOf(i)} erstellt`); setTimeout(() => $(`[data-quick="${q}"] input`)?.focus(), 0);
  }
}
document.addEventListener("keydown", (e) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName);
  if (e.key === "Escape" && drawerOpen()) { closeDrawer(); return; }
  if (e.key === "Escape") { if ($("#notifs").classList.contains("open")) $("#notifs").classList.remove("open"); else if (ui.modal) { e.preventDefault(); dismissModal(); } }
  if (e.key === "Tab" && ui.modal) { // Fokus im Fenster halten
    const f = [...$("#modal").querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (f.length && (e.shiftKey ? document.activeElement === f[0] || document.activeElement === $("#modal") : document.activeElement === f[f.length - 1])) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
  }
  if (e.target.id === "gsearch" && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const items = [...document.querySelectorAll("#gsugg [data-sugg]")]; if (!items.length) return;
    let k = items.findIndex((x) => x.classList.contains("on")); items[k]?.classList.remove("on"); k = (k + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[k].classList.add("on"); items[k].scrollIntoView({ block: "nearest" }); }
  if (e.key === "Escape" && e.target.id === "gsearch") hideSuggestions();
  if (e.key === "Enter" && e.target.id === "gsearch") { const q = e.target.value.trim(); const inp = e.target; const sel = $("#gsugg [data-sugg].on");
    if (sel) { e.preventDefault(); sel.click(); return; } if (!q) return; hideSuggestions();
    (/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(q) ? findByKey(q) : Promise.resolve(null)).then((i) => { if (i) { openIssue(i.id); inp.value = ""; } else { inp.value = ""; inp.blur(); go(`#/filters?state=all&text=${encodeURIComponent(q)}`); } }); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.id === "comment-text") { e.preventDefault(); $("#comment-form").requestSubmit(); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ui.modal === "form" && e.target.closest("#modal form")) { e.preventDefault(); e.target.closest("form").requestSubmit(); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.id === "jql") { e.preventDefault(); $("#jql-form").requestSubmit(); }
  if (!typing && !ui.modal && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === "c") { e.preventDefault(); createForm(); }
    if (e.key === "/") { e.preventDefault(); $("#gsearch")?.focus(); }
  }
});
document.addEventListener("click", (e) => { if (!e.target.closest(".gs-wrap")) hideSuggestions(); });
document.addEventListener("click", (e) => { const th = e.target.closest("th[data-sort]"); if (!th) return;
  if (!$("#jql")) { const { params } = route(); const same = (params.get("sort") || "updated") === th.dataset.sort; const dirNow = $("#view th.sortable")?.closest("table") && th.textContent.includes("↑") ? "ASC" : "DESC";
    if (route().parts[0] === "filters") { params.set("sort", th.dataset.sort); params.set("dir", same ? (dirNow === "ASC" ? "DESC" : "ASC") : ["summary", "key", "assignee", "due", "type", "customer", "project", "team", "appointment"].includes(th.dataset.sort) ? "ASC" : "DESC"); params.delete("issue"); go(`#/filters?${params}`); return; } }
  const cur = $("#jql")?.value || ""; const base = cur.replace(/\s*ORDER\s+BY[\s\S]*$/i, "").trim(); let dir = "ASC";
  try { const o = parseJql(cur).order[0]; if (o && o.f === th.dataset.sort && o.dir === "ASC") dir = "DESC"; } catch {}
  go(`#/filters?jql=${encodeURIComponent(`${base}${base ? " " : ""}ORDER BY ${th.dataset.sort} ${dir}`)}`); });
// Dateien aus der Zwischenablage (Strg+V, z. B. Bildschirmfoto oder im Explorer kopierte Dateien) = hochladen
document.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files || [])]; if (!files.length) return;
  if ([...e.clipboardData.types].includes("text/plain") && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return; // Text (z. B. aus Word) normal einfügen
  if (ui.modal === "issue" && ui.openIssue) { e.preventDefault(); uploadFiles(ui.openIssue, files.map(namePasted)); }
  else if ($("#create-form")) { e.preventDefault(); addCreateFiles(files.map(namePasted)); }
});
// Dateien auf den geöffneten Vorgang ziehen = hochladen
$("#modal").addEventListener("dragover", (e) => { if ($("#create-form") && [...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); $("#cf-drop")?.classList.add("drop-on"); return; }
  if (ui.modal === "issue" && [...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); $("#modal .att-drop")?.classList.add("drop-on"); } });
$("#modal").addEventListener("dragleave", (e) => { if (!$("#modal").contains(e.relatedTarget)) $("#modal .att-drop")?.classList.remove("drop-on"); });
$("#modal").addEventListener("drop", (e) => { if ($("#create-form") && e.dataTransfer?.files?.length) { e.preventDefault(); $("#cf-drop")?.classList.remove("drop-on"); addCreateFiles([...e.dataTransfer.files]); return; }
  if (ui.modal !== "issue" || !e.dataTransfer?.files?.length) return; e.preventDefault(); $("#modal .att-drop")?.classList.remove("drop-on"); uploadFiles(ui.openIssue, [...e.dataTransfer.files]); });
// Nur schließen, wenn der Klick auch auf dem Hintergrund begonnen hat (nicht beim Markieren von Text im Fenster)
let overlayDown = false;
$("#overlay").addEventListener("mousedown", (e) => (overlayDown = e.target === e.currentTarget));
$("#overlay").addEventListener("click", () => { if (overlayDown) dismissModal(); overlayDown = false; });
$("#modal").addEventListener("scroll", (e) => e.currentTarget.classList.toggle("scrolled", e.currentTarget.scrollTop > 4), { passive: true });
$("#modal").addEventListener("input", (e) => { if (ui.modal === "form" && e.target.closest("form")) ui.modalDirty = true; });
// Tooltip für Diagramme
document.addEventListener("mousemove", (e) => { const t = e.target.closest("[data-tip]"); const tip = $("#tip");
  if (!t) { tip.style.display = "none"; return; } tip.textContent = t.dataset.tip; tip.style.display = "block";
  const x = Math.min(window.innerWidth - tip.offsetWidth - 10, e.clientX + 14); tip.style.left = x + "px"; tip.style.top = (e.clientY + 14) + "px"; });
window.addEventListener("hashchange", onNavigate);
window.addEventListener("popstate", () => setTimeout(onNavigate, 0)); // pushState-Schritte (Vorgänge) lösen kein hashchange aus

/* ---------- Als App installieren (PWA) ---------- */
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; if (route().parts[0] === "settings") render(); });
window.addEventListener("appinstalled", () => { installPrompt = null; toast("GF Tracker wurde als App installiert."); });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if ("serviceWorker" in navigator && !TEAMS) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

/* ---------- Start ---------- */
try { const th = localStorage.getItem("gft-theme"); if (th) document.documentElement.dataset.theme = th; } catch {}
(async function boot() {
  try {
    const meRes = await api("/api/me");
    db.currentUserId = meRes.user.id; sync.mail = meRes.mail; sync.company = meRes.company; applyBrand(meRes.brand);
    loadState(await fetchState());
    if (!location.hash || location.hash === "#" || location.hash === "#/") history.replaceState(null, "", `#/${homeRoute()}`);
    document.body.classList.toggle("readonly", !canEdit(me()));
    onNavigate(); connectEvents();
    setInterval(() => { renderTop(); updateSyncBadge(); }, 60000);
  } catch (e) {
    if (!String(e.message).includes("angemeldet")) $("#view").innerHTML = `<div class="note err">Der Server ist nicht erreichbar: ${esc(e.message)} <button class="btn sm" data-act="reload">Erneut versuchen</button></div>`;
  }
})();
