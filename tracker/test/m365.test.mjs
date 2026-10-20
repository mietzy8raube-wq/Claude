// Integrationstests für Microsoft 365 (Postfach → Vorgang, Outlook-Kalender,
// Anmeldung mit Microsoft) gegen einen nachgebauten Graph-/Login-Server.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4900 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const INBOX = "service@druckluft-chemnitz.de";
let proc, dataDir, mock, MOCK;

// ---------- nachgebauter Microsoft-Server ----------
const M = { messages: [], read: new Set(), sent: [], events: new Map(), calls: [], nonce: null, email: null };
let seq = 0;
function startMock() {
  return new Promise((resolve) => {
    mock = http.createServer((req, res) => {
      let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
        const u = new URL(req.url, "http://x"); Object.defineProperty(u, "pathname", { value: decodeURIComponent(u.pathname) }); const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
        M.calls.push(`${req.method} ${u.pathname}`);
        if (u.pathname === "/tenant1/oauth2/v2.0/token") {
          const f = new URLSearchParams(body);
          if (f.get("grant_type") === "client_credentials") return json(200, { access_token: "app-token", expires_in: 3600 });
          if (f.get("grant_type") === "authorization_code") {
            if (f.get("code") !== "good-code" || !f.get("code_verifier")) return json(400, { error: "invalid_grant" });
            const claims = { aud: "client1", tid: "tenant1", nonce: M.nonce, exp: Math.floor(Date.now() / 1000) + 600, email: M.email, name: "Test" };
            return json(200, { id_token: `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`, access_token: "user" });
          }
        }
        if (u.pathname.startsWith("/api/2026-10-01/resources/")) {
          if (req.headers["x-api-key"] !== "fact-key") return json(401, { error: "bad key" });
          const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
          if (u.pathname.endsWith("/employees/employees")) {
            if (!u.searchParams.get("after_id")) return json(200, { data: [{ id: 1, full_name: "Mehmet Yilmaz", login_email: "Mehmet.Yilmaz@druckluft-chemnitz.de", active: true }, { id: 2, full_name: "Neu Monteur", email: "neu.monteur@druckluft-chemnitz.de", active: true }], meta: { has_next_page: true, end_cursor: "p2" } });
            return json(200, { data: [{ id: 3, full_name: "Ohne Mail", active: true }], meta: { has_next_page: false } });
          }
          if (u.pathname.endsWith("/timeoff/leaves")) return json(200, { data: [{ id: 10, employee_id: 1, start_on: day(3), finish_on: day(5), leave_type_name: "Urlaub", approved: true }, { id: 11, employee_id: 2, start_on: day(0), finish_on: day(0), leave_type_name: "Krankheit", approved: true }, { id: 12, employee_id: 1, start_on: day(20), finish_on: day(21), leave_type_name: "Urlaub", approved: false }], meta: { has_next_page: false } });
        }
        if (req.headers.authorization !== "Bearer app-token") return json(401, { error: "unauthorized" });
        if (req.method === "GET" && u.pathname === `/v1.0/users/${INBOX}/mailFolders/inbox/messages`) return json(200, { value: M.messages.filter((m) => !M.read.has(m.id)) });
        let m = u.pathname.match(/^\/v1\.0\/users\/([^/]+)\/messages\/([^/]+)$/);
        if (m && req.method === "PATCH") { M.read.add(decodeURIComponent(m[2])); return json(200, {}); }
        m = u.pathname.match(/^\/v1\.0\/users\/([^/]+)\/sendMail$/);
        if (m && req.method === "POST") { const b = JSON.parse(body); M.sent.push({ from: decodeURIComponent(m[1]), ...b.message, saveToSentItems: b.saveToSentItems }); return json(202); }
        m = u.pathname.match(/^\/v1\.0\/users\/([^/]+)\/events(?:\/([^/]+))?$/);
        if (m) {
          const who = decodeURIComponent(m[1]); const id = m[2] && decodeURIComponent(m[2]);
          if (req.method === "GET") { const ev = M.events.get(id); if (!ev) return json(404, {}); return json(200, { id: ev.id, start: ev.start, end: ev.end, isCancelled: false }); }
          if (req.method === "POST") { const ev = { id: `ev${++seq}`, owner: who, ...JSON.parse(body) }; M.events.set(ev.id, ev); return json(201, ev); }
          if (req.method === "PATCH") { const ev = M.events.get(id); if (!ev) return json(404, {}); Object.assign(ev, JSON.parse(body), { patched: (ev.patched || 0) + 1 }); return json(200, ev); }
          if (req.method === "DELETE") { M.events.delete(id); return json(204); }
        }
        json(404, { error: "unknown " + u.pathname });
      });
    }).listen(0, "127.0.0.1", () => { MOCK = `http://127.0.0.1:${mock.address().port}`; resolve(); });
  });
}
const msg = (id, from, name, subject, content, extra = {}) => ({ id, internetMessageId: `<${id}@mail>`, subject, from: { emailAddress: { address: from, name } }, receivedDateTime: new Date().toISOString(), body: { contentType: "text", content }, hasAttachments: false, ...extra });

before(async () => {
  await startMock();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gft-m365-"));
  proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.mjs"], { cwd: ROOT, stdio: "ignore", env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, SEED_DEMO: "1", APP_URL: BASE,
    MS_TENANT_ID: "tenant1", MS_CLIENT_ID: "client1", MS_CLIENT_SECRET: "secret1", MAIL_SENDER: "noreply@druckluft-chemnitz.de", MS_LOGIN_HOST: MOCK, MS_GRAPH_BASE: `${MOCK}/v1.0`,
    MAIL_INBOX: INBOX, MAILIN_INTERVAL_MS: "300", SSO_MICROSOFT: "1", TZ: "Europe/Berlin", FACTORIAL_API_KEY: "fact-key", CAL_PULL_INTERVAL_MS: "400", FACTORIAL_BASE_URL: MOCK, FACTORIAL_API_VERSION: "2026-10-01" } });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("Server startet nicht");
});
after(() => { proc.kill(); mock.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

class Client {
  constructor() { this.cookie = ""; }
  async req(p, { method = "GET", body } = {}) {
    const res = await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", "X-GFT": "1", cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const sc = res.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    const t = await res.text(); let data; try { data = JSON.parse(t); } catch { data = t; } return { status: res.status, data, headers: res.headers };
  }
}
const anna = new Client();
const until = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); } return fn(); };
const issues = async () => (await anna.req("/api/state")).data.issues;

test("Postfach → Vorgang: neue Mail wird Vorgang (Kunde erkannt, Zitat entfernt), Bestätigung geht raus, Antwort landet im Vorgang", async () => {
  assert.equal((await anna.req("/api/login", { method: "POST", body: { email: "anna.mueller@druckluft-chemnitz.de", password: "Passwort123!" } })).status, 200);
  M.messages.push(msg("m1", "p.kunze@kunze-metallbau.de", "Peter Kunze", "Störung Kompressor Halle 2", "Hallo,\nder Kompressor zeigt Alarm.\n\nGruß Kunze\n\n-----Ursprüngliche Nachricht-----\nVon: alt\nalter Text"));
  M.messages.push(msg("m2", "chef@neukunde.de", "Hans Neu", "Anfrage Wartungsvertrag", "Bitte um Angebot."));
  M.messages.push(msg("m3", "x@y.de", "X", "Automatische Antwort: Urlaub", "Bin weg"));
  const i1 = await until(async () => (await issues()).find((i) => i.summary === "Störung Kompressor Halle 2"));
  assert.ok(i1, "Vorgang angelegt"); assert.equal(i1.type, "INCIDENT"); assert.equal(i1.customerId, "c1"); assert.ok(i1.labels.includes("e-mail"));
  assert.ok(!i1.description.includes("alter Text"), "Zitat entfernt"); assert.match(i1.description, /zeigt Alarm/);
  const i2 = await until(async () => (await issues()).find((i) => i.summary === "Anfrage Wartungsvertrag")); assert.equal(i2.type, "SERVICE"); assert.equal(i2.customer.email, "chef@neukunde.de"); assert.equal(i2.customerId, null);
  assert.ok(!(await issues()).some((i) => i.summary.startsWith("Automatische Antwort")), "Abwesenheitsnotiz ignoriert");
  await until(() => M.read.has("m1") && M.read.has("m2") && M.read.has("m3")); assert.ok(M.read.has("m3"));
  const key = `SD-${i1.no}`;
  const conf = await until(() => M.sent.find((s) => s.subject.includes(`[${key}]`)));
  assert.ok(conf, "Bestätigung versendet"); assert.equal(conf.toRecipients[0].emailAddress.address, "p.kunze@kunze-metallbau.de");
  assert.equal(conf.replyTo[0].emailAddress.address, INBOX, "Antworten gehen ans Service-Postfach"); assert.equal(conf.saveToSentItems, true, "Kopie in Gesendete Elemente");
  assert.ok(conf.internetMessageHeaders.some((h) => h.name === "X-GFT-Issue" && h.value === key));
  assert.match(conf.body.content, /v:roundrect/, "Outlook-Schaltfläche (VML)"); assert.match(conf.body.content, /automatisch dem Vorgang/);
  // Antwort des Kunden
  M.messages.push(msg("m4", "p.kunze@kunze-metallbau.de", "Peter Kunze", `AW: [${key}] Ihre Anfrage ist eingegangen`, "Danke, Zugang über Tor 3.\n\nAm 20.10. schrieb Service:\n> zitiert"));
  const i1b = await until(async () => { const x = (await issues()).find((i) => i.id === i1.id); return x.comments.some((c) => c.text.includes("Tor 3")) && x; });
  const c = i1b.comments.find((x) => x.text.includes("Tor 3")); assert.equal(c.internal, false); assert.equal(c.userId, null); assert.ok(!c.text.includes("zitiert"));
  // dieselbe Mail nicht doppelt
  assert.equal((await issues()).filter((i) => i.summary === "Störung Kompressor Halle 2").length, 1);
});

test("Outlook-Kalender: Einplanen trägt ein, Verschieben ändert, Umplanen auf andere Person verschiebt den Termin", async () => {
  const st = await anna.req("/api/admin/integrations/settings", { method: "POST", body: { calendarSync: true, calendarMinutes: 90 } }); assert.equal(st.status, 200); assert.equal(st.data.m365.calendar, true);
  const issue = (await issues()).find((i) => i.summary === "Druckabfall im Leitungsnetz");
  const at = new Date(); at.setDate(at.getDate() + 2); at.setHours(9, 30, 0, 0);
  const sync = (set) => anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set } }] } });
  await sync({ status: "SCHEDULED", assigneeId: "u5", appointmentAt: at.toISOString() });
  const ev = await until(() => [...M.events.values()].find((e) => e.subject.includes("Druckabfall")));
  const tmail = await until(() => M.sent.find((x) => x.subject.includes("Terminbestätigung") && x.toRecipients[0].emailAddress.address === "m.lorenz@lorenz-kt.de"));
  assert.ok(tmail, "Terminbestätigung an Kunden"); const ics = Buffer.from(tmail.attachments[0].contentBytes, "base64").toString();
  assert.equal(tmail.attachments[0].name, "Servicetermin.ics"); assert.match(ics, /BEGIN:VEVENT/); assert.match(ics, new RegExp(`DTSTART:${at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`)); assert.match(ics, /LOCATION:Am Gewerbepark 3/);
  const berlin = (d, addMin = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(d.getTime() + addMin * 60e3)).replace(", ", "T") + ":00";
  assert.ok(ev, "Termin angelegt"); assert.equal(ev.owner, "mehmet.yilmaz@druckluft-chemnitz.de"); assert.equal(ev.start.dateTime, berlin(at)); assert.equal(ev.end.dateTime, berlin(at, 90)); assert.equal(ev.start.timeZone, "Europe/Berlin");
  assert.match(ev.location.displayName, /Neukirchen/); assert.match(ev.body.content, /#\/issue\/SD-/);
  // Rückweg: Techniker verschiebt den Termin in Outlook → Tracker übernimmt, Kunde bekommt neue Terminmail
  const moved1 = new Date(at.getTime() + 864e5 + 90 * 60e3); M.events.get(ev.id).start = { dateTime: moved1.toISOString().replace("Z", "").replace(/\.\d{3}$/, ".0000000"), timeZone: "UTC" };
  const upd = await until(async () => { const x = (await issues()).find((i) => i.id === issue.id); return x.appointmentAt === moved1.toISOString() && x; });
  assert.ok(upd, "in Outlook verschobener Termin übernommen"); assert.ok(upd.history.some((h) => h.by === "Outlook (Mehmet Yilmaz)" && h.field === "Termin"));
  assert.ok(await until(() => M.sent.some((x) => x.subject.includes("Neuer Termin") && x.toRecipients[0].emailAddress.address === "m.lorenz@lorenz-kt.de")), "Kunde informiert");
  await new Promise((r) => setTimeout(r, 600)); assert.ok(!M.events.get(ev.id).patched, "kein Echo zurück nach Outlook");
  const at2 = new Date(at); at2.setHours(13, 0, 0, 0); await sync({ appointmentAt: at2.toISOString() });
  await until(() => M.events.get(ev.id)?.patched >= 1); assert.equal(M.events.get(ev.id).start.dateTime, berlin(at2));
  await sync({ assigneeId: "u6" });
  const moved = await until(() => !M.events.has(ev.id) && [...M.events.values()].find((e) => e.subject.includes("Druckabfall") && e.owner === "sarah.becker@druckluft-chemnitz.de"));
  assert.ok(moved, "Termin bei Sarah, bei Mehmet entfernt");
  await sync({ status: "OPEN", appointmentAt: null });
  await until(() => ![...M.events.values()].some((e) => e.subject.includes("Druckabfall"))); assert.ok(![...M.events.values()].some((e) => e.subject.includes("Druckabfall")), "ausgeplant → Termin gelöscht");
  const log = (await anna.req("/api/admin/integrations")).data.log; assert.ok(log.some((l) => l.source === "calendar"));
});

test("Anmeldung mit Microsoft: bekannte Person wird angemeldet, unbekannte abgewiesen", async () => {
  assert.equal((await new Client().req("/api/auth/config")).data.microsoft, true);
  const start = await fetch(`${BASE}/auth/microsoft`, { redirect: "manual" }); assert.equal(start.status, 302);
  const loc = new URL(start.headers.get("location")); assert.equal(loc.origin, MOCK); assert.equal(loc.searchParams.get("client_id"), "client1"); assert.equal(loc.searchParams.get("code_challenge_method"), "S256");
  assert.equal(loc.searchParams.get("redirect_uri"), `${BASE}/auth/microsoft/callback`);
  M.nonce = loc.searchParams.get("nonce"); M.email = "Lisa.Schmidt@druckluft-chemnitz.de";
  const cb = await fetch(`${BASE}/auth/microsoft/callback?code=good-code&state=${loc.searchParams.get("state")}`, { redirect: "manual" });
  assert.equal(cb.status, 302); assert.equal(cb.headers.get("location"), "/"); const cookie = cb.headers.get("set-cookie").split(";")[0];
  const me = await fetch(`${BASE}/api/me`, { headers: { cookie } }).then((r) => r.json()); assert.equal(me.user.name, "Lisa Schmidt");
  // gleicher state nicht zweimal verwendbar
  const replay = await fetch(`${BASE}/auth/microsoft/callback?code=good-code&state=${loc.searchParams.get("state")}`, { redirect: "manual" }); assert.match(replay.headers.get("location"), /^\/login\?sso=/);
  // unbekannte Person
  const s2 = new URL((await fetch(`${BASE}/auth/microsoft`, { redirect: "manual" })).headers.get("location")); M.nonce = s2.searchParams.get("nonce"); M.email = "fremd@andere-firma.de";
  const cb2 = await fetch(`${BASE}/auth/microsoft/callback?code=good-code&state=${s2.searchParams.get("state")}`, { redirect: "manual" });
  assert.match(decodeURIComponent(cb2.headers.get("location")), /keinen Zugang/); assert.equal(cb2.headers.get("set-cookie"), null);
  // falsche Nonce
  const s3 = new URL((await fetch(`${BASE}/auth/microsoft`, { redirect: "manual" })).headers.get("location")); M.nonce = "falsch"; M.email = "lisa.schmidt@druckluft-chemnitz.de";
  const cb3 = await fetch(`${BASE}/auth/microsoft/callback?code=good-code&state=${s3.searchParams.get("state")}`, { redirect: "manual" }); assert.match(decodeURIComponent(cb3.headers.get("location")), /Nonce/);
});

test("Factorial: Mitarbeiter werden zugeordnet bzw. angelegt, Abwesenheiten übernommen und abgeglichen", async () => {
  const r = await anna.req("/api/admin/factorial/sync", { method: "POST" }); assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.employees, 3); assert.equal(r.data.created, 1); assert.deepEqual(r.data.unmatched, ["Ohne Mail"]); assert.equal(r.data.absences, 2, "abgelehnte Abwesenheit ausgelassen");
  const st = (await anna.req("/api/state")).data;
  const neu = st.users.find((u) => u.email === "neu.monteur@druckluft-chemnitz.de"); assert.ok(neu && neu.active);
  const abs = st.absences.filter((a) => a.source === "factorial"); assert.equal(abs.length, 2);
  assert.ok(abs.some((a) => a.userId === "u5" && a.type === "Urlaub")); assert.ok(abs.some((a) => a.userId === neu.id && a.type === "Krankheit"));
  // erneuter Abgleich ändert nichts; Factorial-Abwesenheiten sind für Nutzer schreibgeschützt
  const r2 = await anna.req("/api/admin/factorial/sync", { method: "POST" }); assert.equal(r2.data.changed, 0); assert.equal(r2.data.created, 0);
  const mehmet = new Client(); await mehmet.req("/api/login", { method: "POST", body: { email: "mehmet.yilmaz@druckluft-chemnitz.de", password: "Passwort123!" } });
  const a = abs.find((x) => x.userId === "u5");
  const del = await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "absences", id: a.id, op: "delete" }] } }); assert.match(del.data.results[0].error, /Factorial/);
  const own = await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "absences", id: "m1", op: "put", data: { id: "m1", userId: "u5", start: "2026-12-01", end: "2026-12-02", type: "Schulung" } }] } }); assert.ok(!own.data.results[0].error, "eigene Abwesenheit erlaubt");
  const other = await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "absences", id: "m2", op: "put", data: { id: "m2", userId: "u1", start: "2026-12-01", end: "2026-12-02", type: "Urlaub" } }] } }); assert.ok(other.data.results[0].error, "fremde nur Teamleitung/Admin");
  const status = (await anna.req("/api/admin/integrations")).data.factorial; assert.equal(status.configured, true); assert.ok(status.lastSync);
});

test("Outlook-Kalender: Kalender-Abo (ICS) mit Einsätzen, Fristen und Abwesenheiten; Löschen in Outlook meldet; Kunde als Teilnehmer", async () => {
  const mehmet = new Client(); await mehmet.req("/api/login", { method: "POST", body: { email: "mehmet.yilmaz@druckluft-chemnitz.de", password: "Passwort123!" } });
  const feed = (await mehmet.req("/api/me/calendar")).data; assert.match(feed.url, /\/cal\/[A-Za-z0-9_-]+\.ics$/); assert.match(feed.webcal, /^webcal:/);
  const ics = await fetch(feed.url).then((r) => { assert.match(r.headers.get("content-type"), /text\/calendar/); return r.text(); });
  assert.match(ics, /BEGIN:VCALENDAR/); assert.match(ics, /SUMMARY:🔧 SD-1 /, "Einsatz"); assert.match(ics, /DTSTART;VALUE=DATE:/, "ganztägig (Frist/Abwesenheit)"); assert.match(ics, /TRIGGER:-PT/);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75), "Zeilen nach RFC 5545 umbrochen");
  const team = await fetch(feed.teamUrl).then((r) => r.text()); assert.match(team, /Sarah Becker|SD-4/);
  const reset = (await mehmet.req("/api/me/calendar", { method: "POST" })).data; assert.notEqual(reset.url, feed.url); assert.equal((await fetch(feed.url)).status, 404, "alter Link ungültig");
  // Kunde als Teilnehmer
  await anna.req("/api/admin/integrations/settings", { method: "POST", body: { calendarInviteCustomer: true } });
  const ga = (await issues()).find((i) => i.summary === "Jahreswartung Schraubenkompressor GA 30");
  const at = new Date(Date.now() + 3 * 864e5); at.setUTCHours(8, 0, 0, 0); const sentBefore = M.sent.length;
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: ga.id, op: "patch", patch: { set: { status: "SCHEDULED", assigneeId: "u5", appointmentAt: at.toISOString() } } }] } });
  const ev = await until(() => [...M.events.values()].find((e) => e.subject.includes("GA 30")));
  assert.equal(ev.attendees[0].emailAddress.address, "t.richter@richter-holz.de");
  const conf = await until(() => M.sent.slice(sentBefore).find((x) => x.subject.includes("Terminbestätigung"))); assert.ok(!conf.attachments?.length, "keine doppelte .ics, wenn Einladung aktiv");
  // in Outlook gelöscht → Hinweis an Disposition
  M.events.delete(ev.id);
  const n = await until(async () => (await mehmet.req("/api/state")).data.notifications.find((x) => x.title.startsWith("Termin in Outlook gelöscht")));
  assert.ok(n, "Hinweis bei gelöschtem Termin");
});
