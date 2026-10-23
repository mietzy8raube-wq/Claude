// Öffentliche REST-Schnittstelle /api/v1 für andere Programme (Warenwirtschaft,
// Buchhaltung, Power Automate, eigene Skripte). Anmeldung per API-Schlüssel:
//   Authorization: Bearer gft_…
// Schlüssel legen Administratoren unter Einstellungen → Integrationen an
// (Berechtigung "read" = nur lesen, "write" = lesen und schreiben).
import { randomToken, sha256 } from "./auth.mjs";

export function createApiV1(ctx) {
  const { store, S, HttpError, readJson, cfg, issueKey, projectById, userById, publicUser, broadcast, issueEffects, customerMails, flushMailQueue, emit, ilog } = ctx;
  const ID = () => S.uid();
  const str = (v, max) => String(v ?? "").trim().slice(0, max);
  const limiter = new Map(); // einfache Begrenzung: 600 Anfragen je Minute und Schlüssel

  /* ---------- Schlüssel ---------- */
  function createKey(name, scope, userId) {
    const token = `gft_${randomToken(30)}`; const id = ID();
    store.db.prepare("INSERT INTO api_keys (id, name, prefix, token_hash, scope, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, str(name, 80) || "API", token.slice(0, 10), sha256(token), scope === "write" ? "write" : "read", userId, Date.now());
    return { id, token };
  }
  /** Persönlicher Schlüssel (z. B. Outlook-Add-in): handelt im Namen der Person; ein neuer ersetzt den bisherigen. */
  function createUserKey(userId, name = "Outlook-Add-in") {
    store.db.prepare("UPDATE api_keys SET revoked = 1 WHERE user_id = ? AND name = ?").run(userId, name);
    const token = `gft_${randomToken(30)}`; const id = ID();
    store.db.prepare("INSERT INTO api_keys (id, name, prefix, token_hash, scope, created_by, created_at, user_id) VALUES (?, ?, ?, ?, 'write', ?, ?, ?)").run(id, name, token.slice(0, 10), sha256(token), userId, Date.now(), userId);
    return { id, token };
  }
  const userKeyInfo = (userId, name = "Outlook-Add-in") => store.db.prepare("SELECT id, prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? AND name = ? AND revoked = 0 ORDER BY created_at DESC LIMIT 1").get(userId, name) || null;
  const listKeys = () => store.db.prepare("SELECT id, name, prefix, scope, created_by, created_at, last_used_at, revoked FROM api_keys WHERE user_id IS NULL ORDER BY created_at DESC").all();
  const revokeKey = (id) => store.db.prepare("UPDATE api_keys SET revoked = 1 WHERE id = ?").run(id).changes > 0;
  function authenticate(req) {
    const m = String(req.headers.authorization || "").match(/^Bearer\s+(gft_[A-Za-z0-9_-]{20,})$/);
    if (!m) throw new HttpError(401, "API-Schlüssel fehlt (Header: Authorization: Bearer gft_…).");
    const key = store.db.prepare("SELECT * FROM api_keys WHERE token_hash = ? AND revoked = 0").get(sha256(m[1]));
    if (!key) throw new HttpError(401, "API-Schlüssel ungültig oder widerrufen.");
    if (key.user_id) { const u = userById(key.user_id); if (!u || !u.active) throw new HttpError(401, "Die Person zu diesem Schlüssel ist nicht mehr aktiv."); key.user = u;
      key.ctx = S.accessContext(u, { projects: store.all("projects"), teams: store.all("teams") }); } // persönlicher Schlüssel: nur der Sichtbereich der Person
    const now = Date.now(); const w = limiter.get(key.id) || { start: now, n: 0 }; if (now - w.start > 60e3) { w.start = now; w.n = 0; }
    if (++w.n > 600) throw new HttpError(429, "Zu viele Anfragen – höchstens 600 je Minute.");
    limiter.set(key.id, w);
    if (!key.last_used_at || now - key.last_used_at > 60e3) store.db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now, key.id);
    return key;
  }

  /* ---------- Datenformate nach außen ---------- */
  const customers = () => store.all("customers");
  const findCustomer = (ref) => { const r = String(ref ?? "").trim(); if (!r) return null; const all = customers(); return all.find((c) => c.id === r) || all.find((c) => c.no && c.no === r) || all.find((c) => c.externalId && c.externalId === r) || null; };
  const findUser = (v) => { const e = String(v ?? "").trim().toLowerCase(); if (!e) return null; return store.all("users").find((u) => u.email.toLowerCase() === e && u.active) || null; };
  const findTeam = (v) => { const n = String(v ?? "").trim().toLowerCase(); if (!n) return null; return store.all("teams").find((t) => t.id === v || t.name.toLowerCase() === n) || null; };
  const person = (id) => { const u = id && userById(id); return u ? { name: u.name, email: u.email } : null; };
  function issueDto(i) {
    const p = projectById(i.projectId); const st = S.statusInfo(p, i.status); const c = i.customerId ? store.get("customers", i.customerId) : null; const a = c && (c.assets || []).find((x) => x.id === i.assetId);
    const key = issueKey(i);
    return { key, id: i.id, url: `${cfg.appUrl}/#/issue/${key}`, project: p?.key, type: i.type, typeName: S.TYPES[i.type]?.label, summary: i.summary, description: i.description,
      status: i.status, statusName: st.name, statusCategory: st.cat, priority: i.priority, priorityName: S.PRIOS[i.priority]?.label,
      assignee: person(i.assigneeId), reporter: person(i.reporterId), team: i.teamId ? store.get("teams", i.teamId)?.name || null : null,
      customer: c ? { no: c.no || null, name: c.name, externalId: c.externalId || null } : null, contact: i.customer || null, asset: a ? { name: a.name, serial: a.serial || null, model: a.model || null } : null,
      dueDate: i.dueDate, appointmentAt: i.appointmentAt || null, labels: i.labels, externalId: i.externalId || null, loggedHours: i.loggedH || 0,
      resolution: i.resolution ? { cause: i.resolution.cause || "", action: i.resolution.action, parts: i.resolution.parts || "", hours: i.resolution.hours ?? null, at: i.resolution.at, by: person(i.resolution.by)?.name || null } : null,
      createdAt: i.createdAt, updatedAt: i.updatedAt, resolvedAt: i.resolvedAt };
  }
  const customerDto = (c) => ({ id: c.id, no: c.no || null, name: c.name, street: c.street || "", zip: c.zip || "", city: c.city || "", phone: c.phone || "", email: c.email || "", externalId: c.externalId || null, notes: c.notes || "",
    contacts: (c.contacts || []).map((k) => ({ name: k.name, role: k.role || "", email: k.email || "", phone: k.phone || "" })),
    assets: (c.assets || []).map((a) => ({ name: a.name, manufacturer: a.manufacturer || "", model: a.model || "", serial: a.serial || "", year: a.year ?? null, location: a.location || "", intervalMonths: a.intervalMonths ?? null, lastMaintenance: a.lastMaintenance || null, nextMaintenance: S.nextMaintenance(a), active: a.active !== false })),
    createdAt: c.createdAt, updatedAt: c.updatedAt });

  /* ---------- Schreibhilfen ---------- */
  const byApi = (key) => (key.user ? key.user.name : `API: ${key.name}`);
  function hist(i, key, field, from, to) { i.history.unshift({ id: ID(), at: new Date().toISOString(), userId: key.user?.id || null, by: key.user ? null : byApi(key), field, from: from ?? "", to: to ?? "" }); }
  function commit(before, after) {
    after.updatedAt = new Date().toISOString(); store.put("issues", after);
    issueEffects({ before, after });
  }
  function resolveIssue(ref, key = null) { const r = decodeURIComponent(String(ref)); const m = r.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
    const all = store.all("issues"); let i = null;
    if (m) { const p = store.all("projects").find((x) => x.key === m[1].toUpperCase()); i = p && store.issueByNo(p.id, Number(m[2])); }
    i = i || all.find((x) => x.id === r) || all.find((x) => x.externalId && x.externalId === r);
    if (!i || (key?.ctx && !S.canSeeIssue(key.ctx, i))) throw new HttpError(404, `Vorgang ${r} nicht gefunden.`); return store.get("issues", i.id); }
  function statusFor(p, v) { if (v == null || v === "") return null; const wf = S.workflowFor(p); const s = String(v).trim().toLowerCase();
    const st = wf.find((x) => x.id.toLowerCase() === s || x.name.toLowerCase() === s); if (!st) throw new HttpError(400, `Unbekannter Status „${v}“. Erlaubt: ${wf.map((x) => `${x.id} (${x.name})`).join(", ")}`); return st; }
  function prioFor(v) { if (v == null || v === "") return null; const s = String(v).trim().toUpperCase(); if (S.PRIOS[s]) return s;
    const e = Object.entries(S.PRIOS).find(([, x]) => x.label.toLowerCase() === String(v).trim().toLowerCase()); if (!e) throw new HttpError(400, `Unbekannte Priorität „${v}“. Erlaubt: ${Object.keys(S.PRIOS).join(", ")}`); return e[0]; }
  const dateOrNull = (v, field) => { if (v == null || v === "") return null; const s = String(v); if (!/^\d{4}-\d{2}-\d{2}/.test(s) || isNaN(new Date(s))) throw new HttpError(400, `${field}: Datum im Format JJJJ-MM-TT erwartet.`); return s.slice(0, 10); };

  function createIssue(key, b) {
    const p = store.all("projects").find((x) => x.key === str(b.project, 10).toUpperCase()); if (!p) throw new HttpError(400, "Feld „project“ (Projektschlüssel, z. B. SD) fehlt oder ist unbekannt.");
    const summary = str(b.summary, 255); if (!summary) throw new HttpError(400, "Feld „summary“ fehlt.");
    const extId = b.externalId ? str(b.externalId, 120) : null;
    if (extId) { const ex = store.all("issues").find((i) => i.externalId === extId); if (ex) return { issue: ex, created: false }; }
    const types = S.PROJECT_TYPES[p.type].types.filter((t) => t !== "SUBTASK" && t !== "EPIC"); const type = b.type ? String(b.type).toUpperCase() : types[0];
    if (!types.includes(type)) throw new HttpError(400, `Unbekannter Typ „${b.type}“ für ${p.key}. Erlaubt: ${types.join(", ")}`);
    const assignee = b.assignee ? findUser(b.assignee) : null; if (b.assignee && !assignee) throw new HttpError(400, `Person „${b.assignee}“ nicht gefunden (E-Mail angeben).`);
    const team = b.team ? findTeam(b.team) : null; if (b.team && !team) throw new HttpError(400, `Team „${b.team}“ nicht gefunden.`);
    const c = b.customer?.no || b.customer?.externalId || typeof b.customer === "string" ? findCustomer(typeof b.customer === "string" ? b.customer : b.customer.no || b.customer.externalId) : null;
    const contact = b.contact && typeof b.contact === "object" ? { name: str(b.contact.name, 120), company: c?.name || str(b.contact.company, 160), email: str(b.contact.email, 200).toLowerCase(), phone: str(b.contact.phone, 60) } : c ? S.customerSnapshot(c) : null;
    const asset = c && b.assetSerial ? (c.assets || []).find((a) => a.serial === String(b.assetSerial)) : null;
    const i = store.tx(() => {
      const x = S.newIssue({ project: p, no: store.reserveNumber(p.id), type, summary, description: str(b.description, 20000), priority: prioFor(b.priority) || "MEDIUM", assigneeId: assignee?.id || null, reporterId: key.user?.id || null,
        labels: Array.isArray(b.labels) ? b.labels.map((l) => str(l, 40).toLowerCase()).filter(Boolean) : [], dueDate: dateOrNull(b.dueDate, "dueDate"), teamId: team ? team.id : undefined,
        customerId: c?.id || null, assetId: asset?.id || null, customer: contact, externalId: extId });
      x.history[0] = { ...x.history[0], userId: key.user?.id || null, by: key.user ? null : byApi(key) };
      if (key.user && !x.watchers.includes(key.user.id)) x.watchers.push(key.user.id);
      const st = statusFor(p, b.status); if (st && st.id !== x.status) { const from = x.status; x.status = st.id; S.applyTransition(x, p, from, st.id); }
      store.put("issues", x); issueEffects({ before: null, after: x });
      const notifyIds = assignee ? [assignee.id] : team ? team.memberIds : [];
      for (const uid of notifyIds.filter((u) => u !== key.user?.id)) ctx.createNotification(uid, assignee ? "assign" : "new", `${assignee ? "Ihnen zugewiesen" : `Neu im Team-Eingang (${team.name})`}: ${p.key}-${x.no}`, `${byApi(key)}: ${summary}`, x.id);
      return x;
    });
    return { issue: i, created: true };
  }
  function patchIssue(key, i, b) {
    const before = JSON.parse(JSON.stringify(i)); const p = projectById(i.projectId);
    const set = (field, label, value, text = (v) => v ?? "–") => { if (JSON.stringify(i[field]) === JSON.stringify(value)) return; hist(i, key, label, text(i[field]), text(value)); i[field] = value; };
    if ("summary" in b) { const v = str(b.summary, 255); if (!v) throw new HttpError(400, "summary darf nicht leer sein."); set("summary", "Zusammenfassung", v); }
    if ("description" in b) set("description", "Beschreibung", str(b.description, 20000), (v) => (v ? `${String(v).slice(0, 60)}…` : "–"));
    if ("priority" in b) set("priority", "Priorität", prioFor(b.priority) || i.priority, (v) => S.PRIOS[v]?.label);
    if ("dueDate" in b) set("dueDate", "Fälligkeitsdatum", dateOrNull(b.dueDate, "dueDate"));
    if ("labels" in b) set("labels", "Labels", Array.isArray(b.labels) ? b.labels.map((l) => str(l, 40).toLowerCase()).filter(Boolean) : [], (v) => v.join(", ") || "–");
    if ("externalId" in b) set("externalId", "Fremd-ID", b.externalId ? str(b.externalId, 120) : null);
    if ("assignee" in b) { const u = b.assignee ? findUser(b.assignee) : null; if (b.assignee && !u) throw new HttpError(400, `Person „${b.assignee}“ nicht gefunden.`); set("assigneeId", "Verantwortlich", u?.id || null, (v) => userById(v)?.name || "–");
      if (u && !i.watchers.includes(u.id)) i.watchers.push(u.id); }
    if ("team" in b) { const t = b.team ? findTeam(b.team) : null; if (b.team && !t) throw new HttpError(400, `Team „${b.team}“ nicht gefunden.`); set("teamId", "Team", t?.id || null, (v) => store.get("teams", v)?.name || "–"); }
    if ("appointmentAt" in b) { const v = b.appointmentAt ? new Date(b.appointmentAt) : null; if (b.appointmentAt && isNaN(v)) throw new HttpError(400, "appointmentAt: ISO-Zeitpunkt erwartet."); set("appointmentAt", "Termin", v ? v.toISOString() : null); }
    if ("customer" in b) { const c = b.customer ? findCustomer(b.customer) : null; if (b.customer && !c) throw new HttpError(400, `Kunde „${b.customer}“ nicht gefunden.`);
      set("customerId", "Kunde", c?.id || null, (v) => store.get("customers", v)?.name || "–"); if (c) i.customer = S.customerSnapshot(c); i.assetId = null; }
    if ("status" in b) { const st = statusFor(p, b.status); if (st && st.id !== i.status) { const from = i.status; hist(i, key, "Status", S.statusInfo(p, from).name, st.name); i.status = st.id; S.applyTransition(i, p, from, st.id); } }
    store.tx(() => commit(before, i));
    if (before.assigneeId !== i.assigneeId && i.assigneeId && i.assigneeId !== key.user?.id) ctx.createNotification(i.assigneeId, "assign", `Ihnen zugewiesen: ${issueKey(i)}`, `${byApi(key)}: ${i.summary}`, i.id);
    customerMails({ before, after: i }); flushMailQueue();
    return i;
  }
  function upsertCustomer(ref, b) {
    const name = str(b.name, 200); const ex = findCustomer(ref) || (b.externalId && findCustomer(b.externalId)) || (b.no && findCustomer(b.no));
    if (!ex && !name) throw new HttpError(400, "Feld „name“ fehlt.");
    const now = new Date().toISOString(); const c = ex ? JSON.parse(JSON.stringify(ex)) : { id: ID(), no: "", name, street: "", zip: "", city: "", phone: "", email: "", notes: "", externalId: null, contacts: [], assets: [], createdAt: now };
    for (const k of ["no", "name", "street", "zip", "city", "phone", "email", "notes"]) if (k in b) c[k] = str(b[k], k === "notes" ? 4000 : 200);
    if ("externalId" in b) c.externalId = b.externalId ? str(b.externalId, 120) : null; else if (!ex && ref && !/^c/.test(ref)) c.externalId = c.externalId || null;
    if (!c.no && !ex) c.no = /^\d+$/.test(String(ref)) ? String(ref) : "";
    if (c.no && customers().some((x) => x.no === c.no && x.id !== c.id)) throw new HttpError(409, `Kundennummer ${c.no} ist bereits vergeben.`);
    if (Array.isArray(b.contacts)) for (const k of b.contacts) { const nm = str(k.name, 120); if (!nm) continue; const em = str(k.email, 200).toLowerCase();
      const hit = c.contacts.find((x) => (em && (x.email || "").toLowerCase() === em) || x.name.toLowerCase() === nm.toLowerCase()); const data = { name: nm, role: str(k.role, 80), email: em, phone: str(k.phone, 60) };
      if (hit) Object.assign(hit, data); else c.contacts.push({ id: ID(), ...data }); }
    if (Array.isArray(b.assets)) for (const a of b.assets) { const nm = str(a.name, 120); if (!nm) continue; const sn = str(a.serial, 80);
      const hit = c.assets.find((x) => (sn && x.serial === sn) || (!sn && x.name.toLowerCase() === nm.toLowerCase()));
      const data = { name: nm, manufacturer: str(a.manufacturer, 80), model: str(a.model, 80), serial: sn, year: a.year ? Number(a.year) || null : null, location: str(a.location, 120),
        intervalMonths: a.intervalMonths != null && a.intervalMonths !== "" ? Number(a.intervalMonths) || null : null, lastMaintenance: dateOrNull(a.lastMaintenance, "lastMaintenance"), nextMaintenance: dateOrNull(a.nextMaintenance, "nextMaintenance"), active: a.active !== false };
      if (hit) Object.assign(hit, data); else c.assets.push({ id: ID(), ...data }); }
    c.updatedAt = now; store.tx(() => store.put("customers", c)); emit("customer.updated", c);
    return { customer: c, created: !ex };
  }

  /* ---------- Routen ---------- */
  const page = (list, url) => { const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100)); const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0); return { total: list.length, limit, offset, items: list.slice(offset, offset + limit) }; };
  async function handle(req, url) {
    const m = req.method; const p = url.pathname.replace(/\/+$/, "");
    if (p === "/api/v1/openapi.json") return openapi();
    const key = authenticate(req);
    const write = () => { if (key.scope !== "write") throw new HttpError(403, "Dieser API-Schlüssel darf nur lesen."); if (key.user && !S.canEdit(key.user)) throw new HttpError(403, "Diese Person hat einen Nur-Lese-Zugang."); };
    const q = (k) => url.searchParams.get(k);
    if (p === "/api/v1" && m === "GET") return { name: "GF Tracker API", version: 1, key: { name: key.name, scope: key.scope }, docs: `${cfg.appUrl}/api/v1/openapi.json`,
      endpoints: ["GET /api/v1/issues", "POST /api/v1/issues", "GET /api/v1/issues/{key}", "PATCH /api/v1/issues/{key}", "POST /api/v1/issues/{key}/comments", "GET /api/v1/customers", "GET /api/v1/customers/{no|externalId|id}", "PUT /api/v1/customers/{no|externalId}", "GET /api/v1/projects", "GET /api/v1/users", "GET /api/v1/teams"] };
    if (p === "/api/v1/issues" && m === "GET") {
      let list = store.all("issues").filter((i) => S.canSeeIssue(key.ctx, i));
      if (q("project")) { const pr = store.all("projects").find((x) => x.key === q("project").toUpperCase()); list = list.filter((i) => i.projectId === pr?.id); }
      if (q("status")) list = list.filter((i) => i.status === q("status").toUpperCase());
      if (q("statusCategory")) list = list.filter((i) => S.statusInfo(projectById(i.projectId), i.status).cat === q("statusCategory"));
      if (q("assignee")) { const u = findUser(q("assignee")); list = list.filter((i) => i.assigneeId === u?.id); }
      if (q("team")) { const t = findTeam(q("team")); list = list.filter((i) => i.teamId === t?.id); }
      if (q("customer")) { const c = findCustomer(q("customer")); list = list.filter((i) => i.customerId === c?.id); }
      if (q("externalId")) list = list.filter((i) => i.externalId === q("externalId"));
      if (q("updatedSince")) list = list.filter((i) => i.updatedAt > q("updatedSince"));
      if (q("q")) { const s = q("q").toLowerCase(); list = list.filter((i) => `${i.summary} ${i.description}`.toLowerCase().includes(s)); }
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const pg = page(list, url); return { ...pg, items: pg.items.map(issueDto) };
    }
    if (p === "/api/v1/issues" && m === "POST") { write(); const r = createIssue(key, await readJson(req, 1e6)); if (r.created) { broadcast(); ilog("api", "info", `${key.name}: ${issueKey(r.issue)} angelegt`); } return { __status: r.created ? 201 : 200, body: { created: r.created, issue: issueDto(r.issue) } }; }
    let pm = p.match(/^\/api\/v1\/issues\/([^/]+)$/);
    if (pm && m === "GET") return issueDto(resolveIssue(pm[1], key));
    if (pm && m === "PATCH") { write(); const i = patchIssue(key, resolveIssue(pm[1], key), await readJson(req, 1e6)); broadcast(); return issueDto(i); }
    pm = p.match(/^\/api\/v1\/issues\/([^/]+)\/comments$/);
    if (pm && m === "POST") { write(); const b = await readJson(req, 1e6); const text = str(b.text, 8000); if (!text) throw new HttpError(400, "Feld „text“ fehlt.");
      const i = resolveIssue(pm[1], key); const before = JSON.parse(JSON.stringify(i)); const c = { id: ID(), userId: key.user?.id || null, author: key.user ? null : str(b.author, 80) || byApi(key), text, at: new Date().toISOString(), internal: b.internal !== false };
      if (key.user && !i.watchers.includes(key.user.id)) i.watchers.push(key.user.id);
      i.comments.push(c); store.tx(() => commit(before, i)); broadcast(); customerMails({ before, after: i }); flushMailQueue();
      const who = i.assigneeId || projectById(i.projectId)?.leadId; if (who && who !== key.user?.id) ctx.createNotification(who, "comment", `Neuer Kommentar (${byApi(key)}): ${issueKey(i)}`, text.slice(0, 140), i.id);
      return { __status: 201, body: { ok: true, comment: { at: c.at, author: c.author, internal: c.internal, text } } }; }
    if (p === "/api/v1/me" && m === "GET") return { key: key.name, user: key.user ? { name: key.user.name, email: key.user.email, role: key.user.role } : null, appUrl: cfg.appUrl };
    if (p === "/api/v1/lookup" && m === "GET") { // Absender einer E-Mail → Kunde, Ansprechpartner, Vorgänge (für das Outlook-Add-in)
      const e = String(q("email") || "").trim().toLowerCase(); if (!e) throw new HttpError(400, "Parameter email fehlt.");
      const c = ctx.findCustomerByEmail(e); const contact = c ? (c.contacts || []).find((k) => (k.email || "").toLowerCase() === e) || null : null;
      const issues = store.all("issues").filter((i) => ((c && i.customerId === c.id) || (i.customer?.email || "").toLowerCase() === e) && S.canSeeIssue(key.ctx, i)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const open = issues.filter((i) => S.statusInfo(projectById(i.projectId), i.status).cat !== "done");
      return { email: e, customer: c ? customerDto(c) : null, contact: contact ? { name: contact.name, role: contact.role || "", phone: contact.phone || "" } : null,
        openIssues: open.slice(0, 20).map(issueDto), recentIssues: issues.filter((i) => !open.includes(i)).slice(0, 5).map(issueDto) };
    }
    pm = p.match(/^\/api\/v1\/issues\/([^/]+)\/attachments$/);
    if (pm && m === "POST") { write(); const b = await readJson(req, 25e6); const i = resolveIssue(pm[1], key);
      const data = Buffer.from(String(b.contentBase64 || ""), "base64"); if (!data.length) throw new HttpError(400, "contentBase64 fehlt.");
      const meta = ctx.addAttachment(i.id, { name: str(b.name, 150) || "datei", type: b.contentType, data, userId: key.user?.id || null, by: key.user ? null : byApi(key), source: b.source === "email" ? "email" : "upload" });
      broadcast(); return { __status: 201, body: { ok: true, id: meta.id, name: meta.name, size: meta.size } }; }
    if (p === "/api/v1/customers" && m === "GET") {
      let list = customers(); if (q("q")) { const s = q("q").toLowerCase(); list = list.filter((c) => `${c.no} ${c.name} ${c.city} ${c.externalId}`.toLowerCase().includes(s)); }
      if (q("updatedSince")) list = list.filter((c) => (c.updatedAt || "") > q("updatedSince"));
      list.sort((a, b) => a.name.localeCompare(b.name, "de")); const pg = page(list, url); return { ...pg, items: pg.items.map(customerDto) };
    }
    if (p === "/api/v1/customers" && m === "POST") { write(); const b = await readJson(req, 2e6); const r = upsertCustomer(b.no || b.externalId || "", b); broadcast(); return { __status: r.created ? 201 : 200, body: { created: r.created, customer: customerDto(r.customer) } }; }
    pm = p.match(/^\/api\/v1\/customers\/([^/]+)$/);
    if (pm && m === "GET") { const c = findCustomer(decodeURIComponent(pm[1])); if (!c) throw new HttpError(404, "Kunde nicht gefunden."); return { ...customerDto(c), openIssues: store.all("issues").filter((i) => i.customerId === c.id && S.canSeeIssue(key.ctx, i) && S.statusInfo(projectById(i.projectId), i.status).cat !== "done").map(issueDto) }; }
    if (pm && m === "PUT") { write(); const r = upsertCustomer(decodeURIComponent(pm[1]), await readJson(req, 2e6)); broadcast(); ilog("api", "info", `${key.name}: Kunde ${r.customer.no || r.customer.name} ${r.created ? "angelegt" : "aktualisiert"}`); return { __status: r.created ? 201 : 200, body: { created: r.created, customer: customerDto(r.customer) } }; }
    if (p === "/api/v1/landscape" && m === "GET") return ctx.landscape(key); // Zusammenfassung für die Systemlandschaft (3D) bzw. die GF-Suite
    if (p === "/api/v1/projects" && m === "GET") return { items: store.all("projects").map((x) => ({ key: x.key, name: x.name, type: x.type, statuses: S.workflowFor(x).map((s) => ({ id: s.id, name: s.name, category: s.cat })), issueTypes: S.PROJECT_TYPES[x.type].types })) };
    if (p === "/api/v1/users" && m === "GET") return { items: store.all("users").filter((u) => u.active).map((u) => ({ name: u.name, email: u.email, role: u.role, teams: store.all("teams").filter((t) => t.memberIds.includes(u.id)).map((t) => t.name) })) };
    if (p === "/api/v1/teams" && m === "GET") return { items: store.all("teams").map((t) => ({ name: t.name, lead: person(t.leadId), members: t.memberIds.map(person).filter(Boolean) })) };
    throw new HttpError(404, "Unbekannter API-Endpunkt. Übersicht: GET /api/v1");
  }

  function openapi() {
    const issueIn = { type: "object", properties: { project: { type: "string", example: "SD" }, type: { type: "string", example: "INCIDENT" }, summary: { type: "string" }, description: { type: "string" }, priority: { type: "string", enum: Object.keys(S.PRIOS) },
      status: { type: "string" }, assignee: { type: "string", description: "E-Mail" }, team: { type: "string" }, dueDate: { type: "string", format: "date" }, labels: { type: "array", items: { type: "string" } },
      customer: { type: "string", description: "Kundennummer, ERP-ID oder ID" }, assetSerial: { type: "string" }, contact: { type: "object" }, externalId: { type: "string", description: "Ihre ID – verhindert doppelte Anlage" } }, required: ["project", "summary"] };
    const ok = (d) => ({ 200: { description: d } });
    return { openapi: "3.0.3", info: { title: "GF Tracker API", version: "1.0", description: "Anmeldung: Header „Authorization: Bearer gft_…“ (Schlüssel unter Einstellungen → Integrationen). Ereignisse aktiv empfangen: Webhooks." },
      servers: [{ url: cfg.appUrl }], components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } }, security: [{ bearer: [] }],
      paths: {
        "/api/v1/issues": { get: { summary: "Vorgänge suchen", parameters: ["project", "status", "statusCategory", "assignee", "team", "customer", "externalId", "updatedSince", "q", "limit", "offset"].map((n) => ({ name: n, in: "query", schema: { type: "string" } })), responses: ok("Liste") },
          post: { summary: "Vorgang anlegen (idempotent über externalId)", requestBody: { content: { "application/json": { schema: issueIn } } }, responses: { 201: { description: "angelegt" }, 200: { description: "bestand bereits" } } } },
        "/api/v1/issues/{key}": { get: { summary: "Vorgang lesen (Schlüssel wie SD-12, ID oder externalId)", parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }], responses: ok("Vorgang") },
          patch: { summary: "Vorgang ändern (status, priority, assignee, team, dueDate, labels, appointmentAt, customer, summary, description, externalId)", parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }], responses: ok("Vorgang") } },
        "/api/v1/issues/{key}/comments": { post: { summary: "Kommentar hinzufügen (internal=true Standard)", parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" } }], responses: { 201: { description: "angelegt" } } } },
        "/api/v1/customers": { get: { summary: "Kunden", parameters: ["q", "updatedSince", "limit", "offset"].map((n) => ({ name: n, in: "query", schema: { type: "string" } })), responses: ok("Liste") }, post: { summary: "Kunde anlegen/aktualisieren", responses: ok("Kunde") } },
        "/api/v1/customers/{ref}": { get: { summary: "Kunde mit offenen Vorgängen", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: ok("Kunde") },
          put: { summary: "Kunde anlegen oder aktualisieren (Kontakte nach E-Mail/Name, Anlagen nach Seriennummer zusammengeführt)", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: ok("Kunde") } },
        "/api/v1/landscape": { get: { summary: "Zusammenfassung je Standort (offene Vorgänge, SLA, Servicestände, Ereignisse) für die Systemlandschaft", responses: ok("Zusammenfassung") } },
        "/api/v1/projects": { get: { summary: "Projekte mit Status und Typen", responses: ok("Liste") } }, "/api/v1/users": { get: { summary: "Aktive Personen", responses: ok("Liste") } }, "/api/v1/teams": { get: { summary: "Teams", responses: ok("Liste") } },
      } };
  }
  return { handle, createKey, createUserKey, userKeyInfo, listKeys, revokeKey, issueDto, customerDto };
}
