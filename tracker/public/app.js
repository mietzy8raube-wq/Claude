"use strict";
/* ======================================================================
   GF Tracker – Browser-App. Daten liegen auf dem Server; Änderungen werden
   als Patches synchronisiert und per Server-Sent Events live verteilt.
   Fachlogik (Workflows, SLA, Patch-Verfahren) steckt in shared.js.
   ====================================================================== */
const { TRANSITIONS, transitionsFor, TYPES, PROJECT_TYPES, WORKFLOWS, CAT_LABEL, PRIOS, SLA, REQUEST_TYPES, URGENCY, PALETTE, ROLES,
  pad, dayKey, today, parseDay, addDays, daysBetween, uid, hashColor, fmtDur, statusInfo, slaCompute, applyTransition, newIssue, diffEntity, applyPatch } = TrackerShared;

/* ---------- Symbole ---------- */
const ICONS = {
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
const COLLECTIONS = ["users", "projects", "sprints", "issues", "filters", "notifications"];
let db = { users: [], projects: [], sprints: [], issues: [], filters: [], notifications: [], currentUserId: null };
const sync = { rev: 0, base: {}, pending: [], timer: null, inFlight: false, again: false, pulling: false, pullAgain: false, online: true, retry: 0, mail: false, company: "GF Tracker" };
COLLECTIONS.forEach((t) => (sync.base[t] = new Map()));
const LOCAL_KEY = "gft-local";
const localState = (() => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || { recent: {} }; } catch { return { recent: {} }; } })();
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(localState)); } catch {} }

async function api(path, { method = "GET", body } = {}) {
  let res;
  try { res = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-GFT": "1" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw Object.assign(new Error("Keine Verbindung zum Server."), { offline: true }); }
  if (res.status === 401 && !path.startsWith("/api/me/password")) { location.href = "/login"; throw new Error("Nicht angemeldet."); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Fehler ${res.status}`), { status: res.status });
  return data;
}
const setBase = (type, obj) => sync.base[type].set(obj.id, clone(obj));
function loadState(st) {
  for (const t of COLLECTIONS) { db[t] = st[t] || []; sync.base[t] = new Map(); db[t].forEach((o) => setBase(t, o)); }
  sync.rev = st.rev; sync.pending = [];
}
async function reloadState() { loadState(await api("/api/state")); render(); }
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
    else { toast(e.message); await reloadState().catch(() => {}); }
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
    for (const c of r.changes) applyServer(c);
    sync.rev = r.rev; setOnline(true);
    if (r.changes.length) renderSoft();
  } catch (e) { if (e.offline) setOnline(false); }
  finally { sync.pulling = false; if (sync.pullAgain) { sync.pullAgain = false; pull(); } }
}
function connectEvents() {
  const es = new EventSource("/api/events");
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
  if (ops.length) fetch("/api/sync", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-GFT": "1" }, body: JSON.stringify({ ops }) });
});

const ui = { modal: null, openIssue: null, board: { q: "", mine: false, recent: false, users: [], lane: "none" }, queue: "open", yourWork: "assigned", editingDesc: false, dirty: false };

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
const FIELD_LABEL = { appointmentAt: "Termin", resolution: "Servicebericht", summary: "Zusammenfassung", description: "Beschreibung", status: "Status", priority: "Priorität", assigneeId: "Verantwortlich", reporterId: "Melder", labels: "Labels",
  dueDate: "Fälligkeitsdatum", startDate: "Startdatum", storyPoints: "Story Points", estimateH: "Schätzung", epicId: "Epic", sprintId: "Sprint", type: "Vorgangstyp", parentId: "Übergeordnet", color: "Farbe" };
function fieldText(i, f, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "–";
  if (f === "status") return workflowOf(proj(i.projectId)).find((s) => s.id === v)?.name || v;
  if (f === "priority") return PRIOS[v]?.label || v;
  if (f === "assigneeId" || f === "reporterId") return uname(v);
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
const JQL_FIELDS = ["project", "type", "issuetype", "status", "statuscategory", "assignee", "reporter", "priority", "labels", "sprint", "due", "duedate", "created", "updated", "resolved", "text", "summary", "description", "resolution", "key", "issuekey", "epic", "parent", "storypoints", "points", "customer", "watcher"];
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
    case "customer": return i.customer ? [i.customer.name, i.customer.company, i.customer.email] : [];
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
const userOpts = (sel, none = "Nicht zugewiesen") => `<option value="">${none}</option>` + activeUsers().map((u) => `<option value="${u.id}" ${u.id === sel ? "selected" : ""}>${esc(u.name)}</option>`).join("");
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

/* ---------- Rahmen ---------- */
function renderTop() {
  const r = route().parts[0] || "your-work";
  const unread = db.notifications.filter((n) => n.userId === db.currentUserId && !n.read).length;
  const link = (h, label, keyName) => `<a class="navlink ${r === keyName ? "on" : ""}" href="#/${h}">${label}</a>`;
  $("#topnav").innerHTML = `
    <button class="btn subtle icon hamb" data-act="menu" aria-label="Menü">${icon("menu")}</button>
    <a class="logo" href="#/your-work"><span class="mark">${icon("bolt")}</span>GF Tracker</a>
    ${link("your-work", "Ihre Arbeit", "your-work")}${link("projects", "Projekte", r === "p" ? "p" : "projects")}${link("filters", "Filter", "filters")}${link("dashboard", "Dashboard", "dashboard")}<a class="navlink" href="/portal" target="_blank" rel="noopener">Service-Portal ↗</a>
    <button class="btn primary" data-act="create" style="margin-left:6px">${icon("plus")}<span class="hide-m">Erstellen</span></button>
    <div class="search">${icon("search")}<input type="search" id="gsearch" placeholder="Suchen (z. B. DIG-12)" aria-label="Suchen"></div>
    <button class="btn subtle icon bell" data-act="notifs" aria-label="Benachrichtigungen">${icon("bell")}${unread ? `<span class="n">${unread > 99 ? "99+" : unread}</span>` : ""}</button>
    <button class="btn subtle icon hide-m" data-act="theme" aria-label="Hell/Dunkel">${icon("sun")}</button>
    <span id="sync-badge" class="chip gray" hidden></span>
    <a href="#/settings" class="row nowrap" title="${esc(me().name)} – Einstellungen" style="gap:6px;color:var(--fg)">${avatar(db.currentUserId)}<span class="small b hide-m">${esc(me().name.split(" ")[0])}</span></a>
    <button class="btn subtle icon" data-act="logout" title="Abmelden" aria-label="Abmelden">${icon("logout")}</button>`;
}
function projectNav(p, view) {
  const items = p.type === "software" ? [["board", "Board", "board"], ["backlog", "Backlog", "backlog"], ["timeline", "Zeitleiste", "timeline"], ["list", "Liste", "list"], ["reports", "Berichte", "chart"]]
    : p.type === "business" ? [["board", "Board", "board"], ["timeline", "Zeitleiste", "timeline"], ["list", "Liste", "list"], ["reports", "Berichte", "chart"]]
    : [["queue", "Warteschlangen", "queue"], ["dispatch", "Einsatzplanung", "timeline"], ["board", "Board", "board"], ["list", "Liste", "list"], ["reports", "Berichte", "chart"]];
  items.push(["settings", "Projekteinstellungen", "gear"]);
  $("#psidebar").hidden = false;
  $("#psidebar").innerHTML = `<div class="phead"><span class="pavatar" style="background:${p.color}">${esc(p.key.slice(0, 3))}</span><div class="trunc"><div class="b trunc">${esc(p.name)}</div><div class="small muted">${PROJECT_TYPES[p.type].label}</div></div></div>
    <div class="label">Planung</div>${items.map(([v, l, ic]) => `<a href="#/p/${p.key}/${v}" class="${view === v ? "on" : ""}">${icon(ic)}${l}</a>`).join("")}
    ${p.type === "service" ? `<div class="label">Kunden</div><a href="/portal?p=${p.key}" target="_blank" rel="noopener">${icon("portal")}Kundenportal öffnen ↗</a>` : ""}`;
  return `<div class="project-tabs">${items.map(([v, l]) => `<a class="toggle ${view === v ? "on" : ""}" href="#/p/${p.key}/${v}">${l}</a>`).join("")}</div>`;
}
function render() {
  renderTop();
  const { parts, params } = route(); $("#psidebar").hidden = true;
  let html;
  try {
    switch (parts[0] || "your-work") {
      case "your-work": html = viewYourWork(); break;
      case "projects": html = viewProjects(); break;
      case "p": { const p = projByKey(parts[1]); if (!p) { html = `<div class="empty">Projekt nicht gefunden.</div>`; break; }
        const v = parts[2] || (p.type === "service" ? "queue" : "board"); const tabs = projectNav(p, v);
        html = tabs + ({ dispatch: viewDispatch, board: viewBoard, backlog: viewBacklog, timeline: viewTimeline, list: viewList, reports: viewReports, queue: viewQueue, settings: viewProjectSettings }[v] || viewBoard)(p); break; }
      case "filters": html = viewFilters(params); break;
      case "dashboard": html = viewDashboard(); break;
      case "portal": html = `<div class="empty">Das Kundenportal ist öffentlich erreichbar unter <a href="/portal" target="_blank" rel="noopener">${esc(location.origin)}/portal</a> – diesen Link können Sie an Kunden weitergeben.</div>`; break;
      case "settings": html = viewSettings(); break;
      case "issue": { const i = byKey(parts[1]); html = viewYourWork(); if (i) setTimeout(() => openIssue(i.id), 0); break; }
      default: html = viewYourWork();
    }
  } catch (e) { console.error(e); html = `<div class="note err">Fehler beim Anzeigen: ${esc(e.message)}</div>`; }
  $("#view").innerHTML = html;
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
  const allClear = !urgent.length && !newRequests.length && !todayList.length && !doing.length && !next.length && !waiting.length && !approvals.length;
  return head + tabs + `<div class="grid g4" style="margin-bottom:6px">${tiles.map(([l, v, c]) => `<div class="card stat"><div class="v" style="${c ? `color:${c}` : ""}">${v}</div><div class="l">${l}</div></div>`).join("")}</div>
    ${allClear ? `<div class="empty" style="margin-top:16px">Alles erledigt – keine offenen Vorgänge für Sie. 🎉</div>` : ""}
    ${section("Sofort erledigen", urgent, "", reasonUrgent, "danger")}
    ${section("Neue Kundenanfragen – bitte übernehmen", newRequests, "", (i) => `<span class="chip gray">${ago(i.createdAt)}</span>`, "danger")}
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
  if (p.type === "software" && !sp) return head + `<div class="empty">Kein aktiver Sprint. Im <a href="#/p/${p.key}/backlog">Backlog</a> einen Sprint planen und starten.</div>`;
  let lanes = [{ key: "all", title: null, items: list }];
  if (b.lane === "assignee") lanes = [...new Set(list.map((i) => i.assigneeId || ""))].map((a) => ({ key: a, title: `${avatar(a || null)} ${esc(a ? uname(a) : "Nicht zugewiesen")}`, items: list.filter((i) => (i.assigneeId || "") === a) }));
  if (b.lane === "epic") lanes = [...new Set(list.map((i) => i.epicId || (i.parentId && issue(i.parentId)?.epicId) || ""))].map((e) => ({ key: e, title: e ? `${typeIcon("EPIC")} ${esc(issue(e)?.summary)}` : "Ohne Epic", items: list.filter((i) => (i.epicId || (i.parentId && issue(i.parentId)?.epicId) || "") === e) }));
  if (b.lane === "priority") lanes = Object.keys(PRIOS).filter((k) => list.some((i) => i.priority === k)).map((k) => ({ key: k, title: `${prioIcon(k)} ${PRIOS[k].label}`, items: list.filter((i) => i.priority === k) }));
  return head + lanes.map((ln) => `${ln.title ? `<div class="lane-h">${ln.title} <span class="muted small">${ln.items.length} Vorgänge</span></div>` : ""}
    <div class="board" style="grid-template-columns:repeat(${wf.length}, minmax(240px,1fr))">${wf.map((s) => { const col = ln.items.filter((i) => i.status === s.id);
      return `<div class="col" data-drop-status="${s.id}"><div class="col-h">${esc(s.name)} <span>${col.length}</span>${s.cat === "done" ? " ✓" : ""}</div>${col.map(boardCard).join("")}</div>`; }).join("")}</div>`).join("");
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
      <div class="brows">${list.map(backlogRow).join("") || `<div class="brow muted small" style="justify-content:center;cursor:default">Vorgänge hierher ziehen</div>`}</div>
      <form class="quick-create" data-quick="${id}"><input type="text" placeholder="+ Vorgang erstellen – Zusammenfassung eingeben und Enter" aria-label="Schnell erstellen"></form></div>`; };
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Backlog</h1></div><div class="row"><button class="btn" data-act="new-sprint" data-project="${p.id}">Sprint erstellen</button><button class="btn primary" data-act="create" data-project="${p.id}">${icon("plus")} Vorgang</button></div></div>
    <div class="row" style="margin-bottom:12px"><span class="small muted">Epic:</span><button class="toggle ${!epicFilter ? "on" : ""}" data-act="backlog-epic" data-v="">Alle</button>${epicsOf(p).map((e) => `<button class="toggle ${epicFilter === e.id ? "on" : ""}" data-act="backlog-epic" data-v="${e.id}"><span style="color:${e.color}">●</span> ${esc(e.summary)}</button>`).join("")}</div>
    ${sprints.map((s) => box(s.id, esc(s.name), s.state === "active" ? `<span class="lozenge cat-progress">aktiv</span> ${fmtDay(s.start)} – ${fmtDay(s.end)}` : "geplant",
      items.filter((i) => i.sprintId === s.id),
      s.state === "active" ? `<button class="btn sm" data-act="complete-sprint" data-id="${s.id}">Sprint abschließen</button>` : `<button class="btn sm primary" data-act="start-sprint" data-id="${s.id}" ${activeSprint(p) ? "disabled title='Es läuft bereits ein Sprint'" : ""}>${icon("play")} Sprint starten</button><button class="btn sm subtle" data-act="delete-sprint" data-id="${s.id}" aria-label="Sprint löschen">${icon("trash")}</button>`)).join("")}
    ${box("backlog", "Backlog", "nicht eingeplant", items.filter((i) => !i.sprintId || sprint(i.sprintId)?.state === "closed"), "")}`;
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
function resultTable(list, { sortable = false, sortField = null, sortDir = "DESC" } = {}) {
  if (!list.length) return `<div class="empty">Keine Vorgänge gefunden.</div>`;
  const th = (f, l) => sortable ? `<th data-sort="${f}">${l}${sortField === f ? (sortDir === "ASC" ? " ↑" : " ↓") : ""}</th>` : `<th>${l}</th>`;
  return `<div class="card tbl-wrap"><table><thead><tr>${th("type", "Typ")}${th("key", "Schlüssel")}${th("summary", "Zusammenfassung")}${th("assignee", "Verantwortlich")}${th("status", "Status")}${th("priority", "Priorität")}${th("due", "Fällig")}${th("updated", "Aktualisiert")}</tr></thead><tbody>
    ${list.map((i) => `<tr class="click" data-act="open" data-id="${i.id}"><td>${typeIcon(i.type)}</td><td class="key">${keyOf(i)}</td><td><div class="trunc" style="max-width:440px">${esc(i.summary)}</div>${i.customer ? `<div class="small muted">${esc(i.customer.company || i.customer.name)}</div>` : ""}</td>
      <td><span class="row nowrap">${avatar(i.assigneeId)}<span class="trunc small">${esc(uname(i.assigneeId))}</span></span></td><td>${lozenge(i)}</td><td>${prioIcon(i.priority)}</td><td>${dueChip(i) || (i.dueDate ? `<span class="small muted">${fmtDay(i.dueDate)}</span>` : '<span class="muted">–</span>')}</td><td class="small muted" style="white-space:nowrap">${ago(i.updatedAt)}</td></tr>`).join("")}
    </tbody></table></div>`;
}
function viewList(p) {
  const jql = `project = ${p.key} ORDER BY created DESC`;
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Liste</h1></div><div class="row"><a class="btn" href="#/filters?jql=${encodeURIComponent(jql)}">${icon("filter")} In Filter öffnen</a><button class="btn primary" data-act="create" data-project="${p.id}">${icon("plus")} Vorgang</button></div></div>
    <div class="card pad" style="margin-bottom:14px">${statusStack(projIssues(p).filter((i) => i.type !== "EPIC"))}</div>${resultTable(runJql(jql))}`;
}
function viewFilters(params) {
  const all = [...DEFAULT_FILTERS, ...db.filters];
  const fid = params.get("filter"); const f = all.find((x) => x.id === fid);
  const jql = params.get("jql") ?? f?.jql ?? DEFAULT_FILTERS[0].jql;
  let list = [], err = null; try { list = runJql(jql); } catch (e) { err = e.message; }
  let sortField = null, sortDir = "DESC"; try { const o = parseJql(jql).order[0]; if (o) { sortField = o.f; sortDir = o.dir; } } catch {}
  ui.lastResults = list;
  return `<div class="page-head"><h1>Vorgänge suchen</h1><div class="row"><button class="btn" data-act="save-filter">${icon("star")} Filter speichern</button><button class="btn" data-act="export-xlsx">${icon("download")} Excel-Auswertung</button><button class="btn subtle" data-act="export-csv">CSV</button></div></div>
    <div class="side-layout" id="filter-layout">
      <div class="card pad queue-nav"><div class="small b muted" style="margin-bottom:6px">STANDARDFILTER</div>${DEFAULT_FILTERS.map((x) => `<button class="${fid === x.id || (!fid && !params.get("jql") && x.id === "f-mine") ? "on" : ""}" data-act="goto" data-href="#/filters?filter=${x.id}">${esc(x.name)}</button>`).join("")}
        <div class="small b muted" style="margin:12px 0 6px">GESPEICHERT</div>${db.filters.length ? db.filters.map((x) => `<div class="row nowrap"><button class="${fid === x.id ? "on" : ""}" data-act="goto" data-href="#/filters?filter=${x.id}" style="flex:1">${esc(x.name)}</button><button class="btn subtle sm icon" data-act="delete-filter" data-id="${x.id}" aria-label="Filter löschen">${icon("x")}</button></div>`).join("") : '<p class="small muted" style="margin:0 10px">Noch keine.</p>'}</div>
      <div>
        <form id="jql-form" class="row nowrap" style="margin-bottom:8px;align-items:flex-start"><textarea id="jql" class="jql" rows="2" spellcheck="false" aria-label="JQL-Abfrage">${esc(jql)}</textarea><button class="btn primary" type="submit">${icon("search")} Suchen</button></form>
        <details style="margin-bottom:10px"><summary class="small muted" style="cursor:pointer">Hilfe zur Abfragesprache (JQL)</summary><div class="small muted" style="padding:8px 0;line-height:1.7">
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
        ${list.map((i) => `<tr class="click" data-act="open" data-id="${i.id}"><td>${typeIcon(i.type)}</td><td class="key">${keyOf(i)}</td><td><div class="trunc" style="max-width:280px">${esc(i.summary)}</div><div class="small muted trunc" style="max-width:280px">${esc(i.customer?.company || "")}${i.customer?.name ? " · " + esc(i.customer.name) : ""} · ${ago(i.createdAt)}</div></td>
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
  const techs = activeUsers().filter((u) => u.role === "AGENT" || planned.some((i) => i.assigneeId === u.id));
  const unplanned = items.filter((i) => ["OPEN", "PARTS", "WAITING"].includes(i.status) && (i.type !== "SERVICE" || i.status === "PARTS"))
    .sort((a, b) => PRIOS[b.priority].rank - PRIOS[a.priority].rank || a.createdAt.localeCompare(b.createdAt));
  const card = (i) => { const done = isDone(i); return `<div class="dcard ${done ? "done" : ""} cat-b-${statusOf(i).cat}" draggable="${done ? "false" : "true"}" data-drag-appt="${i.id}" data-act="open" data-id="${i.id}">
    <div class="row nowrap small"><b>${fmtTime(i.appointmentAt)}</b><span class="key">${keyOf(i)}</span><span class="sp"></span>${prioIcon(i.priority)}</div>
    <div class="trunc" style="font-weight:500">${esc(i.summary)}</div><div class="small muted trunc">${esc(i.customer?.company || "")}</div><div style="margin-top:3px">${lozenge(i)}</div></div>`; };
  const fmtHead = (k) => parseDay(k).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  return `<div class="page-head"><div><div class="crumbs">Projekte / ${esc(p.name)}</div><h1>Einsatzplanung</h1>
      <div class="small muted">KW ${isoWeek(days[0])} · ${fmtDay(days[0])} – ${fmtDay(days[5])}</div></div>
      <div class="row"><button class="btn" data-act="dispatch-week" data-v="-1" aria-label="Vorige Woche">←</button><button class="btn" data-act="dispatch-week" data-v="0">Diese Woche</button><button class="btn" data-act="dispatch-week" data-v="1" aria-label="Nächste Woche">→</button></div></div>
    <div class="dispatch-layout">
      <div class="card pad"><h3 style="font-size:14px;margin-bottom:4px">Einzuplanen <span class="badge-count">${unplanned.length}</span></h3><p class="small muted" style="margin:0 0 8px">Auf Techniker und Tag ziehen – oder öffnen und „Einplanen“ wählen.</p>
        ${unplanned.map((i) => `<div class="dcard" draggable="true" data-drag-appt="${i.id}" data-act="open" data-id="${i.id}"><div class="row nowrap small"><span class="key">${keyOf(i)}</span>${lozenge(i)}<span class="sp"></span>${prioIcon(i.priority)}</div><div class="trunc" style="font-weight:500">${esc(i.summary)}</div><div class="small muted trunc">${esc(i.customer?.company || "")} · ${ago(i.createdAt)}</div></div>`).join("") || '<p class="small muted">Alles eingeplant. 👍</p>'}</div>
      <div class="card dgrid-wrap"><div class="dgrid" style="grid-template-columns:150px repeat(${days.length}, minmax(140px, 1fr))">
        <div class="dhead"></div>${days.map((k) => `<div class="dhead ${k === t ? "today" : ""}">${fmtHead(k)}</div>`).join("")}
        ${techs.length ? techs.map((u) => `<div class="dtech">${avatar(u.id)} <span class="trunc">${esc(u.name)}</span><span class="small muted">${planned.filter((i) => i.assigneeId === u.id && !isDone(i)).length} offen</span></div>
          ${days.map((k) => `<div class="dcell ${k === t ? "today" : ""} ${k < t ? "past" : ""}" data-drop-appt="${u.id}|${k}">${planned.filter((i) => i.assigneeId === u.id && dayKey(i.appointmentAt) === k).sort((a, b) => a.appointmentAt.localeCompare(b.appointmentAt)).map(card).join("")}</div>`).join("")}`).join("")
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
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Mir zugewiesen</h3>${mine.length ? `<table><tbody>${mine.map((i) => issueRow(i)).join("")}</tbody></table>` : '<p class="muted">Nichts offen. 🎉</p>'}</div>
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Überfällig</h3>${overdue.length ? `<table><tbody>${overdue.map((i) => issueRow(i, `<td>${avatar(i.assigneeId)}</td>`)).join("")}</tbody></table>` : '<p class="muted">Keine überfälligen Vorgänge.</p>'}</div>
      <div class="card pad"><h3 style="font-size:15px">Erstellt vs. erledigt</h3><p class="small muted" style="margin:2px 0 8px">Alle Projekte</p>${createdResolvedChart(db.issues)}</div>
      <div class="card pad"><h3 style="font-size:15px;margin-bottom:8px">Arbeitslast</h3>${workloadBars(db.issues)}
        <h3 style="font-size:15px;margin:16px 0 8px">Offen je Projekt</h3>${hbars(db.projects.map((p) => ({ label: p.name, value: open.filter((i) => i.projectId === p.id).length })))}</div>
      <div class="card pad" style="grid-column:1/-1"><h3 style="font-size:15px;margin-bottom:8px">Aktivitäten</h3>
        ${stream.map((h) => `<div class="row nowrap small" style="padding:6px 0;border-bottom:1px solid var(--border)">${h.userId ? avatar(h.userId) : custAvatar({ name: h.author || "Kunde" })}<span class="trunc" style="flex:1"><b>${esc(h.userId ? uname(h.userId) : h.author || "Kunde")}</b> · ${esc(h.field)}${h.to ? `: ${esc(h.to)}` : ""} · <a href="#" data-act="open" data-id="${h.i.id}">${keyOf(h.i)}</a> ${esc(h.i.summary)}</span><span class="muted">${ago(h.at)}</span></div>`).join("")}</div>
    </div>`;
}

/* ---------- Ansicht: Einstellungen ---------- */
function viewSettings() {
  const u = me(); const isAdmin = u.role === "ADMIN";
  return `<div class="page-head"><h1>Einstellungen</h1></div><div class="grid g2">
    <div class="card pad"><h3 style="font-size:15px;margin-bottom:10px">Mein Profil</h3>
      <form id="profile-form" class="grid" style="gap:10px"><label class="f">Name<input type="text" name="name" value="${esc(u.name)}" required maxlength="120"></label>
        <label class="f">E-Mail<input type="email" value="${esc(u.email)}" disabled></label>
        <label class="row nowrap small"><input type="checkbox" name="notifyEmail" ${u.notifyEmail !== false ? "checked" : ""}> Benachrichtigungen zusätzlich per E-Mail erhalten${sync.mail ? "" : ' <span class="muted">(E-Mail-Versand ist noch nicht eingerichtet)</span>'}</label>
        <div><button class="btn primary" type="submit">Speichern</button></div></form>
      <h3 style="font-size:15px;margin:20px 0 10px">Passwort ändern</h3>
      <form id="password-form" class="grid" style="gap:10px"><input type="password" name="current" placeholder="Aktuelles Passwort" autocomplete="current-password" required aria-label="Aktuelles Passwort">
        <input type="password" name="next" placeholder="Neues Passwort (mind. 10 Zeichen)" minlength="10" autocomplete="new-password" required aria-label="Neues Passwort">
        <input type="password" name="repeat" placeholder="Neues Passwort wiederholen" minlength="10" autocomplete="new-password" required aria-label="Neues Passwort wiederholen">
        <div><button class="btn" type="submit">Passwort ändern</button></div></form>
      <h3 style="font-size:15px;margin:20px 0 6px">Als App nutzen</h3>
      ${isStandalone() ? '<p class="small muted" style="margin:0">Sie nutzen den GF Tracker bereits als installierte App. ✓</p>'
        : `${installPrompt ? `<button class="btn primary" data-act="install-app">${icon("download")} GF Tracker als App installieren</button>` : ""}
        <p class="small muted" style="margin:6px 0 0;line-height:1.6"><b>PC (Edge/Chrome):</b> in der Adresszeile auf das Symbol „App installieren“ klicken bzw. Menü ⋯ → Apps → „Diese Website als App installieren“. Danach eigenes Fenster, Startmenü- und Taskleisten-Eintrag.<br>
        <b>iPhone/iPad:</b> in Safari „Teilen“ → „Zum Home-Bildschirm“. <b>Android:</b> Chrome-Menü → „App installieren“.</p>`}
      <h3 style="font-size:15px;margin:20px 0 6px">Tastenkürzel</h3><div class="small" style="line-height:2"><span class="kbd">c</span> Vorgang erstellen · <span class="kbd">/</span> Suche · <span class="kbd">Esc</span> Schließen · <span class="kbd">Strg</span>+<span class="kbd">Enter</span> Kommentar senden</div></div>
    <div class="card pad"><h3 style="font-size:15px;margin-bottom:10px">Personen</h3>
      ${db.users.map((x) => `<div class="row nowrap" style="padding:7px 0;border-bottom:1px solid var(--border);${x.active ? "" : "opacity:.5"}">${avatar(x.id)}<div style="flex:1;min-width:0"><div class="b trunc">${esc(x.name)}</div><div class="small muted trunc">${esc(x.email)}</div></div>
        ${isAdmin ? `<select style="width:auto" data-act="user-role" data-id="${x.id}" ${x.id === u.id ? "disabled" : ""}>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === x.role ? "selected" : ""}>${v}</option>`).join("")}</select>
        <label class="small row nowrap"><input type="checkbox" data-act="user-active" data-id="${x.id}" ${x.active ? "checked" : ""} ${x.id !== u.id ? "" : "disabled"}> aktiv</label>
        <button class="btn subtle sm" data-act="set-password" data-id="${x.id}" title="Passwort setzen">Passwort</button>` : `<span class="small muted">${ROLES[x.role] || x.role}</span>`}</div>`).join("")}
      ${isAdmin ? `<h3 style="font-size:15px;margin:16px 0 8px">Person hinzufügen</h3><form id="user-form" class="grid g2" style="gap:8px"><input type="text" name="name" placeholder="Name" required aria-label="Name"><input type="email" name="email" placeholder="E-Mail" required aria-label="E-Mail">
        <select name="role" aria-label="Rolle">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === "MEMBER" ? "selected" : ""}>${v}</option>`).join("")}</select><input type="text" name="password" placeholder="Startpasswort (mind. 10 Zeichen)" minlength="10" required aria-label="Startpasswort">
        <div style="grid-column:1/-1"><button class="btn primary" type="submit">${icon("plus")} Person anlegen</button></div></form>
        <p class="small muted">Rollen: <b>Administrator</b> verwaltet Personen, Projekte und Sicherungen · <b>Mitglied</b> arbeitet in allen Projekten · <b>Service-Mitarbeiter</b> wird zusätzlich über neue Kundenanfragen informiert.</p>` : '<p class="small muted">Personen verwalten nur Administratoren.</p>'}</div>
    ${isAdmin ? `<div class="card pad"><h3 style="font-size:15px;margin-bottom:6px">Daten &amp; Sicherung</h3><p class="small muted" style="margin:0 0 12px">Der Server sichert die Datenbank automatisch jede Nacht (Ordner <code>data/backups</code>). Zusätzlich können Sie hier eine Sicherung herunterladen oder eine Sicherung bzw. Daten aus der Einzel-HTML-Version einspielen.</p>
      <div class="row"><button class="btn" data-act="export-json">${icon("download")} Sicherung herunterladen</button><button class="btn" data-act="import-json">${icon("upload")} Sicherung einspielen</button><input type="file" id="json-file" accept=".json,application/json" hidden><button class="btn primary" data-act="export-all-xlsx">${icon("download")} Excel-Auswertung (alle Daten)</button><button class="btn" data-act="export-all-csv">${icon("download")} Alle Vorgänge (CSV)</button></div>
      <h3 style="font-size:15px;margin:18px 0 6px">E-Mail-Versand</h3><p class="small muted" style="margin:0 0 8px">${sync.mail ? "Eingerichtet über Microsoft 365." : "Nicht eingerichtet – Benachrichtigungen erscheinen nur in der App. Einrichtung siehe ARCHITEKTUR.md (Microsoft-365-App-Registrierung)."}</p>
      ${sync.mail ? `<button class="btn" data-act="mail-test">Test-E-Mail an mich senden</button>` : ""}
      <h3 style="font-size:15px;margin:18px 0 6px">Kundenportal auf Ihrer Website</h3><p class="small muted" style="margin:0 0 8px">Öffentliche Adresse: <a href="/portal" target="_blank" rel="noopener">${esc(location.origin)}/portal</a> – als Link/Button „Störung melden“ verwenden oder direkt in eine Seite einbetten:</p>
      <textarea id="embed-code" class="jql" rows="3" readonly>&lt;iframe src="${esc(location.origin)}/portal?embed=1" title="Service-Portal" style="width:100%;min-height:900px;border:0" loading="lazy"&gt;&lt;/iframe&gt;</textarea>
      <div class="row" style="margin-top:6px"><button class="btn sm" data-act="copy-embed">Code kopieren</button><span class="small muted">Für das Einbetten muss Ihre Website-Adresse in <code>PORTAL_FRAME_ANCESTORS</code> stehen (siehe ARCHITEKTUR.md).</span></div></div>` : `<div class="card pad"><h3 style="font-size:15px;margin-bottom:6px">Export</h3><button class="btn primary" data-act="export-all-xlsx">${icon("download")} Excel-Auswertung (alle Daten)</button><button class="btn" data-act="export-all-csv">${icon("download")} Alle Vorgänge (CSV)</button></div>`}
    </div>`;
}

/* ---------- Vorgang: Detailansicht ---------- */
function openModal(html, wide = false, kind = "form") {
  const m = $("#modal");
  if (!ui.modal && document.activeElement && document.activeElement !== document.body) ui.modalReturnFocus = document.activeElement;
  m.className = "modal open" + (wide ? " wide" : ""); m.innerHTML = html; m.scrollTop = 0; m.tabIndex = -1; ui.modal = kind; ui.modalDirty = false;
  $("#overlay").classList.add("open"); document.body.classList.add("modal-open");
  setTimeout(() => { if (!m.contains(document.activeElement)) m.focus({ preventScroll: true }); }, 40);
}
function closeModal() {
  const m = $("#modal"); m.className = "modal"; m.innerHTML = ""; ui.modal = null; ui.openIssue = null; ui.editingDesc = false; ui.modalDirty = false; ui.stepReturn = null;
  $("#overlay").classList.remove("open"); document.body.classList.remove("modal-open");
  const f = ui.modalReturnFocus; ui.modalReturnFocus = null; if (f && document.contains(f)) f.focus({ preventScroll: true });
}
/** Schließen durch Nutzer (Esc, Klick daneben, ×): fragt bei ungespeicherten Eingaben nach; Arbeitsschritte kehren zum Vorgang zurück. */
function dismissModal() {
  if (!ui.modal) return;
  const typed = ui.modalDirty || [...$("#modal").querySelectorAll("#comment-text, #desc-edit, textarea[name=description]")].some((t) => t.value.trim() && t.defaultValue !== t.value);
  if (typed && !confirm("Ihre Eingaben sind noch nicht gespeichert. Trotzdem schließen?")) return;
  const back = ui.modal === "form" ? ui.stepReturn : null; ui.stepReturn = null;
  closeModal(); if (back && issue(back)) openIssue(back);
}
function openIssue(id) { const i = issue(id); if (!i) return toast("Vorgang nicht gefunden."); ui.openIssue = id; ui.editingDesc = false; ui.addingSub = false; ui.addingLink = false; ui.issueTab = ui.issueTab || "comments"; pushRecent(id); openModal("", true, "issue"); renderIssue(); }
function renderIssue() {
  const i = issue(ui.openIssue); if (!i) { closeModal(); return; }
  const p = proj(i.projectId); const s = statusOf(i); const ch = children(i); const isSvc = p.type === "service";
  const parent = issue(i.parentId), epic = issue(i.epicId);
  const crumbs = `<a href="#/p/${p.key}" data-act="close">${esc(p.name)}</a>${epic ? ` / <a href="#" data-act="open" data-id="${epic.id}">${keyOf(epic)}</a>` : ""}${parent ? ` / <a href="#" data-act="open" data-id="${parent.id}">${keyOf(parent)}</a>` : ""} / <span class="row nowrap" style="display:inline-flex">${typeIcon(i.type)} ${keyOf(i)}</span>`;
  const tab = ui.issueTab;
  const comments = i.comments.map((c) => `<div class="comment ${c.internal ? "internal" : ""}">${c.userId ? avatar(c.userId, true) : custAvatar({ name: c.author, email: i.customer?.email })}
    <div class="body"><div class="small"><b>${esc(c.userId ? uname(c.userId) : c.author + " (Kunde)")}</b> <span class="muted">${fmtDT(c.at)}</span>${c.internal ? ' <span class="chip yellow">intern</span>' : isSvc && c.userId ? ' <span class="chip gray">für Kunden sichtbar</span>' : ""}</div>
    <div class="text">${highlightMentions(c.text)}</div></div></div>`).join("") || '<p class="muted small">Noch keine Kommentare.</p>';
  const history = i.history.map((h) => `<div class="hist">${avatar(h.userId)} <b>${esc(uname(h.userId))}</b> hat <b>${esc(h.field)}</b> ${h.from && h.from !== "–" ? `von „${esc(h.from)}“ ` : ""}${h.to === "erstellt" ? "erstellt" : `auf „${esc(h.to)}“ geändert`} <span class="muted small">· ${fmtDT(h.at)}</span></div>`).join("");
  const timePct = i.estimateH ? Math.min(100, (i.loggedH / i.estimateH) * 100) : 0;
  const sf = slaInfo(i, "first"), sr = slaInfo(i, "resolve");
  $("#modal").innerHTML = `
    <div class="modal-h" style="padding-bottom:8px"><div class="small muted mh-crumbs" style="flex:1">${crumbs}</div>
      <div class="mh-sticky">${typeIcon(i.type)}<span class="key">${keyOf(i)}</span><b>${esc(i.summary)}</b>${lozenge(i)}${actionButton(i)}</div>
      <button class="btn subtle sm" data-act="watch" title="Beobachten">${icon("eye")} ${i.watchers.includes(db.currentUserId) ? "Beobachtet" : "Beobachten"} (${i.watchers.length})</button>
      <button class="btn subtle sm icon" data-act="clone" title="Klonen">${icon("copy")}</button>
      <button class="btn subtle sm icon" data-act="delete-issue" title="Löschen">${icon("trash")}</button>
      <button class="btn subtle icon" data-act="close" aria-label="Schließen">${icon("x")}</button></div>
    <div class="issue-wrap">
      <div style="min-width:0">
        <input class="issue-sum" data-f="summary" value="${esc(i.summary)}" aria-label="Zusammenfassung">
        <div class="row" style="margin:8px 0 16px">${i.type !== "SUBTASK" && i.type !== "EPIC" ? `<button class="btn sm" data-act="add-subtask">${icon("sub")} Teilaufgabe</button>` : ""}<button class="btn sm" data-act="add-link">${icon("link")} Verknüpfen</button>${i.type === "EPIC" ? `<button class="btn sm" data-act="create" data-project="${p.id}" data-epic="${i.id}">${icon("plus")} Vorgang im Epic</button>` : ""}</div>
        ${i.customer ? `<div class="note info" style="margin-bottom:14px"><b>${esc(i.customer.name)}</b> · ${esc(i.customer.company || "")} · <a href="mailto:${encodeURIComponent(i.customer.email)}?subject=${encodeURIComponent(`[${keyOf(i)}] ${i.summary}`)}">${esc(i.customer.email)}</a>${i.customer.phone ? ` · ${esc(i.customer.phone)}` : ""}</div>` : ""}
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
          <div class="drow"><span>Verantwortlich</span><span><select data-f="assigneeId">${userOpts(i.assigneeId)}</select>${i.assigneeId !== db.currentUserId ? `<a href="#" class="small" data-act="assign-me">Mir zuweisen</a>` : ""}</span></div>
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
function createForm(prefill = {}) {
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
        <label class="f">Verantwortlich<select name="assigneeId">${userOpts(prefill.assigneeId ?? null)}</select></label>
        <label class="f">Priorität<select name="priority">${prioOpts(prefill.priority || "MEDIUM")}</select></label>
        <label class="f">Fälligkeitsdatum<input type="date" name="dueDate"></label>
        <label class="f">Labels<input type="text" name="labels" placeholder="z. B. portal, kunde"></label>
        ${p.type === "software" ? `<label class="f">Story Points<input type="number" name="storyPoints" min="0" step="1"></label>
        <label class="f">Sprint<select name="sprintId"><option value="">Backlog</option>${db.sprints.filter((x) => x.projectId === p.id && x.state !== "closed").map((x) => `<option value="${x.id}" ${prefill.sprintId === x.id ? "selected" : ""}>${esc(x.name)}${x.state === "active" ? " (aktiv)" : ""}</option>`).join("")}</select></label>` : ""}
        ${epicsOf(p).length ? `<label class="f">Epic<select name="epicId"><option value="">–</option>${epicsOf(p).map((e) => `<option value="${e.id}" ${prefill.epicId === e.id ? "selected" : ""}>${esc(e.summary)}</option>`).join("")}</select></label>` : ""}
        ${p.type === "service" ? `<label class="f">Kunde (Name)<input type="text" name="cname"></label><label class="f">Firma<input type="text" name="ccompany"></label><label class="f">Kunden-E-Mail<input type="email" name="cemail"></label>` : ""}
      </div></div>
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
  $$("[data-drag-appt]").forEach((el) => el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/appt", el.dataset.dragAppt); el.classList.add("dragging"); }));
  $$("[data-drag-appt]").forEach((el) => el.addEventListener("dragend", () => el.classList.remove("dragging")));
  $$("[data-drop-appt]").forEach((cell) => {
    cell.addEventListener("dragover", (e) => { e.preventDefault(); cell.classList.add("drop-on"); });
    cell.addEventListener("dragleave", (e) => { if (!cell.contains(e.relatedTarget)) cell.classList.remove("drop-on"); });
    cell.addEventListener("drop", (e) => {
      e.preventDefault(); cell.classList.remove("drop-on");
      const i = issue(e.dataTransfer.getData("text/appt")); if (!i) return;
      const [userId, day] = cell.dataset.dropAppt.split("|");
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

/* ---------- Excel-Auswertung (.xlsx) ---------- */
/** Erstellt eine Excel-Mappe mit Übersicht, Vorgängen, Serviceeinsätzen, Personen, Monaten, Verlauf und Kommentaren. */
function exportXlsx(list, name, title) {
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
    { h: "Priorität", w: 11 }, { h: "Verantwortlich", w: 18 }, { h: "Melder", w: 20 }, { h: "Firma (Kunde)", w: 24 }, { h: "Ansprechpartner", w: 18 }, { h: "Kunden-E-Mail", w: 24 },
    { h: "Labels", w: 16 }, { h: "Sprint", w: 14 }, { h: "Epic", w: 22 }, { h: "Story Points", w: 8, t: "n" }, { h: "Schätzung (h)", w: 10, t: "h" }, { h: "Erfasst (h)", w: 10, t: "h" },
    { h: "Fällig", w: 11, t: "d" }, { h: "Überfällig", w: 9 }, { h: "Termin", w: 16, t: "dt" }, { h: "Erstellt", w: 16, t: "dt" }, { h: "Erledigt", w: 16, t: "dt" },
    { h: "Durchlaufzeit (Tage)", w: 11, t: "h" }, { h: "SLA Erste Antwort", w: 15 }, { h: "SLA Lösung", w: 15 }, { h: "Kommentare", w: 9, t: "n" }, { h: "Monat erstellt", w: 11 }],
    rows: list.map((i) => [keyOf(i), proj(i.projectId)?.name, TYPES[i.type]?.label, i.summary, statusOf(i).name, CAT_LABEL[statusOf(i).cat] || statusOf(i).cat,
      PRIOS[i.priority]?.label, person(i.assigneeId), i.reporterId ? person(i.reporterId) : i.customer?.name ? `${i.customer.name} (Kunde)` : "", i.customer?.company, i.customer?.name, i.customer?.email,
      i.labels.join(", "), sprint(i.sprintId)?.name, issue(i.epicId)?.summary, i.storyPoints ?? null, i.estimateH ?? null, hoursOf(i),
      i.dueDate, isOverdue(i) ? "ja" : "nein", i.appointmentAt, i.createdAt, i.resolvedAt, days(i.createdAt, i.resolvedAt), slaTxt(i, "first"), slaTxt(i, "resolve"), i.comments.length, i.createdAt.slice(0, 7)]) };

  const eins = { name: "Serviceeinsätze", columns: [
    { h: "Schlüssel", w: 10 }, { h: "Firma", w: 24 }, { h: "Ansprechpartner", w: 18 }, { h: "Telefon", w: 14 }, { h: "Art", w: 14 }, { h: "Betreff", w: 40 }, { h: "Techniker/in", w: 18 },
    { h: "Termin", w: 16, t: "dt" }, { h: "Status", w: 20 }, { h: "Ursache", w: 30, wrap: true }, { h: "Durchgeführte Arbeiten", w: 50, wrap: true }, { h: "Material / Ersatzteile", w: 34, wrap: true },
    { h: "Arbeitszeit (h)", w: 10, t: "h" }, { h: "Bericht am", w: 16, t: "dt" }, { h: "Bericht von", w: 18 }, { h: "Gemeldet", w: 16, t: "dt" }, { h: "Reaktionszeit (h)", w: 10, t: "h" }, { h: "Lösungszeit (h)", w: 10, t: "h" }],
    rows: reports.map((i) => { const r = i.resolution || {};
      return [keyOf(i), i.customer?.company, i.customer?.name, i.customer?.phone, TYPES[i.type]?.label, i.summary, person(i.assigneeId), i.appointmentAt, statusOf(i).name,
        r.cause, r.action, r.parts, typeof r.hours === "number" ? r.hours : null, r.at, person(r.by), i.createdAt, hrs(i.createdAt, i.firstResponseAt), hrs(i.createdAt, i.resolvedAt)]; }) };

  const people = db.users.filter((u) => list.some((i) => i.assigneeId === u.id));
  const pers = { name: "Personen", columns: [{ h: "Person", w: 20 }, { h: "Rolle", w: 18 }, { h: "Vorgänge gesamt", w: 10, t: "n" }, { h: "Zu erledigen", w: 9, t: "n" }, { h: "In Arbeit", w: 9, t: "n" },
    { h: "Erledigt", w: 9, t: "n" }, { h: "Überfällig", w: 9, t: "n" }, { h: "Einsätze mit Bericht", w: 11, t: "n" }, { h: "Stunden erfasst", w: 10, t: "h" }, { h: "Ø Durchlaufzeit (Tage)", w: 12, t: "h" }, { h: "SLA eingehalten", w: 10, t: "p" }],
    rows: people.map((u) => { const l = list.filter((i) => i.assigneeId === u.id);
      return [u.name, ROLES[u.role] || u.role, l.length, l.filter((i) => statusOf(i).cat === "todo").length, l.filter((i) => statusOf(i).cat === "progress").length, l.filter(isDone).length, l.filter(isOverdue).length,
        l.filter((i) => i.resolution).length, r2(l.reduce((s, i) => s + hoursOf(i), 0)), avg(l.filter((i) => i.resolvedAt).map((i) => days(i.createdAt, i.resolvedAt))), quota(slaDone(l))]; }) };

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
    ["Tabellenblätter", null, "Vorgänge · Serviceeinsätze · Personen · Monate · Statusverlauf · Kommentare – mit Filter in der Kopfzeile, direkt für Pivot-Tabellen nutzbar"]] };
  const sheets = [info, vorg, ...(reports.length ? [eins] : []), pers, mon, hist, comm];
  download(name, XLSX.build(sheets, { title, author: sync.company || "GF Tracker" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  toast(`Excel-Datei „${name}“ mit ${list.length} Vorgängen erstellt.`);
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
  switch (act) {
    case "open": if (e.target.closest("button:not([data-act=open]), select, input")) return; e.preventDefault(); openIssue(id); break;
    case "close": if (el.tagName === "A") closeModal(); else dismissModal(); break;
    case "reload": location.reload(); break;
    case "goto": e.preventDefault(); go(el.dataset.href); break;
    case "menu": $("#topnav").classList.toggle("menu-open"); break;
    case "theme": { const c = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.dataset.theme = c === "dark" ? "light" : "dark"; try { localStorage.setItem("gft-theme", document.documentElement.dataset.theme); } catch {} break; }
    case "notifs": { const p = $("#notifs"); p.classList.toggle("open"); if (p.classList.contains("open")) renderNotifs(); break; }
    case "read-all": db.notifications.forEach((n) => { if (n.userId === db.currentUserId) n.read = true; }); save(); renderNotifs(); renderTop(); break;
    case "open-notif": { const n = db.notifications.find((x) => x.id === id); if (n) { n.read = true; save(); $("#notifs").classList.remove("open"); renderTop(); if (n.issueId) openIssue(n.issueId); } break; }
    case "create": e.preventDefault(); createForm({ projectId: el.dataset.project, type: el.dataset.type, epicId: el.dataset.epic }); break;
    case "yw-tab": ui.yourWork = el.dataset.v; render(); break;
    case "board-toggle": ui.board[el.dataset.v] = !ui.board[el.dataset.v]; render(); break;
    case "board-user": { const v = el.dataset.v; const a = ui.board.users; ui.board.users = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; render(); break; }
    case "backlog-epic": ui.backlogEpic = el.dataset.v; render(); break;
    case "tl-toggle": { ui.tlOpen ||= []; ui.tlOpen = ui.tlOpen.includes(id) ? ui.tlOpen.filter((x) => x !== id) : [...ui.tlOpen, id]; render(); break; }
    case "queue": ui.queue = el.dataset.v; render(); break;
    case "new-project": projectForm(); break;
    case "new-sprint": { const p = proj(el.dataset.project); const n = db.sprints.filter((s) => s.projectId === p.id).length + 1; db.sprints.push({ id: uid(), projectId: p.id, name: `${p.key} Sprint ${n}`, goal: "", state: "future", start: null, end: null, committed: null, completed: null }); save(); render(); toast("Sprint erstellt"); break; }
    case "start-sprint": sprintForm(sprint(id)); break;
    case "complete-sprint": completeSprintForm(sprint(id)); break;
    case "delete-sprint": { const s = sprint(id); if (confirm(`${s.name} löschen? Vorgänge wandern ins Backlog.`)) { db.issues.forEach((i) => { if (i.sprintId === id) i.sprintId = null; }); db.sprints = db.sprints.filter((x) => x.id !== id); save(); render(); } break; }
    case "delete-project": { const p = proj(id); if (confirm(`Projekt „${p.name}“ mit ${projIssues(p).length} Vorgängen endgültig löschen?`)) { db.issues = db.issues.filter((i) => i.projectId !== id); db.sprints = db.sprints.filter((s) => s.projectId !== id); db.projects = db.projects.filter((x) => x.id !== id); save(); go("#/projects"); } break; }
    case "save-filter": { const jql = $("#jql")?.value.trim(); if (!jql) return; try { parseJql(jql); } catch (err) { return toast("Abfrage fehlerhaft: " + err.message); } const name = prompt("Name des Filters:"); if (name?.trim()) { const f = { id: uid(), name: name.trim(), jql, ownerId: db.currentUserId }; db.filters.push(f); save(); go(`#/filters?filter=${f.id}`); toast("Filter gespeichert"); } break; }
    case "delete-filter": db.filters = db.filters.filter((f) => f.id !== id); save(); go("#/filters"); break;
    case "export-csv": exportCsv(ui.lastResults || [], `vorgaenge-${today()}.csv`); break;
    case "export-xlsx": exportXlsx(ui.lastResults || [], `auswertung-filter-${today()}.xlsx`, "Suchergebnis / Filter"); break;
    case "export-all-xlsx": exportXlsx(db.issues, `auswertung-gesamt-${today()}.xlsx`, "Alle Projekte"); break;
    case "export-project-xlsx": { const pp = proj(el.dataset.project); if (pp) exportXlsx(projIssues(pp), `auswertung-${pp.key}-${today()}.xlsx`, `Projekt ${pp.name}`); break; }
    case "export-all-csv": exportCsv(db.issues, `alle-vorgaenge-${today()}.csv`); break;
    case "export-json": location.href = "/api/admin/export"; break;
    case "import-json": $("#json-file").click(); break;
    case "logout": api("/api/logout", { method: "POST" }).finally(() => (location.href = "/login")); break;
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
  if (el.id === "portal-project") { go(`#/portal/${el.value}`); return; }
  if (el.id === "cf-project") { const f = el.form; const data = { summary: f.summary.value, description: f.description.value }; ui.lastProject = el.value; createForm({ projectId: el.value }); $("#create-form").summary.value = data.summary; $("#create-form").description.value = data.description; return; }
  if (el.id === "json-file" && el.files[0]) {
    const r = new FileReader(); r.onload = async () => {
      let d; try { d = JSON.parse(r.result); } catch { return toast("Die Datei ist keine gültige Sicherung."); }
      if (!confirm("ACHTUNG: Alle Projekte und Vorgänge werden durch den Inhalt der Sicherung ersetzt. Fortfahren?")) return;
      try { const res = await api("/api/admin/import", { method: "POST", body: d }); await reloadState(); toast(`${res.imported} Vorgänge importiert.${res.usersWithoutPassword.length ? ` Ohne Passwort: ${res.usersWithoutPassword.length} Personen – bitte unter Einstellungen Passwort setzen.` : ""}`); }
      catch (err) { toast(err.message); }
    }; r.readAsText(el.files[0]); el.value = ""; return;
  }
  if (el.dataset.act === "user-role") { const u = user(el.dataset.id); if (u) { u.role = el.value; save(); } return; }
  const cur = issue(ui.openIssue);
  if (el.dataset.f && cur) {
    const f = el.dataset.f; let v = el.value;
    if (f === "summary") { v = v.trim(); if (!v) { el.value = cur.summary; return; } }
    if (["assigneeId", "reporterId", "dueDate", "startDate", "sprintId", "epicId"].includes(f)) v = v || null;
    if (f === "storyPoints" || f === "estimateH") v = v === "" ? null : Number(v);
    if (f === "labels") v = v.split(",").map((x) => x.trim().toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
    if (f === "sprintId") children(cur).forEach((c) => (c.sprintId = v));
    updateIssue(cur, { [f]: v }); render(); renderIssue();
  }
});
document.addEventListener("input", (e) => {
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
      const i = await createIssue({ projectId: fd.get("projectId"), type: fd.get("type"), summary: fd.get("summary"), description: fd.get("description"), assigneeId: fd.get("assigneeId"), priority: fd.get("priority"),
        dueDate: fd.get("dueDate") || null, labels, storyPoints: fd.get("storyPoints") ? Number(fd.get("storyPoints")) : null, sprintId: fd.get("sprintId") || null, epicId: fd.get("epicId") || null,
        customer: cname || cemail ? { name: cname || cemail, company: fd.get("ccompany") || "", email: cemail || "", phone: "" } : null });
      ui.lastProject = i.projectId;
      if (fd.get("another")) { const pid = i.projectId; createForm({ projectId: pid }); $("#create-form").another.checked = true; render(); toast(`${keyOf(i)} erstellt`); }
      else { closeModal(); render(); toast(`${keyOf(i)} erstellt`); openIssue(i.id); }
      break; }
    case "step-form": {
      const it = issue(f.dataset.id); const t = it && TRANSITIONS[PROJECT_TYPES[proj(it.projectId).type].workflow].find((x) => x.id === f.dataset.t);
      if (!it || !t) return;
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
    case "project-form": { const p = proj(f.dataset.id); Object.assign(p, { name: fd.get("name"), desc: fd.get("desc"), leadId: fd.get("leadId") || p.leadId, color: fd.get("color") }); save(); render(); toast("Gespeichert"); break; }
    case "user-form": {
      const r = await api("/api/admin/users", { method: "POST", body: { name: fd.get("name"), email: fd.get("email"), role: fd.get("role"), password: fd.get("password") } });
      applyServer({ type: "users", id: r.user.id, data: r.user }); f.reset(); render(); toast(`${r.user.name} angelegt – Zugangsdaten bitte persönlich übergeben.`); break; }
    case "profile-form": { const u = user(db.currentUserId); u.name = String(fd.get("name")).trim() || u.name; u.notifyEmail = !!fd.get("notifyEmail"); save(); render(); toast("Gespeichert"); break; }
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
  if (e.key === "Escape") { if ($("#notifs").classList.contains("open")) $("#notifs").classList.remove("open"); else if (ui.modal) { e.preventDefault(); dismissModal(); } }
  if (e.key === "Tab" && ui.modal) { // Fokus im Fenster halten
    const f = [...$("#modal").querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (f.length && (e.shiftKey ? document.activeElement === f[0] || document.activeElement === $("#modal") : document.activeElement === f[f.length - 1])) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
  }
  if (e.key === "Enter" && e.target.id === "gsearch") { const q = e.target.value.trim(); if (!q) return; const i = byKey(q); if (i) { openIssue(i.id); e.target.value = ""; } else go(`#/filters?jql=${encodeURIComponent(`text ~ "${q.replace(/"/g, "")}" ORDER BY updated DESC`)}`); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.id === "comment-text") { e.preventDefault(); $("#comment-form").requestSubmit(); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && ui.modal === "form" && e.target.closest("#modal form")) { e.preventDefault(); e.target.closest("form").requestSubmit(); }
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.id === "jql") { e.preventDefault(); $("#jql-form").requestSubmit(); }
  if (!typing && !ui.modal && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === "c") { e.preventDefault(); createForm(); }
    if (e.key === "/") { e.preventDefault(); $("#gsearch")?.focus(); }
  }
});
document.addEventListener("click", (e) => { const th = e.target.closest("th[data-sort]"); if (!th) return;
  const cur = $("#jql")?.value || ""; const base = cur.replace(/\s*ORDER\s+BY[\s\S]*$/i, "").trim(); let dir = "ASC";
  try { const o = parseJql(cur).order[0]; if (o && o.f === th.dataset.sort && o.dir === "ASC") dir = "DESC"; } catch {}
  go(`#/filters?jql=${encodeURIComponent(`${base}${base ? " " : ""}ORDER BY ${th.dataset.sort} ${dir}`)}`); });
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
window.addEventListener("hashchange", () => { $("#topnav").classList.remove("menu-open"); if (ui.modal) closeModal(); render(); window.scrollTo(0, 0); });

/* ---------- Als App installieren (PWA) ---------- */
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; if (route().parts[0] === "settings") render(); });
window.addEventListener("appinstalled", () => { installPrompt = null; toast("GF Tracker wurde als App installiert."); });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));

/* ---------- Start ---------- */
try { const th = localStorage.getItem("gft-theme"); if (th) document.documentElement.dataset.theme = th; } catch {}
(async function boot() {
  try {
    const meRes = await api("/api/me");
    db.currentUserId = meRes.user.id; sync.mail = meRes.mail; sync.company = meRes.company;
    loadState(await api("/api/state"));
    render(); connectEvents();
    setInterval(() => { renderTop(); updateSyncBadge(); }, 60000);
  } catch (e) {
    if (!String(e.message).includes("angemeldet")) $("#view").innerHTML = `<div class="note err">Der Server ist nicht erreichbar: ${esc(e.message)} <button class="btn sm" data-act="reload">Erneut versuchen</button></div>`;
  }
})();
