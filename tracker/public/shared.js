/* ======================================================================
   GF Tracker – gemeinsame Fachlogik für Browser (app.js, portal.js) und
   Server (server.mjs). Wird im Browser als <script> geladen und auf dem
   Server per vm ausgeführt; stellt alles unter globalThis.TrackerShared bereit.
   Änderungen an Workflows, Prioritäten oder SLA-Zielen nur hier vornehmen.
   ====================================================================== */
globalThis.TrackerShared = (() => {
"use strict";
const TYPES = {
  EPIC: { label: "Epic", color: "#8f5bd6", icon: "bolt" },
  STORY: { label: "Story", color: "#1f9d55", icon: "bookmark" },
  TASK: { label: "Aufgabe", color: "#2a78d6", icon: "check" },
  BUG: { label: "Bug", color: "#e34948", icon: "bug" },
  SUBTASK: { label: "Teilaufgabe", color: "#4ba3e3", icon: "sub" },
  INCIDENT: { label: "Störung", color: "#d0352c", icon: "alert" },
  SERVICE: { label: "Serviceanfrage", color: "#2a78d6", icon: "help" },
  MAINT: { label: "Wartung", color: "#16946a", icon: "wrench" },
};
const PROJECT_TYPES = {
  software: { label: "Software (Scrum)", types: ["STORY", "TASK", "BUG", "EPIC", "SUBTASK"], workflow: "standard" },
  business: { label: "Business (Kanban)", types: ["TASK", "EPIC", "SUBTASK"], workflow: "standard" },
  service: { label: "Service-Desk", types: ["INCIDENT", "SERVICE", "MAINT", "SUBTASK"], workflow: "service" },
};
/* Workflows: "side" = Nebenzustand (Warten/Blockiert), erscheint nicht als Hauptschritt im Fortschritt. */
const WORKFLOWS = {
  standard: [
    { id: "TODO", name: "Zu erledigen", cat: "todo" },
    { id: "PROGRESS", name: "In Arbeit", cat: "progress" },
    { id: "BLOCKED", name: "Blockiert", cat: "progress", side: true },
    { id: "REVIEW", name: "In Prüfung", cat: "progress" },
    { id: "DONE", name: "Fertig", cat: "done" },
  ],
  service: [
    { id: "OPEN", name: "Neu", cat: "todo" },
    { id: "SCHEDULED", name: "Eingeplant", cat: "progress" },
    { id: "WORKING", name: "In Arbeit", cat: "progress" },
    { id: "WAITING", name: "Wartet auf Kunde", cat: "progress", side: true },
    { id: "PARTS", name: "Wartet auf Ersatzteil", cat: "progress", side: true },
    { id: "RESOLVED", name: "Erledigt", cat: "done" },
    { id: "CLOSED", name: "Abgeschlossen", cat: "done" },
  ],
};
/* Arbeitsschritte (Übergänge) mit Pflichtangaben.
   needs: assignee = Verantwortliche/r · appointment = Termin · reply = Nachricht an Kunden (Pflicht)
          note = interne Notiz (Pflicht) · comment = Kommentar (Pflicht) · report = Servicebericht · optComment = Kommentar optional
   types: nur für diese Vorgangstypen · primary: Hauptschritt (hervorgehoben) */
const TRANSITIONS = {
  standard: [
    { id: "start", from: ["TODO"], to: "PROGRESS", label: "Starten", primary: true, needs: ["assignee"] },
    { id: "review", from: ["PROGRESS"], to: "REVIEW", label: "Zur Prüfung geben", primary: true, needs: ["optComment"], hint: "Der Melder wird zur Freigabe benachrichtigt." },
    { id: "done", from: ["PROGRESS"], to: "DONE", label: "Erledigt", needs: ["optComment"] },
    { id: "approve", from: ["REVIEW"], to: "DONE", label: "Freigeben", primary: true, needs: ["optComment"] },
    { id: "rework", from: ["REVIEW"], to: "PROGRESS", label: "Zurück zur Überarbeitung", needs: ["comment"] },
    { id: "block", from: ["TODO", "PROGRESS"], to: "BLOCKED", label: "Blockiert melden", needs: ["comment"], hint: "Woran hängt es? Wer muss etwas tun?" },
    { id: "unblock", from: ["BLOCKED"], to: "PROGRESS", label: "Weiter bearbeiten", primary: true, needs: ["optComment"] },
    { id: "defer", from: ["PROGRESS"], to: "TODO", label: "Zurückstellen", needs: ["optComment"] },
    { id: "reopen", from: ["DONE"], to: "PROGRESS", label: "Wieder öffnen", needs: ["comment"] },
  ],
  service: [
    { id: "schedule", from: ["OPEN"], to: "SCHEDULED", label: "Einplanen", primary: true, types: ["INCIDENT", "MAINT"], needs: ["assignee", "appointment"], hint: "Der Kunde erhält eine Terminbestätigung per E-Mail." },
    { id: "work", from: ["OPEN"], to: "WORKING", label: "Bearbeiten", primary: true, types: ["SERVICE", "SUBTASK"], needs: ["assignee"] },
    { id: "work-now", from: ["OPEN"], to: "WORKING", label: "Sofort bearbeiten", types: ["INCIDENT", "MAINT"], needs: ["assignee"] },
    { id: "ask", from: ["OPEN", "SCHEDULED", "WORKING"], to: "WAITING", label: "Rückfrage an Kunden", needs: ["reply"], hint: "Die Lösungsfrist (SLA) pausiert, bis der Kunde antwortet." },
    { id: "begin", from: ["SCHEDULED"], to: "WORKING", label: "Einsatz beginnen", primary: true, needs: [] },
    { id: "reschedule", from: ["SCHEDULED"], to: "SCHEDULED", label: "Termin verschieben", needs: ["assignee", "appointment"], hint: "Der Kunde erhält den neuen Termin per E-Mail." },
    { id: "parts", from: ["SCHEDULED", "WORKING"], to: "PARTS", label: "Ersatzteil bestellt", needs: ["note"], hint: "Welches Teil, bei wem bestellt, voraussichtlicher Liefertermin?" },
    { id: "resume", from: ["WAITING", "PARTS"], to: "WORKING", label: "Fortsetzen", primary: true, needs: ["optComment"] },
    { id: "replan", from: ["PARTS", "WAITING"], to: "SCHEDULED", label: "Neu einplanen", needs: ["assignee", "appointment"] },
    { id: "resolve", from: ["WORKING"], to: "RESOLVED", label: "Erledigt – Servicebericht", primary: true, needs: ["report"], hint: "Der Bericht wird dem Kunden im Portal und per E-Mail angezeigt." },
    { id: "close", from: ["RESOLVED"], to: "CLOSED", label: "Abschließen", primary: true, needs: ["optComment"], hint: "Abgerechnet bzw. vollständig erledigt." },
    { id: "reopen", from: ["RESOLVED", "CLOSED"], to: "WORKING", label: "Wieder öffnen", needs: ["comment"] },
  ],
};
const transitionsFor = (project, issue) => (TRANSITIONS[PROJECT_TYPES[project.type].workflow] || [])
  .filter((t) => t.from.includes(issue.status) && (!t.types || t.types.includes(issue.type)));
const CAT_LABEL = { todo: "Zu erledigen", progress: "In Arbeit", done: "Fertig" };
const PRIOS = {
  HIGHEST: { label: "Höchste", color: "#c9372c", rank: 5, svg: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>' },
  HIGH: { label: "Hoch", color: "#e2483d", rank: 4, svg: '<path d="M6 15l6-6 6 6"/>' },
  MEDIUM: { label: "Mittel", color: "#d39a00", rank: 3, svg: '<path d="M5 9h14M5 15h14"/>' },
  LOW: { label: "Niedrig", color: "#2a78d6", rank: 2, svg: '<path d="M6 9l6 6 6-6"/>' },
  LOWEST: { label: "Niedrigste", color: "#579dff", rank: 1, svg: '<path d="M6 5l6 6 6-6M6 11l6 6 6-6"/>' },
};
/* SLA-Ziele (Kalenderstunden) je Priorität: erste Antwort / Lösung */
const SLA = { HIGHEST: [1, 4], HIGH: [4, 24], MEDIUM: [8, 72], LOW: [24, 120], LOWEST: [48, 240] };
const REQUEST_TYPES = [
  { id: "INCIDENT", name: "Störung melden", desc: "Anlage oder Kompressor ausgefallen bzw. fehlerhaft", color: "#d0352c", icon: "alert" },
  { id: "MAINT", name: "Wartung anfragen", desc: "Wartungstermin, Inspektion oder Prüfung vereinbaren", color: "#16946a", icon: "wrench" },
  { id: "SERVICE", name: "Ersatzteil / allgemeine Anfrage", desc: "Ersatzteile, Angebote, Fragen zu Anlagen", color: "#2a78d6", icon: "help" },
];
const URGENCY = [
  { id: "HIGHEST", name: "Anlage steht – Produktion betroffen" },
  { id: "HIGH", name: "Eingeschränkter Betrieb" },
  { id: "MEDIUM", name: "Normal" },
  { id: "LOW", name: "Nicht dringend" },
];
const PALETTE = ["#2a78d6", "#8f5bd6", "#16946a", "#d0352c", "#c97b00", "#0e8a9c", "#c2477e", "#5b6b8a"];
const ROLES = { ADMIN: "Administrator", MEMBER: "Mitglied", AGENT: "Service-Mitarbeiter" };


/* ---------- Datum & IDs ---------- */
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const today = () => dayKey(new Date());
const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
function hashColor(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
function fmtDur(ms) {
  const neg = ms < 0; ms = Math.abs(ms); const min = Math.round(ms / 6e4); const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  const s = d ? `${d} T ${h} h` : h ? `${h} h ${m} min` : `${m} min`; return neg ? `-${s}` : s;
}

/* ---------- Workflow & SLA ---------- */
const workflowFor = (project) => WORKFLOWS[PROJECT_TYPES[project.type].workflow];
const statusInfo = (project, statusId) => workflowFor(project).find((s) => s.id === statusId) || { id: statusId, name: statusId, cat: "todo" };

/** SLA-Stand eines Service-Vorgangs ("first" = erste Antwort, "resolve" = Lösung). */
function slaCompute(issue, project, kind, now = Date.now()) {
  if (!project || project.type !== "service" || issue.type === "SUBTASK") return null;
  const target = SLA[issue.priority][kind === "first" ? 0 : 1] * 36e5;
  const stopAt = kind === "first" ? issue.firstResponseAt : issue.resolvedAt;
  const end = stopAt ? new Date(stopAt).getTime() : now;
  let paused = 0;
  if (kind === "resolve") paused = (issue.pausedMs || 0) + (issue.pausedSince && !stopAt ? now - new Date(issue.pausedSince).getTime() : 0);
  const elapsed = end - new Date(issue.createdAt).getTime() - paused;
  const remaining = target - elapsed;
  return { target, elapsed, remaining, stopped: !!stopAt, met: stopAt ? remaining >= 0 : null, breached: remaining < 0,
    risk: !stopAt && remaining >= 0 && remaining < target * 0.25, paused: kind === "resolve" && !!issue.pausedSince && !stopAt };
}

/** Nebenwirkungen eines Statuswechsels: Erledigt-Zeitpunkt, erste Antwort, SLA-Pause. */
function applyTransition(issue, project, from, to, nowIso = new Date().toISOString()) {
  const cat = statusInfo(project, to).cat, wasCat = statusInfo(project, from).cat;
  if (cat === "done" && wasCat !== "done") issue.resolvedAt = nowIso;
  if (cat !== "done") issue.resolvedAt = null;
  if (project.type === "service") {
    if (from === "OPEN" && !issue.firstResponseAt) issue.firstResponseAt = nowIso;
    if (to === "WAITING" && !issue.pausedSince) issue.pausedSince = nowIso;
    if (from === "SCHEDULED" && to === "OPEN") issue.appointmentAt = null;
    if (from === "WAITING" && issue.pausedSince) { issue.pausedMs = (issue.pausedMs || 0) + (new Date(nowIso).getTime() - new Date(issue.pausedSince).getTime()); issue.pausedSince = null; }
  }
}

/** Erzeugt einen vollständigen, neuen Vorgang. */
function newIssue(d) {
  const project = d.project; const nowIso = new Date().toISOString();
  const i = {
    id: d.id || uid(), projectId: project.id, no: d.no, type: d.type, summary: String(d.summary || "").trim(), description: d.description || "",
    status: workflowFor(project)[0].id, priority: d.priority || "MEDIUM", assigneeId: d.assigneeId || null, reporterId: d.reporterId ?? null,
    labels: d.labels || [], dueDate: d.dueDate || null, startDate: d.startDate || null, storyPoints: d.storyPoints ?? null, estimateH: d.estimateH ?? null, loggedH: 0,
    epicId: d.epicId || null, parentId: d.parentId || null, sprintId: d.sprintId || null, links: [], watchers: [], comments: [], history: [],
    createdAt: nowIso, updatedAt: nowIso, resolvedAt: null, customer: d.customer || null, firstResponseAt: null, pausedMs: 0, pausedSince: null,
    rank: d.rank ?? Date.now(), color: d.color || null, appointmentAt: d.appointmentAt || null, resolution: null,
    teamId: d.teamId !== undefined ? d.teamId || null : project.teamId || null,
    customerId: d.customerId || null, assetId: d.assetId || null, externalId: d.externalId || null,
  };
  i.watchers = [...new Set([i.reporterId, i.assigneeId].filter(Boolean))];
  i.history.push({ id: uid(), at: nowIso, userId: i.reporterId, field: "Vorgang", from: "", to: "erstellt" });
  return i;
}

/* ---------- Änderungen als Patch (Grundlage der Synchronisierung) ----------
   Ein Patch enthält nur die geänderten Felder ("set"/"unset") sowie bei
   Listen mit Schlüssel (Kommentare, Verlauf, Verknüpfungen) nur hinzugefügte
   bzw. entfernte Einträge ("arr"). So überschreiben sich zwei Personen, die
   gleichzeitig verschiedene Felder ändern oder kommentieren, nicht gegenseitig. */
const KEYED = {
  comments: { key: (x) => x.id, sort: (a, b) => String(a.at).localeCompare(String(b.at)) },
  history: { key: (x) => x.id || `${x.at}|${x.field}|${x.to}`, sort: (a, b) => String(b.at).localeCompare(String(a.at)) },
  links: { key: (x) => `${x.type}|${x.issueId}` },
  contacts: { key: (x) => x.id },
  assets: { key: (x) => x.id },
  attachments: { key: (x) => x.id, sort: (a, b) => String(a.at).localeCompare(String(b.at)) },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function diffEntity(base, next) {
  const patch = { set: {}, unset: [], arr: {} }; let changed = false;
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(next || {})]);
  for (const k of keys) {
    if (k === "id") continue;
    const a = base ? base[k] : undefined, b = next[k];
    if (same(a, b)) continue;
    if (!(k in next)) { patch.unset.push(k); changed = true; continue; }
    if (KEYED[k] && Array.isArray(a) && Array.isArray(b)) {
      const kf = KEYED[k].key; const ma = new Map(a.map((x) => [kf(x), x])), mb = new Map(b.map((x) => [kf(x), x]));
      const add = b.filter((x) => !ma.has(kf(x)) || !same(ma.get(kf(x)), x)); const remove = [...ma.keys()].filter((key) => !mb.has(key));
      if (add.length || remove.length) { patch.arr[k] = { add, remove }; changed = true; }
      continue;
    }
    patch.set[k] = b; changed = true;
  }
  return changed ? patch : null;
}
function applyPatch(obj, patch) {
  const out = JSON.parse(JSON.stringify(obj));
  for (const [k, v] of Object.entries(patch.set || {})) out[k] = v;
  for (const k of patch.unset || []) delete out[k];
  for (const [k, op] of Object.entries(patch.arr || {})) {
    const cfg = KEYED[k]; if (!cfg) continue;
    let list = Array.isArray(out[k]) ? out[k] : [];
    const rm = new Set(op.remove || []); list = list.filter((x) => !rm.has(cfg.key(x)));
    for (const item of op.add || []) { const idx = list.findIndex((x) => cfg.key(x) === cfg.key(item)); if (idx >= 0) list[idx] = item; else list.push(item); }
    if (cfg.sort) list.sort(cfg.sort);
    out[k] = list;
  }
  return out;
}

/* ---------- Kunden, Anlagen und Wartung ---------- */
function addMonths(dk, n) {
  const [y, m, d] = String(dk).slice(0, 10).split("-").map(Number); const t = new Date(y, m - 1 + Number(n), 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return dayKey(new Date(t.getFullYear(), t.getMonth(), Math.min(d, last)));
}
/** Nächster Wartungstermin einer Anlage: fest eingetragen oder letzte Wartung + Intervall. */
const nextMaintenance = (a) => a.nextMaintenance || (a.lastMaintenance && a.intervalMonths ? addMonths(a.lastMaintenance, a.intervalMonths) : null);
/** Kontaktdaten für einen Vorgang (Momentaufnahme – bleibt erhalten, auch wenn sich der Kundenstamm ändert). */
function customerSnapshot(c, contactId) {
  const k = (c.contacts || []).find((x) => x.id === contactId) || (c.contacts || [])[0] || {};
  return { name: k.name || c.name, company: c.name, email: k.email || c.email || "", phone: k.phone || c.phone || "" };
}
const customerAddress = (c) => [c.street, [c.zip, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
/** Anlagen, für die jetzt ein Wartungsvorgang angelegt werden muss (fällig innerhalb leadDays, noch kein offener Wartungsvorgang). */
function maintenanceDue({ customers, issues, projects, today: t, leadDays = 21 }) {
  const open = new Set(issues.filter((i) => i.assetId && i.type === "MAINT" && statusInfo(projects.find((p) => p.id === i.projectId) || { type: "service" }, i.status).cat !== "done").map((i) => i.assetId));
  const out = [];
  for (const c of customers) for (const a of c.assets || []) {
    if (a.active === false || !a.intervalMonths) continue; const due = nextMaintenance(a);
    if (due && daysBetween(t, due) <= leadDays && !open.has(a.id) && a.autoCreatedFor !== due) out.push({ customer: c, asset: a, due });
  }
  return out;
}
function maintenanceIssueData(c, a, due) {
  return { type: "MAINT", summary: `Wartung ${a.name}${a.serial ? ` (SN ${a.serial})` : ""}`, priority: "MEDIUM", dueDate: due, labels: ["wartung-auto"],
    description: [`Fällige Wartung laut Wartungsplan (Intervall ${a.intervalMonths} Monate).`, `Anlage: ${[a.manufacturer, a.model].filter(Boolean).join(" ") || a.name}${a.serial ? ` · Seriennummer ${a.serial}` : ""}${a.location ? ` · Standort ${a.location}` : ""}`,
      customerAddress(c) ? `Adresse: ${customerAddress(c)}` : ""].filter(Boolean).join("\n"),
    customerId: c.id, assetId: a.id, customer: customerSnapshot(c) };
}
/** Nach erledigter Wartung: letzte Wartung setzen und nächste berechnen. Gibt den geänderten Kunden zurück (oder null). */
function completeMaintenance(c, assetId, dk) {
  const a = (c.assets || []).find((x) => x.id === assetId); if (!a) return null;
  const next = JSON.parse(JSON.stringify(c)); const b = next.assets.find((x) => x.id === assetId);
  b.lastMaintenance = dk; b.nextMaintenance = b.intervalMonths ? addMonths(dk, b.intervalMonths) : null; next.updatedAt = new Date().toISOString();
  return next;
}

function seed() {
  const now = Date.now(); const H = 36e5, D = 864e5; const t = today();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();
  const users = [
    { id: "u1", name: "Anna Müller", email: "anna.mueller@druckluft-chemnitz.de", role: "ADMIN", active: true },
    { id: "u2", name: "Thomas Weber", email: "thomas.weber@druckluft-chemnitz.de", role: "ADMIN", active: true },
    { id: "u3", name: "Lisa Schmidt", email: "lisa.schmidt@druckluft-chemnitz.de", role: "MEMBER", active: true },
    { id: "u4", name: "Jonas Neumann", email: "jonas.neumann@druckluft-chemnitz.de", role: "MEMBER", active: true },
    { id: "u5", name: "Mehmet Yilmaz", email: "mehmet.yilmaz@druckluft-chemnitz.de", role: "AGENT", active: true },
    { id: "u6", name: "Sarah Becker", email: "sarah.becker@druckluft-chemnitz.de", role: "AGENT", active: true },
  ];
  users.forEach((u) => (u.color = hashColor(u.email)));
  const projects = [
    { id: "pDIG", key: "DIG", name: "Digitalisierung", type: "software", leadId: "u2", teamId: "tDIG", color: "#2a78d6", nextNo: 1, desc: "Kundenportal und digitale Auftragsabwicklung" },
    { id: "pGF", key: "GF", name: "Geschäftsführung", type: "business", leadId: "u1", teamId: "tGF", color: "#8f5bd6", nextNo: 1, desc: "Aufgaben und Vorhaben der Geschäftsführung" },
    { id: "pSD", key: "SD", name: "Service-Desk", type: "service", leadId: "u5", teamId: "tSVC", autoMaint: true, maintLeadDays: 21, color: "#d0352c", nextNo: 1, desc: "Störungen, Wartungen und Kundenanfragen" },
  ];
  // Teams: wer gehört zusammen und stimmt sich ab (eine Person kann in mehreren Teams sein)
  const teams = [
    { id: "tGF", name: "Geschäftsführung", color: "#8f5bd6", leadId: "u2", memberIds: ["u1", "u2"], desc: "Strategie, Freigaben, Personal und Finanzen" },
    { id: "tSVC", name: "Service & Technik", color: "#d0352c", leadId: "u5", memberIds: ["u5", "u6"], desc: "Störungen, Wartungen und Einsätze beim Kunden" },
    { id: "tBUE", name: "Büro & Vertrieb", color: "#16946a", leadId: "u3", memberIds: ["u3", "u1"], desc: "Angebote, Auftragsannahme, Rechnungen und Kundenkontakt" },
    { id: "tDIG", name: "Digitalisierung", color: "#2a78d6", leadId: "u4", memberIds: ["u4", "u2", "u3"], desc: "Kundenportal, Software und IT" },
  ];
  const sprints = [
    { id: "s2", projectId: "pDIG", name: "DIG Sprint 2", goal: "Grundgerüst Portal", state: "closed", start: addDays(t, -33), end: addDays(t, -19), committed: 18, completed: 16 },
    { id: "s3", projectId: "pDIG", name: "DIG Sprint 3", goal: "Login und Anlagenübersicht", state: "closed", start: addDays(t, -19), end: addDays(t, -5), committed: 21, completed: 18 },
    { id: "s4", projectId: "pDIG", name: "DIG Sprint 4", goal: "Störungsmeldung im Portal live", state: "active", start: addDays(t, -5), end: addDays(t, 9), committed: 26, completed: null },
    { id: "s5", projectId: "pDIG", name: "DIG Sprint 5", goal: "", state: "future", start: null, end: null, committed: null, completed: null },
  ];
  const issues = []; let rank = 1;
  const add = (pid, o) => {
    const p = projects.find((x) => x.id === pid);
    const created = o.createdAgo ?? 10 * D;
    const issue = {
      id: uid(), projectId: pid, no: p.nextNo++, type: o.type, summary: o.summary, description: o.description || "",
      status: o.status, priority: o.priority || "MEDIUM", assigneeId: o.assigneeId ?? null, reporterId: "reporterId" in o ? o.reporterId : "u2",
      labels: o.labels || [], dueDate: o.dueDate || null, startDate: o.startDate || null, storyPoints: o.storyPoints ?? null,
      estimateH: o.estimateH ?? null, loggedH: o.loggedH ?? 0, epicId: o.epicId || null, parentId: o.parentId || null, sprintId: o.sprintId || null,
      links: [], watchers: [], comments: [], history: [], createdAt: iso(created), updatedAt: iso(o.updatedAgo ?? Math.min(created, 2 * D)),
      resolvedAt: o.resolvedAgo != null ? iso(o.resolvedAgo) : null, customer: o.customer || null, firstResponseAt: o.firstRespAgo != null ? iso(o.firstRespAgo) : null,
      pausedMs: 0, pausedSince: o.pausedAgo != null ? iso(o.pausedAgo) : null, rank: rank++, color: o.color || null,
      appointmentAt: o.appointmentAt || null, resolution: o.resolution || null, teamId: "teamId" in o ? o.teamId : p.teamId || null,
    };
    issue.watchers = [...new Set([issue.reporterId, issue.assigneeId].filter(Boolean))];
    (o.comments || []).forEach(([userId, text, agoMs, internal, author]) => issue.comments.push({ id: uid(), userId, author: author || null, text, at: iso(agoMs), internal: !!internal }));
    issue.history.push({ id: uid(), at: issue.createdAt, userId: issue.reporterId, field: "Vorgang", from: "", to: "erstellt" });
    issues.push(issue); return issue;
  };
  // DIG – Software/Scrum
  const e1 = add("pDIG", { type: "EPIC", summary: "Kundenportal", status: "PROGRESS", priority: "HIGH", assigneeId: "u2", startDate: addDays(t, -35), dueDate: addDays(t, 40), color: "#2a78d6", createdAgo: 40 * D, description: "Kunden melden Störungen online, sehen Anlagen, Wartungstermine und Rechnungen." });
  const e2 = add("pDIG", { type: "EPIC", summary: "Digitale Auftragsabwicklung", status: "TODO", priority: "MEDIUM", assigneeId: "u4", startDate: addDays(t, 10), dueDate: addDays(t, 85), color: "#8f5bd6", createdAgo: 30 * D });
  const e3 = add("pDIG", { type: "EPIC", summary: "Mobile App für Servicetechniker", status: "TODO", priority: "MEDIUM", assigneeId: "u3", startDate: addDays(t, 30), dueDate: addDays(t, 120), color: "#16946a", createdAgo: 20 * D });
  [["Login mit E-Mail und Passwort", 5, 30, 24], ["Anlagenübersicht je Kunde", 8, 25, 20], ["Passwort zurücksetzen", 3, 22, 18], ["Wartungstermine anzeigen", 5, 20, 8]].forEach(([s, sp, c, r]) =>
    add("pDIG", { type: "STORY", summary: s, status: "DONE", storyPoints: sp, assigneeId: "u4", epicId: e1.id, sprintId: "s3", createdAgo: c * D, resolvedAgo: r * D, reporterId: "u2" }));
  const st1 = add("pDIG", { type: "STORY", summary: "Störung über das Portal melden", status: "PROGRESS", storyPoints: 8, priority: "HIGHEST", assigneeId: "u4", epicId: e1.id, sprintId: "s4", createdAgo: 12 * D, labels: ["portal", "service"], estimateH: 24, loggedH: 14, dueDate: addDays(t, 6),
    description: "Als Kunde möchte ich eine Störung mit Anlage, Fehlercode und Foto melden, damit der Service schneller reagieren kann.\n\nAkzeptanzkriterien:\n- Anlage aus Liste wählbar\n- Dringlichkeit auswählbar\n- Bestätigung per E-Mail",
    comments: [["u2", "Bitte Fehlercode-Liste aus dem Handbuch übernehmen.", 3 * D], ["u4", "@Thomas erledigt, Liste ist im Formular hinterlegt.", 2 * D]] });
  add("pDIG", { type: "SUBTASK", summary: "Formular und Validierung", status: "DONE", parentId: st1.id, assigneeId: "u4", sprintId: "s4", createdAgo: 5 * D, resolvedAgo: 3 * D });
  add("pDIG", { type: "SUBTASK", summary: "Benachrichtigung an Service-Desk", status: "PROGRESS", parentId: st1.id, assigneeId: "u3", sprintId: "s4", createdAgo: 5 * D });
  add("pDIG", { type: "SUBTASK", summary: "Bestätigungs-E-Mail an Kunden", status: "TODO", parentId: st1.id, assigneeId: null, sprintId: "s4", createdAgo: 5 * D });
  add("pDIG", { type: "STORY", summary: "Rechnungen im Portal herunterladen", status: "TODO", storyPoints: 5, assigneeId: "u3", epicId: e1.id, sprintId: "s4", createdAgo: 9 * D, labels: ["portal"] });
  add("pDIG", { type: "STORY", summary: "Mehrere Standorte je Kunde", status: "REVIEW", storyPoints: 5, assigneeId: "u4", epicId: e1.id, sprintId: "s4", createdAgo: 9 * D });
  add("pDIG", { type: "BUG", summary: "Datum im Wartungskalender um einen Tag verschoben", status: "DONE", storyPoints: 2, priority: "HIGH", assigneeId: "u3", epicId: e1.id, sprintId: "s4", createdAgo: 4 * D, resolvedAgo: 2 * D, labels: ["kalender"] });
  add("pDIG", { type: "TASK", summary: "Hosting und Backups einrichten", status: "DONE", storyPoints: 3, assigneeId: "u2", sprintId: "s4", createdAgo: 6 * D, resolvedAgo: 4 * D });
  add("pDIG", { type: "BUG", summary: "Login schlägt bei Umlauten im Passwort fehl", status: "TODO", storyPoints: 3, priority: "HIGHEST", assigneeId: "u4", epicId: e1.id, sprintId: "s4", createdAgo: 1 * D, labels: ["login"] });
  add("pDIG", { type: "STORY", summary: "Aufträge aus E-Mail automatisch anlegen", status: "TODO", storyPoints: 8, epicId: e2.id, sprintId: "s5", createdAgo: 8 * D });
  add("pDIG", { type: "STORY", summary: "Auftragsstatus für Kunden sichtbar", status: "TODO", storyPoints: 5, epicId: e2.id, sprintId: "s5", createdAgo: 8 * D });
  add("pDIG", { type: "STORY", summary: "Offline-Modus für Techniker-App", status: "TODO", storyPoints: 13, epicId: e3.id, createdAgo: 6 * D });
  add("pDIG", { type: "TASK", summary: "Datenschutz-Folgenabschätzung Portal", status: "TODO", storyPoints: 3, priority: "HIGH", assigneeId: "u1", createdAgo: 3 * D, dueDate: addDays(t, 14) });
  add("pDIG", { type: "STORY", summary: "Unterschrift auf Servicebericht (Tablet)", status: "TODO", storyPoints: 5, epicId: e3.id, createdAgo: 2 * D });
  // GF – Business/Kanban
  const g1 = add("pGF", { type: "EPIC", summary: "Hallenumbau Halle 2", status: "PROGRESS", assigneeId: "u2", startDate: addDays(t, -20), dueDate: addDays(t, 25), color: "#c97b00", createdAgo: 25 * D });
  add("pGF", { type: "TASK", summary: "Angebot Sächsische Fahrzeugwerke finalisieren", status: "PROGRESS", priority: "HIGH", assigneeId: "u2", reporterId: "u1", dueDate: addDays(t, -2), createdAgo: 9 * D, labels: ["vertrieb"],
    comments: [["u1", "Bitte Rabatt maximal 4 % ansetzen.", 4 * D]] });
  add("pGF", { type: "TASK", summary: "Bauabnahme mit Bauleiter, Mängelprotokoll", status: "REVIEW", priority: "HIGHEST", assigneeId: "u2", epicId: g1.id, dueDate: t, createdAgo: 7 * D });
  add("pGF", { type: "TASK", summary: "Elektroinstallation Halle 2 beauftragen", status: "DONE", assigneeId: "u1", epicId: g1.id, createdAgo: 18 * D, resolvedAgo: 9 * D });
  add("pGF", { type: "TASK", summary: "Recruiting: 2 Servicetechniker", status: "PROGRESS", priority: "HIGH", assigneeId: "u1", dueDate: addDays(t, 20), createdAgo: 15 * D, labels: ["personal"] });
  add("pGF", { type: "TASK", summary: "Quartalszahlen für die Bank aufbereiten", status: "TODO", priority: "MEDIUM", assigneeId: "u1", reporterId: "u2", dueDate: addDays(t, 3), createdAgo: 4 * D, labels: ["finanzen"] });
  add("pGF", { type: "TASK", summary: "Leasingvertrag Servicefahrzeuge verlängern", status: "BLOCKED", priority: "HIGH", assigneeId: "u2", reporterId: "u1", dueDate: addDays(t, 4), createdAgo: 6 * D, labels: ["verwaltung"],
    comments: [["u2", "Warten auf Angebot der Leasinggesellschaft – zweimal nachgefragt.", 2 * D]] });
  add("pGF", { type: "TASK", summary: "Preisliste Wartungsverträge 2027 erstellen", status: "REVIEW", priority: "MEDIUM", assigneeId: "u3", reporterId: "u2", dueDate: addDays(t, 2), createdAgo: 5 * D,
    comments: [["u3", "Entwurf liegt im Teams-Ordner Vertrieb, bitte freigeben.", 4 * H]] });
  add("pGF", { type: "TASK", summary: "Schulungsplan Q1 für Servicetechniker", status: "TODO", priority: "LOW", assigneeId: "u3", reporterId: "u1", dueDate: addDays(t, 12), createdAgo: 2 * D });
  add("pGF", { type: "TASK", summary: "Website: Referenzprojekte aktualisieren", status: "TODO", priority: "MEDIUM", assigneeId: null, dueDate: addDays(t, 5), createdAgo: 3 * D, labels: ["marketing"] });
  add("pGF", { type: "TASK", summary: "Monatliches Liquiditäts-Reporting", status: "DONE", assigneeId: "u1", dueDate: addDays(t, -6), createdAgo: 12 * D, resolvedAgo: 7 * D });
  // SD – Service-Desk (typischer Ablauf: Neu → Eingeplant → In Arbeit → Erledigt → Abgeschlossen)
  const cust = (name, company, email) => ({ name, company, email, phone: "" });
  const at = (dayOffset, hh, mm = 0) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  add("pSD", { type: "INCIDENT", summary: "Schraubenkompressor zeigt Fehler E42 – Produktion steht", status: "WORKING", priority: "HIGHEST", assigneeId: "u5", reporterId: null, customer: cust("Peter Kunze", "Kunze Metallbau GmbH", "p.kunze@kunze-metallbau.de"),
    createdAgo: 5 * H, firstRespAgo: 4.6 * H, appointmentAt: at(0, 7, 30), labels: ["vor-ort"], description: "Anlage: GA 37 VSD, Halle B\nSeit heute Morgen Fehler E42, Kompressor schaltet ab.",
    comments: [[null, "Kompressor schaltet nach 2 Minuten wieder ab.", 5 * H, false, "Peter Kunze"], ["u5", "Techniker ist unterwegs, Ankunft ca. 11 Uhr.", 4.6 * H], ["u5", "Vermutlich Temperaturfühler – Ersatzteil im Fahrzeug prüfen.", 4.5 * H, true]] });
  add("pSD", { type: "INCIDENT", summary: "Druckabfall im Leitungsnetz", status: "OPEN", priority: "HIGH", assigneeId: null, reporterId: null, customer: cust("Maria Lorenz", "Lorenz Kunststofftechnik", "m.lorenz@lorenz-kt.de"), createdAgo: 3.5 * H,
    description: "Anlage/Standort: Ringleitung Halle 1\n\nNetzdruck fällt von 7,5 auf 5,8 bar, Leckage vermutet." });
  add("pSD", { type: "MAINT", summary: "Jahreswartung Schraubenkompressor GA 30", status: "OPEN", priority: "MEDIUM", assigneeId: null, reporterId: null, customer: cust("Tom Richter", "Richter Holzbau", "t.richter@richter-holz.de"), createdAgo: 20 * H,
    description: "Bitte Termin in den nächsten zwei Wochen, vormittags." });
  add("pSD", { type: "MAINT", summary: "Jährliche Wartung Kältetrockner", status: "SCHEDULED", priority: "LOW", assigneeId: "u6", reporterId: null, customer: cust("Jens Hofmann", "Hofmann Druckguss", "hofmann@druckguss-hofmann.de"), createdAgo: 2 * D, firstRespAgo: 1.8 * D, appointmentAt: at(1, 9, 0),
    comments: [["u6", "Termin bestätigt: morgen 9:00 Uhr, Techniker Sarah Becker.", 1.7 * D]] });
  add("pSD", { type: "INCIDENT", summary: "Kältetrockner Alarm Taupunkt zu hoch", status: "SCHEDULED", priority: "HIGH", assigneeId: "u5", reporterId: null, customer: cust("Maria Lorenz", "Lorenz Kunststofftechnik", "m.lorenz@lorenz-kt.de"), createdAgo: 22 * H, firstRespAgo: 20 * H, appointmentAt: at(0, 13, 30) });
  add("pSD", { type: "SERVICE", summary: "Angebot Ersatzfilter für 3 Anlagen", status: "WAITING", priority: "MEDIUM", assigneeId: "u6", reporterId: null, customer: cust("Peter Kunze", "Kunze Metallbau GmbH", "p.kunze@kunze-metallbau.de"), createdAgo: 2.5 * D, firstRespAgo: 2.4 * D, pausedAgo: 1 * D,
    comments: [["u6", "Welche Seriennummern haben die drei Anlagen? Dann erstellen wir das Angebot.", 1 * D]] });
  add("pSD", { type: "INCIDENT", summary: "Kompressor sehr laut seit Ölwechsel", status: "PARTS", priority: "HIGH", assigneeId: "u5", reporterId: null, customer: cust("Tom Richter", "Richter Holzbau", "t.richter@richter-holz.de"), createdAgo: 30 * H, firstRespAgo: 25 * H, appointmentAt: at(-1, 10, 0),
    comments: [["u5", "Lagerschaden am Motor. Ersatzlager bei Hersteller bestellt, Lieferung voraussichtlich übermorgen.", 6 * H, true]] });
  add("pSD", { type: "INCIDENT", summary: "Kondensatableiter undicht", status: "RESOLVED", priority: "MEDIUM", assigneeId: "u5", reporterId: null, customer: cust("Maria Lorenz", "Lorenz Kunststofftechnik", "m.lorenz@lorenz-kt.de"), createdAgo: 6 * D, firstRespAgo: 5.9 * D, resolvedAgo: 5 * D, appointmentAt: at(-5, 8, 0),
    resolution: { cause: "Dichtung des Kondensatableiters verschlissen", action: "Kondensatableiter getauscht, Dichtheit geprüft", parts: "1× Kondensatableiter EWD 50", hours: 1.5, at: iso(5 * D), by: "u5" } });
  add("pSD", { type: "MAINT", summary: "Druckbehälterprüfung nach BetrSichV", status: "CLOSED", priority: "MEDIUM", assigneeId: "u6", reporterId: null, customer: cust("Jens Hofmann", "Hofmann Druckguss", "hofmann@druckguss-hofmann.de"), createdAgo: 14 * D, firstRespAgo: 13.8 * D, resolvedAgo: 11 * D, appointmentAt: at(-11, 9, 0),
    resolution: { cause: "Wiederkehrende Prüfung", action: "Äußere Prüfung durchgeführt, Prüfbescheinigung ausgestellt", parts: "", hours: 2, at: iso(11 * D), by: "u6" } });
  const findI = (s) => issues.find((i) => i.summary.startsWith(s));
  const a = findI("Login schlägt"), b = findI("Störung über das Portal");
  a.links.push({ type: "blocks", issueId: b.id }); b.links.push({ type: "blocked_by", issueId: a.id });
  // Beispiele für den Team-Eingang (dem Team zugeordnet, aber noch niemandem zugewiesen)
  add("pGF", { type: "TASK", summary: "Angebot Druckluftanlage Müller Maschinenbau nachfassen", status: "TODO", priority: "HIGH", teamId: "tBUE", reporterId: "u1", createdAgo: 5 * H, dueDate: addDays(t, 2) });
  add("pGF", { type: "TASK", summary: "Ersatzteilbestand Filterelemente prüfen und nachbestellen", status: "TODO", priority: "MEDIUM", teamId: "tSVC", reporterId: "u2", createdAgo: 20 * H, dueDate: addDays(t, 4) });
  // Kundenstamm mit Ansprechpartnern und Anlagen; Vorgänge werden über die Firma verknüpft
  const c = (id, no, name, street, zip, city, phone, contacts, assets) => ({ id, no, name, street, zip, city, phone, email: contacts[0]?.email || "", notes: "", externalId: null,
    contacts: contacts.map((k, n) => ({ id: `${id}k${n + 1}`, role: n ? "" : "Hauptansprechpartner", phone: "", ...k })),
    assets: assets.map((a, n) => ({ id: `${id}a${n + 1}`, active: true, location: "", year: null, ...a })), createdAt: iso(90 * D), updatedAt: iso(5 * D) });
  const customers = [
    c("c1", "10001", "Kunze Metallbau GmbH", "Industriestraße 12", "09117", "Chemnitz", "0371 456780", [{ name: "Peter Kunze", email: "p.kunze@kunze-metallbau.de", phone: "0371 456781" }],
      [{ name: "Schraubenkompressor GA 37 VSD", manufacturer: "Atlas Copco", model: "GA 37 VSD+", serial: "API123456", year: 2019, location: "Halle 2", intervalMonths: 12, lastMaintenance: addDays(t, -300) },
       { name: "Kältetrockner FD 120", manufacturer: "Atlas Copco", model: "FD 120", serial: "FD778812", year: 2019, location: "Halle 2", intervalMonths: 12, lastMaintenance: addDays(t, -200) }]),
    c("c2", "10002", "Lorenz Kunststofftechnik", "Am Gewerbepark 3", "09221", "Neukirchen/Erzgeb.", "0371 22110", [{ name: "Maria Lorenz", email: "m.lorenz@lorenz-kt.de" }, { name: "Uwe Bergmann", email: "u.bergmann@lorenz-kt.de", role: "Instandhaltung" }],
      [{ name: "Kältetrockner Taupunkt +3 °C", manufacturer: "Kaeser", model: "TC 44", serial: "KT-44-0912", year: 2020, intervalMonths: 12, lastMaintenance: addDays(t, -380) },
       { name: "Schraubenkompressor SK 25", manufacturer: "Kaeser", model: "SK 25", serial: "SK25-55102", year: 2016, intervalMonths: 6, lastMaintenance: addDays(t, -170) }]),
    c("c3", "10003", "Richter Holzbau", "Waldweg 8", "09577", "Niederwiesa", "037206 1234", [{ name: "Tom Richter", email: "t.richter@richter-holz.de" }],
      [{ name: "Schraubenkompressor GA 30", manufacturer: "Atlas Copco", model: "GA 30", serial: "GA30-88123", year: 2014, intervalMonths: 12, lastMaintenance: addDays(t, -350) }]),
    c("c4", "10004", "Hofmann Druckguss", "Gießereistraße 1", "09125", "Chemnitz", "0371 51000", [{ name: "Jens Hofmann", email: "hofmann@druckguss-hofmann.de" }],
      [{ name: "Kältetrockner", manufacturer: "Boge", model: "DS 80", serial: "B-DS80-4411", year: 2018, intervalMonths: 12, lastMaintenance: addDays(t, -362) },
       { name: "Druckbehälter 2000 l", manufacturer: "Boge", model: "DB 2000", serial: "DB-2000-17", year: 2018, intervalMonths: 60, lastMaintenance: addDays(t, -14) }]),
    c("c5", "10005", "Müller Maschinenbau GmbH", "Zwickauer Straße 210", "09116", "Chemnitz", "0371 300400", [{ name: "Andrea Müller", email: "a.mueller@mueller-maschinenbau.de", role: "Einkauf" }], []),
  ];
  for (const i of issues) if (i.customer?.company) { const k = customers.find((x) => x.name === i.customer.company); if (k) i.customerId = k.id; }
  const asset = { "Jahreswartung Schraubenkompressor GA 30": "c3a1", "Jährliche Wartung Kältetrockner": "c4a1", "Kältetrockner Alarm Taupunkt zu hoch": "c2a1", "Schraubenkompressor zeigt Fehler E42 – Produktion steht": "c1a1", "Druckbehälterprüfung nach BetrSichV": "c4a2" };
  for (const i of issues) if (asset[i.summary]) i.assetId = asset[i.summary];
  // Abwesenheiten (normalerweise aus Factorial; hier Beispiel)
  const absences = [{ id: "ab1", userId: "u6", start: addDays(t, 8), end: addDays(t, 12), type: "Urlaub", source: "manual", note: "" }];
  return { users, teams, customers, absences, projects, sprints, issues, filters: [], notifications: [] };
}

return { TRANSITIONS, transitionsFor, TYPES, PROJECT_TYPES, WORKFLOWS, CAT_LABEL, PRIOS, SLA, REQUEST_TYPES, URGENCY, PALETTE, ROLES,
  pad, dayKey, today, parseDay, addDays, daysBetween, uid, hashColor, fmtDur,
  workflowFor, statusInfo, slaCompute, applyTransition, newIssue, KEYED, diffEntity, applyPatch, seed,
  addMonths, nextMaintenance, customerSnapshot, customerAddress, maintenanceDue, maintenanceIssueData, completeMaintenance };
})();
