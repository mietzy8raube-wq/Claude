// Integrationstests: startet einen echten Server mit Beispieldaten in einem
// temporären Ordner und prüft die wichtigsten Abläufe über die HTTP-Schnittstelle.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { createHmac } from "node:crypto";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = "Passwort123!";
let proc, dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gft-test-"));
  proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.mjs"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, SEED_DEMO: "1", APP_URL: BASE, WEBHOOK_INTERVAL_MS: "300" }, stdio: "pipe" });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("Server startet nicht");
});
after(() => { proc.kill(); fs.rmSync(dataDir, { recursive: true, force: true }); });

class Client {
  constructor() { this.cookie = ""; }
  async req(p, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(BASE + p, { method, headers: { "Content-Type": "application/json", "X-GFT": "1", cookie: this.cookie, ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    const sc = res.headers.get("set-cookie"); if (sc) this.cookie = sc.split(";")[0];
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  async login(email, password = PW) { return this.req("/api/login", { method: "POST", body: { email, password } }); }
}
const anna = new Client(), lisa = new Client(), mehmet = new Client();

test("Anmeldung: falsches Passwort wird abgelehnt, richtiges angenommen", async () => {
  assert.equal((await new Client().login("anna.mueller@druckluft-chemnitz.de", "falsch")).status, 401);
  assert.equal((await anna.login("Anna.Mueller@druckluft-chemnitz.de")).status, 200);
  assert.equal((await lisa.login("lisa.schmidt@druckluft-chemnitz.de")).status, 200);
  assert.equal((await mehmet.login("mehmet.yilmaz@druckluft-chemnitz.de")).status, 200);
  assert.equal((await new Client().req("/api/state")).status, 401);
});

test("Schutz: ohne Sitzung kein Zugriff, ohne CSRF-Header keine Änderung", async () => {
  const r = await fetch(`${BASE}/`, { redirect: "manual" }); assert.equal(r.status, 302);
  const noHeader = await fetch(`${BASE}/api/sync`, { method: "POST", headers: { cookie: anna.cookie, "Content-Type": "application/json" }, body: "{}" });
  assert.equal(noHeader.status, 403);
});

test("Gleichzeitige Bearbeitung: Felder und Kommentare zweier Personen bleiben erhalten", async () => {
  const st = (await anna.req("/api/state")).data;
  const issue = st.issues.find((i) => i.summary.startsWith("Rechnungen im Portal"));
  // Anna ändert die Priorität und kommentiert, Lisa ändert gleichzeitig die Story Points und kommentiert
  const a = anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set: { priority: "HIGH" }, arr: { comments: { add: [{ id: "cA", userId: "u1", text: "Von Anna", at: new Date().toISOString(), internal: false }], remove: [] } } } }] } });
  const b = lisa.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set: { storyPoints: 8 }, arr: { comments: { add: [{ id: "cL", userId: "u3", text: "Von Lisa", at: new Date().toISOString(), internal: false }], remove: [] } } } }] } });
  await Promise.all([a, b]);
  const after = (await anna.req("/api/state")).data.issues.find((i) => i.id === issue.id);
  assert.equal(after.priority, "HIGH"); assert.equal(after.storyPoints, 8);
  assert.deepEqual(after.comments.map((c) => c.id).filter((id) => ["cA", "cL"].includes(id)).sort(), ["cA", "cL"]);
});

test("Vorgangsnummern sind auch bei gleichzeitiger Anlage eindeutig", async () => {
  const st = (await anna.req("/api/state")).data; const p = st.projects.find((x) => x.key === "GF");
  const nos = await Promise.all(Array.from({ length: 10 }, (_, k) => (k % 2 ? anna : lisa).req(`/api/projects/${p.id}/reserve`, { method: "POST" }).then((r) => r.data.no)));
  assert.equal(new Set(nos).size, 10);
  // Gleiche Nummer doppelt gesendet → Server vergibt automatisch eine freie
  const mk = (id, no) => ({ id, projectId: p.id, no, type: "TASK", summary: `Test ${id}`, status: "TODO", priority: "MEDIUM", labels: [], links: [], watchers: [], comments: [], history: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const r = await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: "dupA", op: "put", data: mk("dupA", nos[0]) }, { type: "issues", id: "dupB", op: "put", data: mk("dupB", nos[0]) }] } });
  assert.notEqual(r.data.results[0].data.no, r.data.results[1].data.no);
});

test("Rechte: Mitglieder dürfen keine Personen/Projekte verwalten und keine fremden Benachrichtigungen ändern", async () => {
  assert.equal((await lisa.req("/api/admin/users", { method: "POST", body: { name: "X", email: "x@y.de", role: "ADMIN", password: "langesPasswort1" } })).status, 403);
  const r = await lisa.req("/api/sync", { method: "POST", body: { ops: [{ type: "users", id: "u3", op: "patch", patch: { set: { role: "ADMIN" } } }, { type: "projects", id: "pGF", op: "patch", patch: { set: { name: "Gehackt" } } }] } });
  assert.ok(r.data.results.every((x) => x.error));
  const own = await lisa.req("/api/sync", { method: "POST", body: { ops: [{ type: "users", id: "u3", op: "patch", patch: { set: { name: "Lisa S." } } }] } });
  assert.equal(own.data.results[0].data.name, "Lisa S.");
  // Anna erzeugt eine Benachrichtigung für Lisa; Mehmet darf sie nicht als gelesen markieren
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "notifications", id: "nTest", op: "put", data: { id: "nTest", userId: "u3", type: "assign", title: "T", text: "", issueId: null, at: new Date().toISOString(), read: false } }] } });
  const m = await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "notifications", id: "nTest", op: "patch", patch: { set: { read: true } } }] } });
  assert.ok(m.data.results[0].error);
  const lisaState = (await lisa.req("/api/state")).data;
  assert.ok(lisaState.notifications.some((n) => n.id === "nTest"));
  assert.ok(!(await anna.req("/api/state")).data.notifications.some((n) => n.id === "nTest"), "fremde Benachrichtigungen sind unsichtbar");
});

test("Administration: Person anlegen, anmelden, deaktivieren sperrt den Zugang", async () => {
  const r = await anna.req("/api/admin/users", { method: "POST", body: { name: "Neue Kollegin", email: "neu@druckluft-chemnitz.de", role: "MEMBER", password: "StartPasswort1" } });
  assert.equal(r.status, 200);
  const neu = new Client(); assert.equal((await neu.login("neu@druckluft-chemnitz.de", "StartPasswort1")).status, 200);
  assert.equal((await neu.req("/api/me")).status, 200);
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "users", id: r.data.user.id, op: "patch", patch: { set: { active: false } } }] } });
  assert.equal((await neu.req("/api/me")).status, 401);
});

test("Zugänge: Einladung per Link, Passwort selbst festlegen, Link nur einmal, Geräte verwalten", async () => {
  const r = await anna.req("/api/admin/users", { method: "POST", body: { name: "Eva Eingeladen", email: "eva@druckluft-chemnitz.de", role: "AGENT", invite: true } });
  assert.equal(r.status, 200); assert.equal(r.data.invite.mailed, false); const t = new URL(r.data.invite.link).searchParams.get("t");
  assert.equal((await new Client().login("eva@druckluft-chemnitz.de", "irgendwas123")).status, 401, "vor Annahme kein Zugang");
  assert.equal((await lisa.req("/api/admin/users/" + r.data.user.id + "/invite", { method: "POST" })).status, 403, "nur Administration lädt ein");
  const ov = (await anna.req("/api/admin/accounts")).data.accounts; assert.equal(ov[r.data.user.id].account, false); assert.ok(ov[r.data.user.id].inviteUntil > Date.now());
  const chk = (await new Client().req(`/api/password/check?t=${t}`)).data; assert.deepEqual([chk.valid, chk.kind, chk.email], [true, "invite", "eva@druckluft-chemnitz.de"]);
  const eva = new Client();
  assert.equal((await eva.req("/api/password/set", { method: "POST", body: { token: t, password: "kurz" } })).status, 400);
  assert.equal((await eva.req("/api/password/set", { method: "POST", body: { token: t, password: "Evas langes Passwort" } })).status, 200);
  assert.equal((await eva.req("/api/me")).data.user.email, "eva@druckluft-chemnitz.de", "direkt angemeldet");
  assert.equal((await new Client().req("/api/password/set", { method: "POST", body: { token: t, password: "Noch ein Passwort" } })).status, 410, "Link nur einmal");
  assert.equal((await new Client().req(`/api/password/check?t=${t}`)).data.valid, false);
  // Zweites Gerät, Geräteübersicht, einzelnes Gerät abmelden
  const eva2 = new Client(); assert.equal((await eva2.req("/api/login", { method: "POST", body: { email: "eva@druckluft-chemnitz.de", password: "Evas langes Passwort" }, headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1" } })).status, 200);
  const list = (await eva.req("/api/me/sessions")).data.sessions; assert.equal(list.length, 2);
  const other = list.find((x) => !x.current); assert.equal(other.device, "Safari auf iPhone/iPad");
  assert.equal((await eva.req(`/api/me/sessions/${other.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await eva2.req("/api/me")).status, 401, "abgemeldetes Gerät verliert den Zugang"); assert.equal((await eva.req("/api/me")).status, 200);
  assert.ok((await anna.req("/api/admin/accounts")).data.accounts[r.data.user.id].lastLogin > 0);
  // Administration: auf allen Geräten abmelden; Link zum Zurücksetzen für bestehenden Zugang
  assert.equal((await anna.req(`/api/admin/users/${r.data.user.id}/logout`, { method: "POST" })).status, 200);
  assert.equal((await eva.req("/api/me")).status, 401);
  const reset = (await anna.req(`/api/admin/users/${r.data.user.id}/invite`, { method: "POST" })).data;
  assert.equal((await new Client().req("/api/password/set", { method: "POST", body: { token: new URL(reset.link).searchParams.get("t"), password: "Neues Passwort für Eva" } })).status, 200);
  assert.equal((await new Client().login("eva@druckluft-chemnitz.de", "Evas langes Passwort")).status, 401, "altes Passwort ungültig");
  assert.equal((await new Client().login("eva@druckluft-chemnitz.de", "Neues Passwort für Eva")).status, 200);
  // Passwort vergessen ohne E-Mail-Versand: verrät nichts, Seite ist erreichbar
  const f = await new Client().req("/api/password/forgot", { method: "POST", body: { email: "gibt-es-nicht@example.com" } }); assert.deepEqual(f.data, { ok: true, mail: false });
  assert.equal((await fetch(`${BASE}/password`)).status, 200);
});

test("Betrieb: Audit-Protokoll, Sicherung mit Anhängen, Systemstatus – nur Administration", async () => {
  await new Client().login("anna.mueller@druckluft-chemnitz.de", "falsch-falsch");
  const st = (await anna.req("/api/state")).data; const victim = st.issues.find((i) => i.summary.startsWith("Rechnungen im Portal"));
  const up = await fetch(`${BASE}/api/issues/${victim.id}/attachments`, { method: "POST", headers: { cookie: anna.cookie, "X-GFT": "1", "Content-Type": "text/plain", "X-Filename": "notiz.txt" }, body: "Hallo Sicherung" });
  assert.equal(up.status, 200);
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: victim.id, op: "delete" }] } });
  const lisaId = st.users.find((u) => u.email.startsWith("lisa")).id;
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "users", id: lisaId, op: "patch", patch: { set: { role: "AGENT" } } }] } });
  const a = (await anna.req("/api/admin/audit")).data; const acts = a.entries.map((e) => e.action);
  for (const x of ["login", "login.failed", "delete", "user.role"]) assert.ok(acts.includes(x), `Audit enthält ${x}`);
  assert.match(a.entries.find((e) => e.action === "delete").detail, /Vorgang: \w+-\d+ Rechnungen im Portal/);
  assert.match(a.entries.find((e) => e.action === "user.role").detail, /lisa.*Mitglied → Service-Mitarbeiter/);
  assert.equal((await anna.req("/api/admin/audit?action=login.failed")).data.entries.every((e) => e.action === "login.failed"), true);
  assert.equal((await lisa.req("/api/admin/audit")).status, 403); assert.equal((await lisa.req("/api/admin/system")).status, 403);
  const b = await anna.req("/api/admin/backup", { method: "POST" }); assert.equal(b.status, 200); assert.ok(b.data.copied >= 1, "Anhang gespiegelt");
  assert.ok(fs.readdirSync(path.join(dataDir, "backups", "files")).length >= 1);
  const sys = (await anna.req("/api/admin/system")).data; assert.ok(sys.backups.list.some((x) => x.name === b.data.file)); assert.equal(sys.schema, 5); assert.ok(sys.counts.issues > 0);
  const dl = await fetch(`${BASE}/api/admin/backups/${b.data.file}`, { headers: { cookie: anna.cookie } }); assert.equal(dl.status, 200);
  assert.equal(Buffer.from(await dl.arrayBuffer()).subarray(0, 15).toString(), "SQLite format 3");
  assert.equal((await fetch(`${BASE}/api/admin/backups/..%2Ftracker.db`, { headers: { cookie: anna.cookie } })).status, 404);
  assert.equal((await fetch(`${BASE}/api/admin/backups/${b.data.file}`, { headers: { cookie: lisa.cookie } })).status, 403);
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "users", id: lisaId, op: "patch", patch: { set: { role: "MEMBER" } } }] } });
});

test("Erscheinungsbild: Name, Farbe, Logo – nur Administration; SVG mit Skript abgelehnt; wirkt auf Portal und App-Manifest", async () => {
  assert.equal((await lisa.req("/api/admin/brand", { method: "POST", body: { color: "#112233" } })).status, 403);
  assert.equal((await anna.req("/api/admin/brand", { method: "POST", body: { color: "rot" } })).status, 400);
  const b = (await anna.req("/api/admin/brand", { method: "POST", body: { appName: "DLC Service", company: "Druckluft Chemnitz GmbH", color: "#1F4E8C" } })).data;
  assert.deepEqual([b.appName, b.company, b.color], ["DLC Service", "Druckluft Chemnitz GmbH", "#1f4e8c"]);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a3e1a2a20000000049454e44ae426082", "hex");
  const up = await fetch(`${BASE}/api/admin/brand/logo`, { method: "PUT", headers: { cookie: anna.cookie, "X-GFT": "1", "Content-Type": "image/png" }, body: png }); assert.equal(up.status, 200);
  const evil = await fetch(`${BASE}/api/admin/brand/logo`, { method: "PUT", headers: { cookie: anna.cookie, "X-GFT": "1", "Content-Type": "image/svg+xml" }, body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' }); assert.equal(evil.status, 415);
  const pub = await (await fetch(`${BASE}/api/brand`)).json(); assert.equal(pub.appName, "DLC Service"); assert.match(String(pub.logo), /^\/brand\/logo\?v=/, "Logo bleibt nach abgelehntem Upload erhalten");
  const logo = await fetch(BASE + pub.logo); assert.equal(logo.status, 200); assert.equal(logo.headers.get("content-type"), "image/png");
  assert.equal((await (await fetch(`${BASE}/api/portal/config`)).json()).company, "Druckluft Chemnitz GmbH");
  const mf = await (await fetch(`${BASE}/manifest.webmanifest`)).json(); assert.equal(mf.short_name, "DLC Service"); assert.equal(mf.theme_color, "#1f4e8c");
  assert.equal((await anna.req("/api/admin/brand/logo", { method: "DELETE" })).data.logo, null);
  await anna.req("/api/admin/brand", { method: "POST", body: { appName: "", company: "", color: "#2436e8" } });
});

test("Microsoft Teams: App-Paket, Anmeldung per Token ohne Cookie, Einbettung nur für Teams", async () => {
  assert.equal((await fetch(`${BASE}/api/admin/teams/package`, { headers: { cookie: lisa.cookie } })).status, 403);
  const zr = await fetch(`${BASE}/api/admin/teams/package`, { headers: { cookie: anna.cookie } }); assert.equal(zr.status, 200); assert.equal(zr.headers.get("content-type"), "application/zip");
  const zip = Buffer.from(await zr.arrayBuffer()); const files = {};
  for (let o = 0; zip.readUInt32LE(o) === 0x04034b50;) { const size = zip.readUInt32LE(o + 18), nl = zip.readUInt16LE(o + 26); files[zip.subarray(o + 30, o + 30 + nl).toString()] = zip.subarray(o + 30 + nl, o + 30 + nl + size); o += 30 + nl + size; }
  assert.deepEqual(Object.keys(files).sort(), ["color.png", "manifest.json", "outline.png"]);
  const mf = JSON.parse(files["manifest.json"]); assert.equal(mf.manifestVersion, "1.16"); assert.match(mf.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(mf.validDomains, [new URL(BASE).host]); assert.equal(mf.staticTabs.length, 3); assert.equal(mf.staticTabs[0].contentUrl, `${BASE}/teams/tab?view=your-work`);
  assert.equal(mf.configurableTabs[0].configurationUrl, `${BASE}/teams/config`);
  assert.equal(files["outline.png"].subarray(1, 4).toString(), "PNG"); assert.equal(files["outline.png"].readUInt32BE(16), 32);
  // Token-Anmeldung (wie im Anmelde-Popup) und Nutzung ohne Cookie
  assert.equal((await new Client().req("/api/teams/token", { method: "POST" })).status, 401);
  const { token } = (await anna.req("/api/teams/token", { method: "POST" })).data; assert.ok(token.length > 30);
  const me = await fetch(`${BASE}/api/me`, { headers: { "X-GFT-Token": token } }); assert.equal((await me.json()).user.email, "anna.mueller@druckluft-chemnitz.de");
  assert.equal((await fetch(`${BASE}/api/state?part=notifications&token=${token}`)).status, 401, "Token in der Adresse nur für Bilder/Downloads/Live-Updates");
  assert.equal((await fetch(`${BASE}/api/sync`, { method: "POST", headers: { "X-GFT-Token": token, "Content-Type": "application/json" }, body: "{}" })).status, 403, "CSRF-Kopf weiterhin nötig");
  assert.ok((await anna.req("/api/me/sessions")).data.sessions.some((x) => x.device === "Microsoft Teams"));
  // Einbettung: Teams-Seiten dürfen in Teams, die normale App nirgends
  const tab = await fetch(`${BASE}/teams/tab?view=dashboard`); assert.equal(tab.status, 200); assert.equal(tab.headers.get("x-frame-options"), null); assert.match(tab.headers.get("content-security-policy"), /frame-ancestors 'self' https:\/\/teams\.microsoft\.com/);
  assert.equal((await fetch(`${BASE}/teams/app`)).status, 200);
  assert.equal((await fetch(`${BASE}/`, { headers: { cookie: anna.cookie } })).headers.get("x-frame-options"), "DENY");
  const start = await fetch(`${BASE}/teams/auth-start`, { redirect: "manual" }); assert.equal(start.headers.get("location"), "/login?next=%2Fteams%2Fauth-end");
  assert.equal((await fetch(`${BASE}/vendor/MicrosoftTeams.min.js`)).status, 200);
  const out = await fetch(`${BASE}/api/logout`, { method: "POST", headers: { "X-GFT-Token": token, "X-GFT": "1" } }); assert.equal(out.status, 200);
  assert.equal((await fetch(`${BASE}/api/me`, { headers: { "X-GFT-Token": token } })).status, 401, "Abmelden beendet die Teams-Sitzung");
});

test("Kundenportal: Anfrage stellen, verfolgen, antworten – interne Notizen bleiben verborgen", async () => {
  const pub = new Client();
  const bad = await pub.req("/api/portal/requests", { method: "POST", body: { projectKey: "SD", type: "INCIDENT", name: "A", company: "B", email: "kein-mail", summary: "x", description: "y" } });
  assert.equal(bad.status, 400);
  const r = await pub.req("/api/portal/requests", { method: "POST", body: { projectKey: "SD", type: "INCIDENT", name: "Klaus Berger", company: "Berger GmbH", email: "k@berger.de", summary: "Kompressor startet nicht", description: "Keine Reaktion", urgency: "HIGHEST" } });
  assert.equal(r.status, 200); assert.match(r.data.key, /^SD-\d+$/);
  const st = (await mehmet.req("/api/state")).data;
  const issue = st.issues.find((i) => i.summary === "Kompressor startet nicht");
  assert.equal(issue.priority, "HIGHEST"); assert.equal(issue.customer.email, "k@berger.de");
  assert.ok(st.notifications.some((n) => n.issueId === issue.id && n.type === "new"), "Service-Mitarbeiter wird benachrichtigt");
  await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set: { status: "WAITING" }, arr: { comments: { add: [
    { id: "pub1", userId: "u5", text: "Welcher Fehlercode?", at: new Date().toISOString(), internal: false },
    { id: "int1", userId: "u5", text: "Kunde ist schwierig", at: new Date(Date.now() + 1).toISOString(), internal: true }], remove: [] } } } }] } });
  const view = (await pub.req(`/api/portal/requests/${r.data.token}`)).data;
  assert.ok(view.comments.some((c) => c.text === "Welcher Fehlercode?"));
  assert.ok(!view.comments.some((c) => c.text.includes("schwierig")), "interne Notiz darf nicht sichtbar sein");
  const rep = await pub.req(`/api/portal/requests/${r.data.token}/comments`, { method: "POST", body: { text: "Fehler E07" } });
  assert.equal(rep.status, 200); assert.equal(rep.data.status, "In Arbeit");
  assert.equal((await pub.req("/api/portal/requests/ungueltigertokenungueltigertoken")).status, 404);
});

test("Service-Ablauf: Termin und Servicebericht erscheinen beim Kunden im Portal", async () => {
  const pub = new Client();
  const r = await pub.req("/api/portal/requests", { method: "POST", body: { projectKey: "SD", type: "MAINT", name: "Eva Test", company: "Test AG", email: "eva@test.de", summary: "Wartung Kompressor", description: "Bitte Termin", urgency: "MEDIUM" } });
  const issue = (await mehmet.req("/api/state")).data.issues.find((i) => i.summary === "Wartung Kompressor");
  const appt = new Date(Date.now() + 2 * 864e5).toISOString();
  await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set: { status: "SCHEDULED", assigneeId: "u5", appointmentAt: appt } } }] } });
  let v = (await pub.req(`/api/portal/requests/${r.data.token}`)).data;
  assert.equal(v.status, "Eingeplant"); assert.equal(v.appointmentAt, appt); assert.equal(v.technician, "Mehmet Yilmaz"); assert.equal(v.report, null);
  const res = { cause: "Filter verschmutzt", action: "Filter gewechselt", parts: "1× Luftfilter", hours: 1.5, at: new Date().toISOString(), by: "u5" };
  await mehmet.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set: { status: "RESOLVED", resolution: res, resolvedAt: new Date().toISOString() } } }] } });
  v = (await pub.req(`/api/portal/requests/${r.data.token}`)).data;
  assert.equal(v.statusCat, "done"); assert.equal(v.report.action, "Filter gewechselt"); assert.equal(v.appointmentAt, null);
});

test("Teams: Admin verwaltet, Teamleitung ändert nur Mitglieder; Kundenanfragen landen im Team-Eingang", async () => {
  const st = (await anna.req("/api/state")).data;
  assert.ok(st.teams.length >= 4);
  const bue = st.teams.find((t) => t.id === "tBUE"); assert.equal(bue.leadId, "u3");
  const sync = (c, op) => c.req("/api/sync", { method: "POST", body: { ops: [op] } }).then((r) => r.data.results[0]);
  assert.ok((await sync(lisa, { type: "teams", id: "tNEU", op: "put", data: { id: "tNEU", name: "Neu", memberIds: [] } })).error, "Mitglied darf kein Team anlegen");
  assert.ok(!(await sync(lisa, { type: "teams", id: "tBUE", op: "patch", patch: { set: { memberIds: ["u3", "u1", "u4"] } } })).error, "Teamleitung darf Mitglieder ändern");
  assert.ok((await sync(lisa, { type: "teams", id: "tBUE", op: "patch", patch: { set: { name: "Umbenannt" } } })).error, "Teamleitung darf nicht umbenennen");
  assert.ok((await sync(lisa, { type: "teams", id: "tSVC", op: "patch", patch: { set: { memberIds: ["u3"] } } })).error, "fremdes Team gesperrt");
  const made = await sync(anna, { type: "teams", id: "tLAGER", op: "put", data: { id: "tLAGER", name: " Lager ", leadId: "u4", memberIds: ["u6"] } });
  assert.equal(made.data.name, "Lager"); assert.deepEqual(made.data.memberIds, ["u4", "u6"], "Leitung wird automatisch Mitglied");
  const r = await new Client().req("/api/portal/requests", { method: "POST", body: { projectKey: "SD", type: "SERVICE", name: "Team Test", company: "Test GmbH", email: "team@test.de", summary: "Teamzuordnung", description: "x" } });
  const issue = (await anna.req("/api/state")).data.issues.find((i) => i.summary === "Teamzuordnung");
  assert.equal(r.status, 200); assert.equal(issue.teamId, "tSVC");
});

test("Kunden & Wartung: fällige Wartungen werden angelegt, Erledigung schreibt den Wartungsplan fort, Portal ordnet Kunden zu", async () => {
  const st = (await anna.req("/api/state")).data;
  assert.equal(st.customers.length, 5);
  const auto = st.issues.filter((i) => i.labels.includes("wartung-auto"));
  assert.ok(auto.length >= 1, "automatischer Wartungsvorgang");
  const m = auto[0]; assert.equal(m.type, "MAINT"); assert.ok(m.customerId && m.assetId);
  const now = new Date().toISOString();
  const r = await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: m.id, op: "patch", patch: { set: { status: "RESOLVED", resolvedAt: now } } }] } });
  assert.ok(!r.data.results[0].error);
  const c = (await anna.req("/api/state")).data.customers.find((x) => x.id === m.customerId); const a = c.assets.find((x) => x.id === m.assetId);
  assert.equal(a.lastMaintenance, now.slice(0, 10)); assert.ok(a.nextMaintenance > a.lastMaintenance);
  await new Client().req("/api/portal/requests", { method: "POST", body: { projectKey: "SD", type: "INCIDENT", name: "Peter Kunze", company: "Kunze", email: "P.Kunze@kunze-metallbau.de", summary: "Kundenzuordnung", description: "x" } });
  assert.equal((await anna.req("/api/state")).data.issues.find((i) => i.summary === "Kundenzuordnung").customerId, "c1");
});

test("REST-API v1 und Webhooks: Schlüssel, Rechte, Anlegen/Ändern/Kommentieren, Kunden-Abgleich, signierte Zustellung", async () => {
  // Empfänger für Webhooks
  const got = []; const recv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { got.push({ headers: req.headers, body: b }); res.end("ok"); }); });
  await new Promise((r) => recv.listen(0, "127.0.0.1", r)); const hookUrl = `http://127.0.0.1:${recv.address().port}/hook`;
  try {
    assert.equal((await lisa.req("/api/admin/api-keys", { method: "POST", body: { name: "X", scope: "write" } })).status, 403, "nur Admin");
    const wk = (await anna.req("/api/admin/api-keys", { method: "POST", body: { name: "ERP", scope: "write" } })).data; assert.match(wk.token, /^gft_/);
    const rk = (await anna.req("/api/admin/api-keys", { method: "POST", body: { name: "BI", scope: "read" } })).data;
    const hook = (await anna.req("/api/admin/webhooks", { method: "POST", body: { name: "ERP-Hook", url: hookUrl, events: ["issue.created", "issue.status_changed", "issue.resolved", "comment.created", "customer.updated"] } })).data;
    const teams = (await anna.req("/api/admin/webhooks", { method: "POST", body: { name: "Teams", url: hookUrl + "/teams", format: "teams", events: ["issue.created"] } })).data;
    const api = (token, p, opt = {}) => fetch(BASE + p, { method: opt.method || "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json() }));
    assert.equal((await api("gft_falsch_falsch_falsch_falsch", "/api/v1/issues")).status, 401);
    assert.equal((await api(rk.token, "/api/v1/issues", { method: "POST", body: { project: "SD", summary: "x" } })).status, 403, "Leseschlüssel darf nicht schreiben");
    // Kunde aus dem ERP anlegen und erneut abgleichen (keine Dublette)
    const c1 = await api(wk.token, "/api/v1/customers/30001", { method: "PUT", body: { name: "ERP Kunde GmbH", city: "Zwickau", contacts: [{ name: "Eva Erp", email: "eva@erp-kunde.de" }], assets: [{ name: "Kompressor", serial: "SN-1", intervalMonths: 12, lastMaintenance: "2026-02-01" }] } });
    assert.equal(c1.status, 201); assert.equal(c1.data.customer.no, "30001"); assert.equal(c1.data.customer.assets[0].nextMaintenance, "2027-02-01");
    const c2 = await api(wk.token, "/api/v1/customers/30001", { method: "PUT", body: { phone: "0375 1", assets: [{ name: "Kompressor", serial: "SN-1", model: "GA 11" }] } });
    assert.equal(c2.status, 200); assert.equal(c2.data.customer.assets.length, 1); assert.equal(c2.data.customer.assets[0].model, "GA 11"); assert.equal(c2.data.customer.phone, "0375 1");
    // Vorgang anlegen – idempotent über externalId
    const body = { project: "SD", type: "INCIDENT", summary: "Störung aus ERP", priority: "HIGH", customer: "30001", assetSerial: "SN-1", externalId: "ERP-77", team: "Service & Technik", dueDate: "2026-12-01" };
    const i1 = await api(wk.token, "/api/v1/issues", { method: "POST", body }); assert.equal(i1.status, 201); assert.match(i1.data.issue.key, /^SD-\d+$/);
    assert.equal(i1.data.issue.customer.no, "30001"); assert.equal(i1.data.issue.asset.serial, "SN-1"); assert.equal(i1.data.issue.team, "Service & Technik"); assert.equal(i1.data.issue.contact.email, "eva@erp-kunde.de");
    const i2 = await api(wk.token, "/api/v1/issues", { method: "POST", body }); assert.equal(i2.status, 200); assert.equal(i2.data.created, false); assert.equal(i2.data.issue.key, i1.data.issue.key);
    const key = i1.data.issue.key;
    assert.equal((await api(wk.token, `/api/v1/issues/${key}`, { method: "PATCH", body: { status: "UNSINN" } })).status, 400);
    const pt = await api(wk.token, `/api/v1/issues/${key}`, { method: "PATCH", body: { status: "Erledigt", assignee: "mehmet.yilmaz@druckluft-chemnitz.de" } });
    assert.equal(pt.status, 200); assert.equal(pt.data.statusName, "Erledigt"); assert.equal(pt.data.assignee.name, "Mehmet Yilmaz"); assert.ok(pt.data.resolvedAt);
    assert.equal((await api(wk.token, `/api/v1/issues/ERP-77/comments`, { method: "POST", body: { text: "Rechnung 4711 erstellt" } })).status, 201);
    const ls = await api(rk.token, "/api/v1/issues?customer=30001&statusCategory=done"); assert.equal(ls.data.total, 1);
    const one = await api(rk.token, `/api/v1/issues/${key}`); assert.ok(one.data.labels !== undefined);
    // Verlauf im Vorgang zeigt den Schlüssel als Urheber
    const st = (await anna.req("/api/state")).data.issues.find((i) => i.externalId === "ERP-77"); assert.ok(st.history.some((h) => h.by === "API: ERP" && h.field === "Status"));
    // Zustellung abwarten
    for (let n = 0; n < 40 && got.filter((g) => !g.headers["x-gft-event"]?.startsWith("test")).length < 6; n++) await new Promise((r) => setTimeout(r, 150));
    const erp = got.filter((g) => g.headers["x-gft-delivery"] && !g.body.includes("AdaptiveCard"));
    const events = erp.map((g) => g.headers["x-gft-event"]);
    for (const e of ["customer.updated", "issue.created", "issue.resolved", "comment.created"]) assert.ok(events.includes(e), `Ereignis ${e} zugestellt (erhalten: ${events.join(",")})`);
    const sample = erp.find((g) => g.headers["x-gft-event"] === "issue.created");
    assert.equal(sample.headers["x-gft-signature"], "sha256=" + createHmac("sha256", hook.secret).update(sample.body).digest("hex"), "Signatur stimmt");
    assert.equal(JSON.parse(sample.body).issue.externalId, "ERP-77");
    const card = got.find((g) => g.body.includes("AdaptiveCard")); assert.ok(card, "Teams-Karte zugestellt"); assert.match(JSON.parse(card.body).attachments[0].content.body[0].text, /Vorgang angelegt/);
    // Widerruf
    await anna.req(`/api/admin/api-keys/${rk.id}`, { method: "DELETE" }); assert.equal((await api(rk.token, "/api/v1/issues")).status, 401);
    const status = (await anna.req("/api/admin/integrations")).data; assert.ok(status.webhooks.length >= 2 && status.apiKeys.length >= 2 && !status.webhooks[0].secret.includes(hook.secret.slice(10)));
    void teams;
  } finally { recv.close(); }
});

test("Anhänge: hochladen, sicher ausliefern, Rechte beim Löschen, Portal-Upload nur für den eigenen Vorgang", async () => {
  const st = (await anna.req("/api/state")).data; const issue = st.issues.find((i) => i.summary === "Druckabfall im Leitungsnetz");
  const up = (c, name, type, body, issueId = issue.id) => fetch(`${BASE}/api/issues/${issueId}/attachments`, { method: "POST", headers: { cookie: c.cookie, "X-GFT": "1", "Content-Type": type, "X-Filename": encodeURIComponent(name) }, body }).then(async (r) => ({ status: r.status, data: await r.json() }));
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5d90000000049454e44ae426082", "hex");
  const a1 = await up(anna, "Fehlercode E42.png", "image/png", png); assert.equal(a1.status, 200); assert.equal(a1.data.name, "Fehlercode E42.png");
  assert.equal((await up(anna, "virus.exe", "application/octet-stream", Buffer.from("MZ"))).status, 415, "ausführbare Dateien gesperrt");
  const html = await up(lisa, "seite.html", "text/html", Buffer.from("<script>alert(1)</script>")); assert.equal(html.status, 200);
  const dl = await fetch(`${BASE}/api/files/${html.data.id}?inline=1`, { headers: { cookie: anna.cookie } });
  assert.equal(dl.headers.get("content-type"), "application/octet-stream", "HTML nie als Seite ausliefern"); assert.match(dl.headers.get("content-disposition"), /^attachment/); assert.match(dl.headers.get("content-security-policy"), /sandbox/);
  const img = await fetch(`${BASE}/api/files/${a1.data.id}?inline=1`, { headers: { cookie: anna.cookie } }); assert.equal(img.headers.get("content-type"), "image/png"); assert.equal(Buffer.from(await img.arrayBuffer()).length, png.length);
  assert.equal((await fetch(`${BASE}/api/files/${a1.data.id}`)).status, 401, "nur angemeldet");
  const del = await fetch(`${BASE}/api/issues/${issue.id}/attachments/${a1.data.id}`, { method: "DELETE", headers: { cookie: lisa.cookie, "X-GFT": "1" } }); assert.equal(del.status, 403, "fremde Datei nicht löschbar");
  const after = (await anna.req("/api/state")).data.issues.find((i) => i.id === issue.id); assert.equal(after.attachments.length, 2); assert.ok(after.history.some((h) => h.field === "Anhang" && h.to === "Fehlercode E42.png"));
  // Portal: Kunde lädt Foto zu seinem Vorgang hoch
  const r = await new Client().req("/api/portal/requests", { method: "POST", body: { projectKey: "SD", type: "INCIDENT", name: "Foto Kunde", company: "F GmbH", email: "foto@kunde.de", summary: "Mit Foto", description: "x" } });
  const pu = await fetch(`${BASE}/api/portal/requests/${r.data.token}/attachments`, { method: "POST", headers: { "Content-Type": "image/png", "X-Filename": "display.png", "X-GFT": "1" }, body: png }); assert.equal(pu.status, 200);
  assert.equal((await fetch(`${BASE}/api/portal/requests/${r.data.token}/attachments`, { method: "POST", headers: { "Content-Type": "text/html", "X-GFT": "1" }, body: "x" })).status, 415);
  const view = (await new Client().req(`/api/portal/requests/${r.data.token}`)).data; assert.equal(view.attachments.length, 1);
  assert.equal((await fetch(`${BASE}/api/portal/requests/${r.data.token}/files/${view.attachments[0].id}`)).status, 200);
  assert.equal((await fetch(`${BASE}/api/portal/requests/${r.data.token}/files/${a1.data.id}`)).status, 404, "fremde/interne Dateien nicht über das Portal");
});

test("Outlook-Add-in: persönlicher Schlüssel handelt im Namen der Person, Absender-Suche, Anhang per API, Manifest", async () => {
  const k1 = (await lisa.req("/api/me/outlook", { method: "POST" })).data; assert.match(k1.token, /^gft_/);
  const k2 = (await lisa.req("/api/me/outlook", { method: "POST" })).data;
  const api = (t, p, o = {}) => fetch(BASE + p, { method: o.method || "GET", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: o.body ? JSON.stringify(o.body) : undefined }).then(async (r) => ({ status: r.status, data: await r.json() }));
  assert.equal((await api(k1.token, "/api/v1/me")).status, 401, "alter Schlüssel ersetzt");
  const me = await api(k2.token, "/api/v1/me"); assert.equal(me.data.user.email, "lisa.schmidt@druckluft-chemnitz.de");
  const lk = await api(k2.token, "/api/v1/lookup?email=P.Kunze@kunze-metallbau.de"); assert.equal(lk.data.customer.no, "10001"); assert.ok(lk.data.openIssues.length >= 1);
  const r = await api(k2.token, "/api/v1/issues", { method: "POST", body: { project: "SD", summary: "Aus Outlook", customer: "10001", contact: { name: "Peter Kunze", email: "p.kunze@kunze-metallbau.de" }, externalId: "mail:<x@y>", labels: ["outlook"] } });
  assert.equal(r.status, 201); assert.equal(r.data.issue.reporter.email, "lisa.schmidt@druckluft-chemnitz.de");
  const att = await api(k2.token, `/api/v1/issues/${r.data.issue.key}/attachments`, { method: "POST", body: { name: "foto.png", contentType: "image/png", contentBase64: Buffer.from("abc").toString("base64"), source: "email" } }); assert.equal(att.status, 201);
  const i = (await anna.req("/api/state")).data.issues.find((x) => x.externalId === "mail:<x@y>"); assert.equal(i.reporterId, "u3"); assert.equal(i.attachments[0].source, "email"); assert.equal(i.history.at(-1).userId, "u3");
  assert.equal((await anna.req("/api/admin/integrations")).data.apiKeys.filter((k) => k.name === "Outlook-Add-in").length, 0, "persönliche Schlüssel nicht in der Admin-Liste");
  const man = await fetch(`${BASE}/outlook/manifest.xml`).then((x) => x.text()); assert.match(man, /<OfficeApp/); assert.match(man, new RegExp(`${BASE}/outlook/taskpane.html`));
  const tp = await fetch(`${BASE}/outlook/taskpane.html`); assert.equal(tp.headers.get("x-frame-options"), null); assert.match(tp.headers.get("content-security-policy"), /frame-ancestors[^;]*outlook\.office\.com/);
});

test("Workflow-Automatik: Zuweisung reihum (Abwesende übersprungen), Eskalation und Wiedervorlage greifen je einmal", async () => {
  const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const mk = (id, extra = {}) => ({ id, projectId: "pSD", no: 0, type: "INCIDENT", summary: `Auto ${id}`, status: "OPEN", priority: "MEDIUM", teamId: "tSVC", labels: [], links: [], watchers: [], comments: [], history: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...extra });
  const put = (o) => anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: o.id, op: "put", data: o }] } });
  const get = async (id) => (await anna.req("/api/state")).data.issues.find((i) => i.id === id);
  assert.equal((await lisa.req("/api/admin/automation")).status, 403);
  const rules = [
    { id: "rA", kind: "assign", name: "Service reihum", projectId: "pSD", method: "round", types: ["INCIDENT"] },
    { id: "rE", kind: "escalate", name: "Unzugewiesen eskalieren", projectId: "pSD", trigger: "unassigned", hours: 1, raise: true, label: true, notifyLead: true },
    { id: "rW", kind: "remind", name: "Kunde nachfassen", projectId: "pSD", status: "WAITING", days: 3, comment: "Bitte beim Kunden nachfragen." },
  ];
  const saved = await anna.req("/api/admin/automation", { method: "PUT", body: { rules } }); assert.equal(saved.status, 200); assert.equal(saved.data.rules.length, 3);
  assert.equal((await anna.req("/api/admin/automation", { method: "PUT", body: { rules: [{ id: "x", kind: "assign", name: "ohne Projekt" }] } })).status, 400);
  // Reihum: zwei neue Störungen gehen an verschiedene Mitglieder von Service & Technik
  await put(mk("auto1")); await put(mk("auto2"));
  const a1 = await get("auto1"), a2 = await get("auto2");
  assert.ok(["u5", "u6"].includes(a1.assigneeId) && ["u5", "u6"].includes(a2.assigneeId)); assert.notEqual(a1.assigneeId, a2.assigneeId);
  assert.match(a1.history[0].by, /Automatik: Service reihum/);
  assert.equal((await put(mk("auto3", { type: "SERVICE" }))).status, 200); assert.equal((await get("auto3")).assigneeId ?? null, null, "anderer Typ: keine Regel");
  // Abwesend heute → wird übersprungen
  const today = new Date().toISOString().slice(0, 10);
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "absences", id: "abAuto", op: "put", data: { id: "abAuto", userId: "u6", start: today, end: today, type: "Krankheit", source: "manual", note: "" } }] } });
  await put(mk("auto4")); await put(mk("auto5"));
  assert.equal((await get("auto4")).assigneeId, "u5"); assert.equal((await get("auto5")).assigneeId, "u5");
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "absences", id: "abAuto", op: "delete" }] } });
  // Eskalation: seit 2 Stunden niemand zugewiesen (Typ ohne Zuweisungsregel)
  await put(mk("auto6", { type: "SERVICE", createdAt: new Date(Date.now() - 2 * 36e5).toISOString() }));
  // Wiedervorlage: seit 5 Tagen „Wartet auf Kunde“
  await put(mk("auto7", { type: "SERVICE", assigneeId: "u6", status: "WAITING", createdAt: ago(10), history: [{ id: "h1", at: ago(5), userId: "u6", field: "Status", from: "In Arbeit", to: "Wartet auf Kunde" }] }));
  const run = await anna.req("/api/admin/automation", { method: "PUT", body: { rules, runNow: true } }); assert.equal(run.status, 200);
  const e = await get("auto6"); assert.equal(e.priority, "HIGH"); assert.ok(e.labels.includes("eskaliert"));
  const w = await get("auto7"); assert.ok(w.comments.some((c) => c.author === "Automatik" && c.internal)); assert.equal(w.history[0].field, "Erinnerung");
  assert.ok(run.data.recent.some((x) => x.issue_id === "auto6" && /eskaliert/.test(x.action)));
  await anna.req("/api/admin/automation", { method: "PUT", body: { rules, runNow: true } });
  assert.equal((await get("auto6")).priority, "HIGH", "nur einmal eskaliert"); assert.equal((await get("auto7")).comments.filter((c) => c.author === "Automatik").length, 1);
  const mehmet2 = new Client(); await mehmet2.login("mehmet.yilmaz@druckluft-chemnitz.de"); // Projektleitung Service
  assert.ok((await mehmet2.req("/api/state")).data.notifications.some((n) => n.title.startsWith("Eskaliert:") && n.issueId === "auto6"));
  await anna.req("/api/admin/automation", { method: "PUT", body: { rules: [] } });
});

test("Live-Aktualisierung: Änderungen lösen ein Event aus und sind über /api/changes abrufbar", async () => {
  const st = (await lisa.req("/api/state")).data;
  const ctrl = new AbortController();
  const res = await fetch(`${BASE}/api/events`, { headers: { cookie: lisa.cookie }, signal: ctrl.signal });
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  const gotRev = (async () => { while (true) { const { value } = await reader.read(); buf += dec.decode(value); const revs = [...buf.matchAll(/data: (\d+)/g)].map((m) => Number(m[1])); if (revs.some((r) => r > st.rev)) return true; } })();
  const issue = st.issues.find((i) => i.projectId === "pGF");
  await anna.req("/api/sync", { method: "POST", body: { ops: [{ type: "issues", id: issue.id, op: "patch", patch: { set: { summary: "Live geändert" } } }] } });
  assert.equal(await Promise.race([gotRev, new Promise((r) => setTimeout(() => r(false), 3000))]), true);
  ctrl.abort();
  const ch = (await lisa.req(`/api/changes?since=${st.rev}`)).data;
  assert.ok(ch.changes.some((c) => c.id === issue.id && c.data.summary === "Live geändert"));
});

test("Fristen-Job: überfällige Vorgänge erzeugen Benachrichtigungen genau einmal", async () => {
  const st = (await anna.req("/api/state")).data;
  const overdue = st.notifications.filter((n) => n.type === "overdue");
  assert.ok(overdue.length >= 1);
  assert.equal(new Set(overdue.map((n) => n.key)).size, overdue.length);
});

test("Sicherung: Export und Import", async () => {
  const ex = await anna.req("/api/admin/export"); assert.equal(ex.status, 200); assert.ok(ex.data.issues.length > 10);
  assert.ok(!JSON.stringify(ex.data).includes("scrypt$"), "keine Passwort-Hashes im Export");
  const im = await anna.req("/api/admin/import", { method: "POST", body: ex.data }); assert.equal(im.status, 200);
  assert.equal((await anna.req("/api/state")).data.issues.length, ex.data.issues.length);
});
