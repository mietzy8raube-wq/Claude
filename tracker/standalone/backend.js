/* ======================================================================
   GF Tracker – Einzeldatei-Version: Browser-Backend
   Bildet die Server-Schnittstellen (/api/...) im Browser nach und speichert
   alle Daten im localStorage dieses Browsers. Mehrere Tabs desselben
   Browsers sehen Änderungen live (BroadcastChannel). Fachlogik wie auf dem
   Server (server.mjs) – gemeinsame Regeln kommen aus shared.js.
   ====================================================================== */
(() => {
"use strict";
const S = globalThis.TrackerShared;
const DB_KEY = "gft-sa-db", SESSION_KEY = "gft-sa-user";
const COLLECTIONS = ["users", "teams", "customers", "absences", "projects", "sprints", "issues", "filters", "notifications"];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const COMPANY = "Druckluft Chemnitz";
const BASE = location.href.split(/[?#]/)[0];
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

/* ---------- Datenhaltung ---------- */
let mem = null; // Fallback, falls localStorage gesperrt ist
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(DB_KEY)); } catch {}
  d = d || mem;
  if (!d || !d.entities) d = initial();
  return d;
}
function persist(d) { mem = d; try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch {} }
function initial() {
  const d = { rev: 0, entities: {}, counters: {}, tokens: {}, created: new Date().toISOString() };
  COLLECTIONS.forEach((t) => (d.entities[t] = {}));
  const data = S.seed();
  for (const t of COLLECTIONS) for (const o of data[t] || []) put(d, t, o);
  persist(d);
  return d;
}
function put(d, type, obj) { d.rev++; d.entities[type][obj.id] = { data: obj, rev: d.rev, deleted: false }; return d.rev; }
function del(d, type, id) { const e = d.entities[type][id]; if (!e) return; d.rev++; e.deleted = true; e.rev = d.rev; }
function get(d, type, id, includeDeleted = false) { const e = d.entities[type][id]; return !e || (e.deleted && !includeDeleted) ? null : e.data; }
function all(d, type) { return Object.values(d.entities[type]).filter((e) => !e.deleted).map((e) => e.data); }
function reserveNumber(d, projectId) {
  const used = all(d, "issues").filter((i) => i.projectId === projectId).reduce((m, i) => Math.max(m, i.no || 0), 0);
  const next = Math.max(Number(d.counters[projectId] || 1), used + 1);
  d.counters[projectId] = next + 1;
  return next;
}
/** Liest den aktuellen Stand, führt fn aus und speichert – bei Änderungen werden alle Tabs informiert. */
function tx(fn) {
  const d = load(); const before = d.rev;
  const out = fn(d);
  if (d.rev !== before) { persist(d); announce(d.rev); }
  return out;
}

/* ---------- Live-Aktualisierung (ersetzt Server-Sent Events) ---------- */
const sources = new Set();
const channel = "BroadcastChannel" in window ? new BroadcastChannel("gft-sa") : null;
function emit(rev) { for (const s of sources) s._emit(rev); }
function announce(rev) { setTimeout(() => emit(rev), 0); try { channel?.postMessage(rev); } catch {} }
if (channel) channel.onmessage = (e) => emit(e.data);
window.addEventListener("storage", (e) => { if (e.key === DB_KEY) emit(load().rev); });
class LocalEventSource {
  constructor() { this.listeners = {}; sources.add(this); setTimeout(() => this._emit(load().rev), 0); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  close() { sources.delete(this); }
  _emit(rev) { for (const fn of this.listeners.rev || []) fn({ data: String(rev) }); }
}

/* ---------- Fachliche Hilfen (wie server.mjs) ---------- */
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, color: u.color, notifyEmail: u.notifyEmail !== false });
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const notifId = (key, userId) => "n" + hash(`${key}:${userId}`) + hash(`${userId}|${key}`);
const fmtAppt = (iso) => new Date(iso).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr";
function randomToken(n = 24) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]).join(""); }
function issueKey(d, i) { return `${get(d, "projects", i.projectId)?.key || "?"}-${i.no}`; }
function createNotification(d, userId, type, title, text, issueId, key) {
  const id = key ? notifId(key, userId) : S.uid();
  if (get(d, "notifications", id, true)) return 0;
  const u = userId && get(d, "users", userId); if (!u || !u.active) return 0;
  put(d, "notifications", { id, userId, type, title, text, issueId, at: new Date().toISOString(), read: false, key: key || null });
  return 1;
}
function currentUser(d) {
  // Pro Tab angemeldet (sessionStorage) – neue Tabs übernehmen die zuletzt gewählte Person
  let id = null; try { id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch {}
  const u = id && get(d, "users", id);
  return u && u.active ? u : null;
}

function canWrite(user, type, op, cur, data, d = load()) {
  const admin = user.role === "ADMIN";
  if (type === "users") {
    if (op === "put") return "Benutzer werden über die Benutzerverwaltung angelegt.";
    if (op === "delete") return "Benutzer können nur deaktiviert werden.";
    if (admin) return null;
    if (cur.id !== user.id) return "Nur Administratoren dürfen andere Benutzer ändern.";
    const allowed = new Set(["name", "notifyEmail"]);
    const fields = [...Object.keys(data.set || {}), ...(data.unset || []), ...Object.keys(data.arr || {})];
    return fields.every((f) => allowed.has(f)) ? null : "Sie dürfen nur Ihren Namen und Ihre Benachrichtigungen ändern.";
  }
  if (type === "projects" && !admin) return "Nur Administratoren dürfen Projekte anlegen, ändern oder löschen.";
  if (type === "customers" && op === "delete" && !admin) return "Kunden können nur Administratoren löschen.";
  if (type === "absences" && !admin) {
    const target = (cur || data)?.userId; const lead = (all(d, "teams")).some((t) => t.leadId === user.id && t.memberIds.includes(target));
    if (cur?.source === "factorial") return "Abwesenheiten aus Factorial werden dort gepflegt.";
    if (target !== user.id && !lead) return "Abwesenheiten anderer Personen pflegen Teamleitung oder Administratoren.";
    const moved = data?.set?.userId; if (moved && moved !== target) { const lead2 = (all(d, "teams")).some((t) => t.leadId === user.id && t.memberIds.includes(moved)); if (moved !== user.id && !lead2) return "Abwesenheiten anderer Personen pflegen Teamleitung oder Administratoren."; }
  }
  if (type === "teams" && !admin) {
    if (op !== "patch" || !cur || cur.leadId !== user.id) return "Teams verwalten Administratoren; die Teamleitung kann Mitglieder ändern.";
    const fields = [...Object.keys(data.set || {}), ...(data.unset || []), ...Object.keys(data.arr || {})];
    if (fields.some((f) => !["memberIds", "desc"].includes(f))) return "Die Teamleitung kann nur Mitglieder und Beschreibung ändern.";
  }
  if (type === "notifications") {
    if (op === "put") return null;
    if (!cur || cur.userId !== user.id) return "Fremde Benachrichtigungen können nicht geändert werden.";
    if (op === "patch" && Object.keys(data.set || {}).some((f) => f !== "read")) return "Nur der Gelesen-Status kann geändert werden.";
  }
  return null;
}
function sanitize(d, type, obj, cur) {
  if (type === "issues") {
    if (!get(d, "projects", obj.projectId)) throw new HttpError(400, "Projekt existiert nicht.");
    if (!S.TYPES[obj.type]) throw new HttpError(400, "Unbekannter Vorgangstyp.");
    if (!S.PRIOS[obj.priority]) obj.priority = "MEDIUM";
    if (typeof obj.summary !== "string" || !obj.summary.trim()) throw new HttpError(400, "Zusammenfassung fehlt.");
    obj.summary = obj.summary.slice(0, 255);
    if (cur) { obj.no = cur.no; obj.projectId = cur.projectId; }
    else {
      const clash = all(d, "issues").some((x) => x.projectId === obj.projectId && x.no === obj.no && x.id !== obj.id);
      if (!Number.isInteger(obj.no) || obj.no < 1 || clash) obj.no = reserveNumber(d, obj.projectId);
    }
  }
  if (type === "projects") {
    obj.key = String(obj.key || "").toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(obj.key)) throw new HttpError(400, "Ungültiger Projektschlüssel.");
    if (all(d, "projects").some((p) => p.key === obj.key && p.id !== obj.id)) throw new HttpError(409, `Schlüssel ${obj.key} ist bereits vergeben.`);
    if (!S.PROJECT_TYPES[obj.type]) throw new HttpError(400, "Unbekannter Projekttyp.");
  }
  if (type === "users" && cur) obj.email = cur.email;
  if (type === "customers") {
    obj.name = String(obj.name || "").trim().slice(0, 200); if (!obj.name) throw new HttpError(400, "Kundenname fehlt.");
    obj.no = String(obj.no ?? "").trim().slice(0, 40);
    obj.contacts = (Array.isArray(obj.contacts) ? obj.contacts : []).filter((k) => k && ID_RE.test(String(k.id))).slice(0, 200);
    obj.assets = (Array.isArray(obj.assets) ? obj.assets : []).filter((a) => a && ID_RE.test(String(a.id))).slice(0, 500);
  }
  if (type === "absences") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.start || "") || !/^\d{4}-\d{2}-\d{2}$/.test(obj.end || "") || obj.end < obj.start) throw new HttpError(400, "Ungültiger Zeitraum.");
    obj.type = String(obj.type || "Abwesend").slice(0, 40); obj.source = cur?.source || (obj.source === "factorial" ? "manual" : obj.source || "manual");
  }
  if (type === "teams") {
    obj.name = String(obj.name || "").trim().slice(0, 80); if (!obj.name) throw new HttpError(400, "Teamname fehlt.");
    obj.memberIds = [...new Set((Array.isArray(obj.memberIds) ? obj.memberIds : []).filter((x) => typeof x === "string" && ID_RE.test(x)))];
    if (obj.leadId && !obj.memberIds.includes(obj.leadId)) obj.memberIds.unshift(obj.leadId);
  }
  return obj;
}
function applyOp(d, user, op) {
  const { type, id } = op;
  if (!COLLECTIONS.includes(type) || !ID_RE.test(String(id))) throw new HttpError(400, "Ungültiges Objekt.");
  const cur = get(d, type, id);
  if (op.op === "delete") {
    const err = canWrite(user, type, "delete", cur, {}); if (err) throw new HttpError(403, err);
    if (cur) del(d, type, id);
    return { type, id, deleted: true };
  }
  let next;
  if (op.op === "put") {
    if (!op.data || typeof op.data !== "object" || op.data.id !== id) throw new HttpError(400, "Ungültige Daten.");
    if (cur) {
      if (type === "notifications") return { type, id, data: cur };
      const patch = S.diffEntity(cur, op.data) || { set: {} };
      const err = canWrite(user, type, "patch", cur, patch); if (err) throw new HttpError(403, err);
      next = S.applyPatch(cur, patch);
    } else {
      const err = canWrite(user, type, "put", null, op.data); if (err) throw new HttpError(403, err);
      if (type === "notifications" && !get(d, "users", op.data.userId)) throw new HttpError(400, "Empfänger unbekannt.");
      next = op.data;
    }
  } else if (op.op === "patch") {
    if (!cur) return { type, id, deleted: true, error: "Das Objekt wurde inzwischen gelöscht." };
    const err = canWrite(user, type, "patch", cur, op.patch || {}); if (err) throw new HttpError(403, err);
    next = S.applyPatch(cur, op.patch || {});
  } else throw new HttpError(400, "Unbekannte Operation.");
  next.id = id; next = sanitize(d, type, next, cur);
  put(d, type, next);
  // Wartungsplan fortschreiben, wenn ein Wartungsvorgang erledigt wurde
  if (type === "issues" && cur && next.assetId && next.customerId && next.type === "MAINT") {
    const p = get(d, "projects", next.projectId); const cat = (i) => S.statusInfo(p, i.status).cat;
    if (p && cat(cur) !== "done" && cat(next) === "done") { const c = get(d, "customers", next.customerId); const upd = c && S.completeMaintenance(c, next.assetId, S.dayKey(next.resolvedAt || new Date())); if (upd) put(d, "customers", upd); }
  }
  return { type, id, data: type === "users" ? publicUser(next) : next };
}

/* ---------- Fristen, Termine und SLA (läuft jede Minute in jedem offenen Tab) ---------- */
function deadlineJob() {
  tx((d) => {
    const t = S.today();
    for (const i of all(d, "issues")) {
      const p = get(d, "projects", i.projectId); if (!p || S.statusInfo(p, i.status).cat === "done") continue;
      const key = issueKey(d, i);
      if (i.dueDate && i.type !== "EPIC") {
        const dd = S.daysBetween(t, i.dueDate);
        if (dd < 0) for (const u of new Set([i.assigneeId, i.reporterId].filter(Boolean))) createNotification(d, u, "overdue", `Überfällig: ${key} ${i.summary}`, `Fällig war ${i.dueDate.split("-").reverse().join(".")}.`, i.id, `od:${i.id}:${i.dueDate}`);
        else if (dd <= 2) { const u = i.assigneeId || i.reporterId; if (u) createNotification(d, u, "due", `Bald fällig: ${key} ${i.summary}`, `Fällig am ${i.dueDate.split("-").reverse().join(".")}.`, i.id, `ds:${i.id}:${i.dueDate}`); }
      }
      if (i.status === "SCHEDULED" && i.appointmentAt && i.assigneeId) {
        const ms = new Date(i.appointmentAt).getTime() - Date.now();
        if (ms > 0 && ms <= 18 * 36e5) createNotification(d, i.assigneeId, "due", `Einsatz ${fmtAppt(i.appointmentAt).replace(/ Uhr$/, "")}: ${key}`, `${i.customer?.company || ""} – ${i.summary}`, i.id, `appt:${i.id}:${i.appointmentAt}`);
        if (ms < -2 * 36e5) createNotification(d, i.assigneeId, "overdue", `Einsatz noch nicht begonnen: ${key}`, `Termin war ${fmtAppt(i.appointmentAt)}. Bitte beginnen oder neu einplanen.`, i.id, `apptlate:${i.id}:${i.appointmentAt}`);
      }
      for (const kind of ["first", "resolve"]) {
        const s = S.slaCompute(i, p, kind); if (!s || s.stopped) continue;
        const who = i.assigneeId || p.leadId; if (!who) continue;
        const name = kind === "first" ? "Erste Antwort" : "Lösung";
        if (s.breached) createNotification(d, who, "sla", `SLA verletzt (${name}): ${key}`, i.summary, i.id, `slab:${kind}:${i.id}:${i.priority}`);
        else if (s.risk) createNotification(d, who, "sla", `SLA gefährdet (${name}): ${key}`, `${i.summary} – noch ${S.fmtDur(s.remaining)}`, i.id, `slar:${kind}:${i.id}:${i.priority}`);
      }
    }
    // Wartungsplan: fällige Wartungen als Vorgang anlegen
    const mp = all(d, "projects").find((p) => p.type === "service" && p.autoMaint);
    if (mp) for (const { customer, asset, due } of S.maintenanceDue({ customers: all(d, "customers"), issues: all(d, "issues"), projects: all(d, "projects"), today: t, leadDays: mp.maintLeadDays ?? 21 })) {
      const i = S.newIssue({ project: mp, no: reserveNumber(d, mp.id), reporterId: null, ...S.maintenanceIssueData(customer, asset, due) }); put(d, "issues", i);
      const c2 = JSON.parse(JSON.stringify(customer)); c2.assets.find((a) => a.id === asset.id).autoCreatedFor = due; put(d, "customers", c2);
      const team = i.teamId ? get(d, "teams", i.teamId) : null;
      for (const u of new Set([...(team?.memberIds || []), mp.leadId].filter(Boolean))) createNotification(d, u, "new", `Wartung fällig: ${issueKey(d, i)}`, `${customer.name} – ${asset.name} bis ${due.split("-").reverse().join(".")}`, i.id);
    }
  });
}

/* ---------- Kundenportal ---------- */
function portalLink(d, issueId) {
  let token = Object.keys(d.tokens).find((k) => d.tokens[k] === issueId);
  if (!token) { token = randomToken(24); d.tokens[token] = issueId; }
  return { token, url: `${BASE}?portal&r=${token}` };
}
function portalIssue(d, token) {
  const id = d.tokens[String(token)]; const issue = id && get(d, "issues", id);
  if (!issue) throw new HttpError(404, "Anfrage nicht gefunden. Bitte den Link aus der Bestätigung verwenden.");
  return issue;
}
function portalView(d, issue) {
  const p = get(d, "projects", issue.projectId); const st = S.statusInfo(p, issue.status); const u = (id) => (id ? get(d, "users", id) : null);
  return { key: issueKey(d, issue), summary: issue.summary, description: issue.description, type: issue.type, status: st.name, statusCat: st.cat, closed: issue.status === "CLOSED", createdAt: issue.createdAt,
    appointmentAt: ["SCHEDULED", "WORKING"].includes(issue.status) ? issue.appointmentAt || null : null, technician: u(issue.assigneeId)?.name || null,
    report: issue.resolution && st.cat === "done" ? { cause: issue.resolution.cause, action: issue.resolution.action, parts: issue.resolution.parts, hours: issue.resolution.hours, at: issue.resolution.at } : null,
    comments: issue.comments.filter((c) => !c.internal).map((c) => ({ at: c.at, text: c.text, fromCustomer: !c.userId, author: c.userId ? `${u(c.userId)?.name || "Service"} (Service)` : c.author || "Sie" })) };
}
function portalCreate(b) {
  if (b.website) throw new HttpError(400, "Ungültige Anfrage.");
  return tx((d) => {
    const p = all(d, "projects").find((x) => x.key === str(b.projectKey, 10).toUpperCase() && x.type === "service");
    if (!p) throw new HttpError(400, "Service-Bereich nicht gefunden.");
    const type = S.REQUEST_TYPES.some((r) => r.id === b.type) ? b.type : null; if (!type) throw new HttpError(400, "Bitte eine Anfrageart wählen.");
    const name = str(b.name, 120), company = str(b.company, 160), email = str(b.email, 200).toLowerCase(), summary = str(b.summary, 200), description = str(b.description, 8000);
    if (!name || !company || !summary || !description) throw new HttpError(400, "Bitte alle Pflichtfelder ausfüllen.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Bitte eine gültige E-Mail-Adresse angeben.");
    const priority = S.URGENCY.some((u) => u.id === b.urgency) ? b.urgency : "MEDIUM";
    const i = S.newIssue({ project: p, no: reserveNumber(d, p.id), type, summary, priority, reporterId: null, labels: ["portal"],
      description: [str(b.asset, 200) ? `Anlage/Standort: ${str(b.asset, 200)}` : "", description].filter(Boolean).join("\n\n"),
      customer: { name, company, email, phone: str(b.phone, 60) },
      customerId: all(d, "customers").find((c) => (c.email || "").toLowerCase() === email || (c.contacts || []).some((k) => (k.email || "").toLowerCase() === email))?.id || null });
    put(d, "issues", i);
    for (const u of all(d, "users").filter((u) => u.active && (u.role === "AGENT" || u.id === p.leadId))) createNotification(d, u.id, "new", `Neue Anfrage: ${p.key}-${i.no}`, `${company} · ${name}: ${summary}`, i.id);
    const link = portalLink(d, i.id);
    return { key: issueKey(d, i), token: link.token, url: link.url, mailSent: false };
  });
}
function portalReply(token, b) {
  const text = str(b.text, 8000); if (!text) throw new HttpError(400, "Bitte eine Nachricht eingeben.");
  return tx((d) => {
    const i = portalIssue(d, token); const p = get(d, "projects", i.projectId);
    if (i.status === "CLOSED") throw new HttpError(409, "Diese Anfrage ist abgeschlossen. Bitte stellen Sie eine neue Anfrage.");
    const now = new Date().toISOString();
    i.comments.push({ id: S.uid(), userId: null, author: i.customer?.name || "Kunde", text, at: now, internal: false });
    if (i.status === "WAITING" || S.statusInfo(p, i.status).cat === "done") {
      const from = i.status; i.status = "WORKING"; S.applyTransition(i, p, from, "WORKING", now);
      i.history.unshift({ id: S.uid(), at: now, userId: null, field: "Status", from: S.statusInfo(p, from).name, to: S.statusInfo(p, "WORKING").name });
    }
    i.updatedAt = now; put(d, "issues", i);
    const who = i.assigneeId || p.leadId; if (who) createNotification(d, who, "comment", `Kunde hat geantwortet: ${issueKey(d, i)}`, `${i.customer?.name}: ${text.slice(0, 120)}`, i.id);
    return portalView(d, i);
  });
}

/* ---------- Sicherung ---------- */
function exportAll(d) {
  const out = { format: "gf-tracker", version: 1, exportedAt: new Date().toISOString() };
  for (const t of COLLECTIONS) if (t !== "notifications") out[t] = all(d, t);
  out.users = out.users.map(publicUser);
  return out;
}
function importAll(data, admin) {
  if (!data || !Array.isArray(data.issues) || !Array.isArray(data.projects) || !Array.isArray(data.users)) throw new HttpError(400, "Unbekanntes Format. Erwartet wird eine Sicherung des GF Trackers.");
  tx((d) => {
    for (const t of COLLECTIONS) for (const o of all(d, t)) del(d, t, o.id);
    const users = data.users.map((u) => ({ ...publicUser({ notifyEmail: true, active: true, color: S.hashColor(u.email), ...u }), email: String(u.email).toLowerCase() }));
    if (!users.some((u) => u.id === admin.id)) users.push(publicUser(admin));
    for (const u of users) put(d, "users", u);
    for (const t of ["teams", "customers", "absences", "projects", "sprints", "issues", "filters"]) for (const o of data[t] || []) if (o && ID_RE.test(String(o.id))) put(d, t, o);
    d.counters = {};
  });
  return { imported: data.issues.length, usersWithoutPassword: [] };
}
function download(name, text) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- Schnittstellen ---------- */
function handle(method, url, body) {
  const p = url.pathname.replace(/^.*?\/api\//, "/api/");
  if (p === "/api/health") return { ok: true, rev: load().rev, mail: false };
  if (p === "/api/portal/config") { const d = load(); return { company: COMPANY, projects: all(d, "projects").filter((x) => x.type === "service").map((x) => ({ key: x.key, name: x.name })), requestTypes: S.REQUEST_TYPES, urgency: S.URGENCY }; }
  if (p === "/api/portal/requests" && method === "POST") return portalCreate(body);
  let pm = p.match(/^\/api\/portal\/requests\/([A-Za-z0-9_-]{20,64})$/);
  if (pm && method === "GET") { const d = load(); return portalView(d, portalIssue(d, pm[1])); }
  pm = p.match(/^\/api\/portal\/requests\/([A-Za-z0-9_-]{20,64})\/comments$/);
  if (pm && method === "POST") return portalReply(pm[1], body);
  if (p === "/api/logout") { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch {} return { ok: true }; }

  const d0 = load(); const user = currentUser(d0);
  if (!user) throw new HttpError(401, "Nicht angemeldet.");
  const needAdmin = () => { if (user.role !== "ADMIN") throw new HttpError(403, "Nur für Administratoren."); };
  if (p === "/api/me") return { user: publicUser(user), mail: false, company: COMPANY, appUrl: BASE };
  if (p === "/api/me/password") return { ok: true };
  if (p === "/api/state") {
    const out = { rev: d0.rev };
    for (const t of COLLECTIONS) out[t] = all(d0, t);
    out.users = out.users.map(publicUser);
    out.notifications = out.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    return out;
  }
  if (p === "/api/changes") {
    const since = Number(url.searchParams.get("since") || 0); const changes = [];
    for (const t of COLLECTIONS) for (const [id, e] of Object.entries(d0.entities[t])) {
      if (e.rev <= since || (t === "notifications" && e.data.userId !== user.id)) continue;
      changes.push({ rev: e.rev, c: e.deleted ? { type: t, id, deleted: true } : { type: t, id, data: t === "users" ? publicUser(e.data) : e.data } });
    }
    return { rev: d0.rev, changes: changes.sort((a, b) => a.rev - b.rev).map((x) => x.c) };
  }
  if (p === "/api/sync" && method === "POST") {
    if (!Array.isArray(body?.ops)) throw new HttpError(400, "Ungültige Änderungen.");
    return tx((d) => {
      const results = [];
      for (const op of body.ops) {
        try { results.push(applyOp(d, user, op)); }
        catch (e) { if (!(e instanceof HttpError)) throw e; const cur = get(d, op.type, op.id); results.push({ type: op.type, id: op.id, error: e.message, ...(cur ? { data: op.type === "users" ? publicUser(cur) : cur } : { deleted: true }) }); }
      }
      return { rev: d.rev, results };
    });
  }
  pm = p.match(/^\/api\/projects\/([A-Za-z0-9_-]+)\/reserve$/);
  if (pm && method === "POST") return tx((d) => { if (!get(d, "projects", pm[1])) throw new HttpError(404, "Projekt nicht gefunden."); d.rev++;
    const count = Math.min(5000, Math.max(1, Number(url.searchParams.get("count")) || 1)); const first = reserveNumber(d, pm[1]); d.counters[pm[1]] = first + count; return { no: first, count }; });
  if (p === "/api/admin/users/import" && method === "POST") { needAdmin(); return tx((d) => { let created = 0, updated = 0;
    for (const x of body.users || []) { const name = str(x.name, 120), email = str(x.email, 200).toLowerCase(); const role = S.ROLES[x.role] ? x.role : "MEMBER"; if (!name || !email.includes("@")) continue;
      const ex = all(d, "users").find((u) => u.email.toLowerCase() === email);
      if (ex) { put(d, "users", { ...ex, name, role: ex.id === user.id ? ex.role : role, active: true }); updated++; } else { put(d, "users", { id: S.uid(), name, email, role, active: true, color: S.hashColor(email), notifyEmail: true }); created++; } }
    return { created, updated, skipped: [] }; }); }
  if (p === "/api/admin/users" && method === "POST") {
    needAdmin();
    const name = str(body.name, 120), email = str(body.email, 200).toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Bitte Name und gültige E-Mail angeben.");
    if (!S.ROLES[body.role]) throw new HttpError(400, "Unbekannte Rolle.");
    return tx((d) => {
      const existing = all(d, "users").find((u) => u.email.toLowerCase() === email);
      if (existing?.active) throw new HttpError(409, "Diese E-Mail-Adresse hat bereits einen Zugang.");
      const u = existing ? { ...existing, name, role: body.role, active: true } : { id: S.uid(), name, email, role: body.role, active: true, color: S.hashColor(email), notifyEmail: true };
      put(d, "users", u); return { user: publicUser(u) };
    });
  }
  if (/^\/api\/admin\/users\/[A-Za-z0-9_-]+\/password$/.test(p)) { needAdmin(); return { ok: true }; }
  if (p === "/api/admin/export") { needAdmin(); download(`gf-tracker-sicherung-${S.today()}.json`, JSON.stringify(exportAll(d0), null, 2)); return { ok: true }; }
  if (p === "/api/admin/import" && method === "POST") { needAdmin(); return importAll(body, user); }
  if (p === "/api/me/calendar") return { standalone: true };
  if (p === "/api/admin/integrations") { needAdmin(); return { standalone: true }; }
  if (p === "/api/admin/mail-test") throw new HttpError(409, "In der Einzeldatei-Version gibt es keinen E-Mail-Versand – dafür wird die Server-Version benötigt.");
  throw new HttpError(404, "Unbekannte Schnittstelle.");
}

const realFetch = window.fetch.bind(window);
window.fetch = function (input, init = {}) {
  const raw = typeof input === "string" ? input : input.url;
  const url = new URL(raw, location.href);
  if (!/\/api\//.test(url.pathname) || (url.origin !== location.origin && url.protocol !== "file:")) return realFetch(input, init);
  const method = (init.method || "GET").toUpperCase();
  let status = 200, out;
  try { out = handle(method, url, init.body ? JSON.parse(init.body) : undefined); }
  catch (e) { status = e instanceof HttpError ? e.status : 500; out = { error: e instanceof HttpError ? e.message : `Interner Fehler: ${e.message}` }; if (!(e instanceof HttpError)) console.error(e); }
  return Promise.resolve(new Response(JSON.stringify(out), { status, headers: { "Content-Type": "application/json" } }));
};
window.EventSource = LocalEventSource;

/* ---------- Öffentliche Hilfen für die Startseite ---------- */
globalThis.GFTLocal = {
  BASE,
  users: () => all(load(), "users").filter((u) => u.active).map(publicUser),
  login(id) { try { sessionStorage.setItem(SESSION_KEY, id); localStorage.setItem(SESSION_KEY, id); } catch {} },
  current: () => { const u = currentUser(load()); return u ? publicUser(u) : null; },
  reset() { try { localStorage.removeItem(DB_KEY); } catch {} mem = null; initial(); announce(load().rev); },
};
deadlineJob();
setInterval(() => { try { deadlineJob(); } catch (e) { console.error(e); } }, 60e3);
})();
