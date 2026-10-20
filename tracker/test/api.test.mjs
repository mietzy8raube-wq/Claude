// Integrationstests: startet einen echten Server mit Beispieldaten in einem
// temporären Ordner und prüft die wichtigsten Abläufe über die HTTP-Schnittstelle.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = "Passwort123!";
let proc, dataDir;

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "gft-test-"));
  proc = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.mjs"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", DATA_DIR: dataDir, SEED_DEMO: "1", APP_URL: BASE }, stdio: "pipe" });
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
