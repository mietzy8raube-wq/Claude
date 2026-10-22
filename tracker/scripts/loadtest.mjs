#!/usr/bin/env node
// Lasttest für den GF Tracker.
//   1) Testdaten erzeugen:  node scripts/loadtest.mjs generate ./data-load --issues 20000 --users 50 --customers 2000
//   2) Server starten:      DATA_DIR=./data-load PORT=4500 node server.mjs
//   3) Last erzeugen:       node scripts/loadtest.mjs run http://localhost:4500 --users 50 --seconds 30
// Alle Testpersonen haben das Passwort "Passwort123!". Nie gegen die Produktivdatenbank laufen lassen.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2); const cmd = args[0];
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d; };
const PW = "Passwort123!";

if (cmd === "generate") await generate(args[1]);
else if (cmd === "run") await run(args[1]);
else { console.log("Aufruf: loadtest.mjs generate <datenordner> [--issues N --users N --customers N] | run <url> [--users N --seconds N]"); process.exit(1); }

async function generate(dir) {
  if (!dir) throw new Error("Datenordner angeben");
  if (fs.existsSync(path.join(dir, "tracker.db"))) throw new Error(`${dir} enthält bereits eine Datenbank – bitte leeren Ordner angeben.`);
  fs.mkdirSync(dir, { recursive: true });
  const { Store, COLLECTIONS } = await import(path.join(ROOT, "lib/store.mjs"));
  const { hashPassword } = await import(path.join(ROOT, "lib/auth.mjs"));
  const sb = {}; vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(ROOT, "public/shared.js"), "utf8"), sb); const S = sb.TrackerShared;
  const N = opt("issues", 20000), U = opt("users", 50), C = opt("customers", 2000);
  const store = new Store(path.join(dir, "tracker.db")); const base = S.seed(); const t0 = Date.now();
  const rnd = (a) => a[Math.floor(Math.random() * a.length)]; const D = 864e5;
  const users = [...base.users]; const hash = hashPassword(PW);
  for (let k = users.length; k < U; k++) { const email = `test${k}@druckluft-chemnitz.de`; users.push({ id: `lu${k}`, name: `Test Person ${k}`, email, role: rnd(["MEMBER", "AGENT", "AGENT"]), active: true, color: S.hashColor(email), notifyEmail: false }); }
  const customers = [...base.customers];
  for (let k = customers.length; k < C; k++) customers.push({ id: `lc${k}`, no: String(20000 + k), name: `Testkunde ${k} GmbH`, street: `Straße ${k}`, zip: "09111", city: "Chemnitz", phone: "", email: `info@kunde${k}.de`, notes: "", externalId: null,
    contacts: [{ id: `lc${k}k1`, name: `Kontakt ${k}`, email: `kontakt@kunde${k}.de`, phone: "", role: "" }], assets: [{ id: `lc${k}a1`, name: "Schraubenkompressor", manufacturer: "Kaeser", model: "SK 25", serial: `SN${k}`, year: 2018, location: "", intervalMonths: 12, lastMaintenance: S.addDays(S.today(), -Math.floor(Math.random() * 360)), active: true }],
    createdAt: new Date(t0 - 400 * D).toISOString(), updatedAt: new Date(t0 - 10 * D).toISOString() });
  const projects = base.projects; const counters = Object.fromEntries(projects.map((p) => [p.id, base.issues.filter((i) => i.projectId === p.id).length]));
  const issues = [...base.issues]; const words = ["Kompressor", "Trockner", "Filter", "Leitung", "Druck", "Wartung", "Angebot", "Rechnung", "Ölwechsel", "Kondensat", "Steuerung", "Sensor"];
  for (let k = 0; k < N; k++) {
    const p = rnd(projects); const wf = S.workflowFor(p); const created = t0 - Math.random() * 720 * D; const st = Math.random() < 0.8 ? wf.find((s) => s.cat === "done") : rnd(wf);
    const assignee = rnd(users); const c = p.type === "service" ? rnd(customers) : null; const type = rnd(S.PROJECT_TYPES[p.type].types.filter((x) => x !== "SUBTASK" && x !== "EPIC"));
    const i = S.newIssue({ project: p, no: ++counters[p.id], type, summary: `${rnd(words)} ${rnd(words)} – Vorgang ${k}`, description: `Beschreibung ${k}. `.repeat(8), priority: rnd(Object.keys(S.PRIOS)), assigneeId: assignee.id, reporterId: rnd(users).id,
      customerId: c?.id, customer: c ? S.customerSnapshot(c) : null, dueDate: Math.random() < 0.5 ? S.dayKey(new Date(created + 14 * D)) : null });
    i.createdAt = new Date(created).toISOString(); i.updatedAt = new Date(created + Math.random() * 20 * D).toISOString(); i.status = st.id;
    if (st.cat === "done") { i.resolvedAt = i.updatedAt; if (p.type === "service") i.resolution = { cause: "Verschleiß", action: "Teil getauscht, Probelauf ok", parts: "1× Filter", hours: 1.5, at: i.resolvedAt, by: assignee.id }; }
    for (let n = 0; n < 3; n++) i.comments.push({ id: S.uid(), userId: rnd(users).id, author: null, text: `Kommentar ${n} zu Vorgang ${k}: Rückmeldung vom Kunden eingeholt.`, at: new Date(created + n * 36e5).toISOString(), internal: n === 1 });
    for (let n = 0; n < 4; n++) i.history.unshift({ id: S.uid(), at: new Date(created + n * 72e5).toISOString(), userId: assignee.id, field: "Status", from: "Neu", to: "In Arbeit" });
    issues.push(i);
  }
  const data = { ...base, users, customers, issues };
  store.tx(() => { for (const type of COLLECTIONS) for (const o of data[type] || []) store.put(type, o); for (const [pid, n] of Object.entries(counters)) store.s.setCounter.run(pid, n + 1); store.meta("initialized", new Date().toISOString()); });
  const ins = store.db.prepare("INSERT INTO accounts (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)");
  store.tx(() => { for (const u of users) ins.run(u.id, u.email, hash, new Date().toISOString()); });
  console.log(`${issues.length} Vorgänge, ${users.length} Personen, ${customers.length} Kunden in ${((Date.now() - t0) / 1000).toFixed(1)} s · Datenbank ${(fs.statSync(path.join(dir, "tracker.db")).size / 1048576).toFixed(1)} MB`);
}

async function run(base) {
  const U = opt("users", 50), SEC = opt("seconds", 30);
  const lat = {}; const bytes = {}; let errors = 0; const errSamples = [];
  const rec = (k, ms, b = 0) => { (lat[k] ||= []).push(ms); bytes[k] = Math.max(bytes[k] || 0, b); };
  async function req(k, url, opts = {}) {
    const t = performance.now();
    try {
      const res = await fetch(base + url, { ...opts, headers: { "Content-Type": "application/json", "X-GFT": "1", "Accept-Encoding": "gzip, br", ...(opts.headers || {}) } });
      const buf = await res.arrayBuffer(); rec(k, performance.now() - t, Number(res.headers.get("content-length")) || buf.byteLength); // Content-Length = übertragene (komprimierte) Größe
      if (!res.ok) { errors++; if (errSamples.length < 5) errSamples.push(`${k} ${res.status} ${Buffer.from(buf).toString().slice(0, 120)}`); return null; }
      return { res, json: () => JSON.parse(Buffer.from(buf).toString()) };
    } catch (e) { errors++; if (errSamples.length < 5) errSamples.push(`${k} ${e.message}`); return null; }
  }
  // Personen aus der Testdatenbank (test6@ … testN@ plus Demo-Personen)
  const emails = ["anna.mueller", "thomas.weber", "lisa.schmidt", "jonas.neumann", "mehmet.yilmaz", "sarah.becker"].map((n) => `${n}@druckluft-chemnitz.de`);
  for (let k = 6; emails.length < U; k++) emails.push(`test${k}@druckluft-chemnitz.de`);
  const clients = [];
  const tLogin = performance.now();
  await Promise.all(emails.map(async (email) => {
    const r = await req("login", "/api/login", { method: "POST", body: JSON.stringify({ email, password: PW }) }); if (!r) return;
    clients.push({ email, cookie: r.res.headers.get("set-cookie").split(";")[0], rev: 0, issues: [] });
  }));
  console.log(`${clients.length} Anmeldungen in ${((performance.now() - tLogin) / 1000).toFixed(1)} s`);
  const tState = performance.now();
  await Promise.all(clients.map(async (c) => { const [r] = await Promise.all([req("state (Start)", "/api/state?part=base", { headers: { cookie: c.cookie } }), req("state (Benachr.)", "/api/state?part=notifications", { headers: { cookie: c.cookie } })]); if (!r) return; const st = r.json(); c.rev = st.rev; c.issues = st.issues.filter((i) => i.status !== "DONE" && i.status !== "CLOSED").map((i) => i.id); c.me = st.users.find((u) => u.email === c.email)?.id; }));
  console.log(`Startdaten für ${clients.length} Personen gleichzeitig in ${((performance.now() - tState) / 1000).toFixed(1)} s`);
  const end = Date.now() + SEC * 1000; let ops = 0;
  await Promise.all(clients.map(async (c) => {
    while (Date.now() < end) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 1700)); const x = Math.random();
      if (!c.rev) continue; // Startdaten fehlgeschlagen – wie im Browser: kein Abgleich ohne Stand
      if (x < 0.55) { const r = await req("changes", `/api/changes?since=${c.rev}`, { headers: { cookie: c.cookie } }); if (r) c.rev = r.json().rev; }
      else if (x < 0.85 && c.issues.length) {
        const id = c.issues[Math.floor(Math.random() * c.issues.length)];
        await req("sync (Kommentar)", "/api/sync", { method: "POST", headers: { cookie: c.cookie }, body: JSON.stringify({ ops: [{ type: "issues", id, op: "patch", patch: { arr: { comments: { add: [{ id: `lt${Math.random().toString(36).slice(2)}`, userId: c.me, text: "Lasttest", at: new Date().toISOString(), internal: true }] } } } }] }) });
      } else if (x < 0.95) await req("API-Suche", `/api/v1/issues?limit=1`, { headers: { cookie: c.cookie } }).catch(() => {});
      else await req("portal (Anfrage)", "/api/portal/requests", { method: "POST", headers: { "X-Forwarded-For": `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` }, body: JSON.stringify({ projectKey: "SD", type: "SERVICE", name: "Last Test", company: "Last GmbH", email: "last@test.de", summary: "Lasttest", description: "x" }) });
      ops++;
    }
  }));
  const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  console.log(`\n${ops} Aktionen in ${SEC} s (${(ops / SEC).toFixed(1)}/s), Fehler: ${errors}${errSamples.length ? `\n  ${errSamples.join("\n  ")}` : ""}`);
  console.log("Aktion".padEnd(20), "Anzahl".padStart(7), "p50 ms".padStart(8), "p95 ms".padStart(8), "max ms".padStart(8), "größte Antwort".padStart(16));
  for (const [k, a] of Object.entries(lat)) console.log(k.padEnd(20), String(a.length).padStart(7), pct(a, 0.5).toFixed(0).padStart(8), pct(a, 0.95).toFixed(0).padStart(8), Math.max(...a).toFixed(0).padStart(8), `${(bytes[k] / 1024).toFixed(0)} KB`.padStart(16));
}
