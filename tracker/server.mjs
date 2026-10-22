#!/usr/bin/env node
// GF Tracker – Server. Startet mit: node server.mjs  (Node.js ≥ 22.13)
// Keine externen Pakete: HTTP, SQLite und Kryptografie kommen aus Node.js selbst.
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { Store, COLLECTIONS } from "./lib/store.mjs";
import { Sessions, RateLimiter, hashPassword, verifyPassword, validatePassword, randomToken, sha256 } from "./lib/auth.mjs";
import { Mailer, mailTemplate, setMailBrand } from "./lib/mailer.mjs";
import { createApiV1 } from "./lib/apiv1.mjs";
import { createWebhooks, WEBHOOK_EVENTS } from "./lib/webhooks.mjs";
import { createM365 } from "./lib/m365.mjs";
import { createFactorial } from "./lib/factorial.mjs";
import { Accounts } from "./lib/accounts.mjs";
import { createOps, AUDIT_ACTIONS } from "./lib/ops.mjs";
import { createAutomation, RULE_KINDS, TRIGGERS } from "./lib/automation.mjs";
import * as ICS from "./lib/ics.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");

/* ---------- Konfiguration (Umgebungsvariablen) ---------- */
const env = process.env;
const CFG = {
  port: Number(env.PORT || 3000),
  host: env.HOST || "0.0.0.0",
  dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, "data")),
  appUrl: (env.APP_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ""),
  company: env.COMPANY_NAME || "GF Tracker",
  trustProxy: env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true",
  backupKeep: Number(env.BACKUP_KEEP || 14),
  seedDemo: env.SEED_DEMO === "1" || env.SEED_DEMO === "true",
  demoPassword: env.DEMO_PASSWORD || "Passwort123!",
  // Websites, die das Kundenportal per <iframe> einbetten dürfen (Leerzeichen-getrennt), z. B. "https://www.ihre-firma.de"
  portalFrameAncestors: String(env.PORTAL_FRAME_ANCESTORS || "").split(/[\s,]+/).filter((o) => /^https?:\/\/[^\s/]+$/.test(o)),
};
CFG.secureCookies = env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" || env.COOKIE_SECURE === "1" : CFG.appUrl.startsWith("https://");
fs.mkdirSync(path.join(CFG.dataDir, "backups"), { recursive: true });

/* ---------- Gemeinsame Fachlogik laden (dieselbe Datei wie im Browser) ---------- */
const sandbox = {}; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(PUBLIC, "shared.js"), "utf8"), sandbox, { filename: "shared.js" });
const S = sandbox.TrackerShared;

const store = new Store(path.join(CFG.dataDir, "tracker.db"));
const sessions = new Sessions(store, { secureCookies: CFG.secureCookies });
const loginLimiter = new RateLimiter(10, 15 * 60e3);
const portalLimiter = new RateLimiter(8, 10 * 60e3);
const mailer = new Mailer({ tenantId: env.MS_TENANT_ID, clientId: env.MS_CLIENT_ID, clientSecret: env.MS_CLIENT_SECRET, sender: env.MAIL_SENDER, loginHost: env.MS_LOGIN_HOST, graphBase: env.MS_GRAPH_BASE });
const log = (...a) => console.log(new Date().toISOString(), ...a);
const accounts = new Accounts({ store, sessions, mailer, cfg: CFG, userById: (id) => userById(id), log });
const forgotLimiter = new RateLimiter(5, 15 * 60e3);
const DUMMY_HASH = hashPassword(randomToken(16));

/** Integrationsprotokoll (sichtbar unter Einstellungen → Integrationen). */
function ilog(source, level, message) {
  log(`[${source}] ${message}`);
  try { store.db.prepare("INSERT INTO integration_log (at, source, level, message) VALUES (?, ?, ?, ?)").run(Date.now(), source, level, String(message).slice(0, 500));
    store.db.prepare("DELETE FROM integration_log WHERE id <= (SELECT MAX(id) - 1000 FROM integration_log)").run(); } catch {}
}

/* ---------- Ersteinrichtung ---------- */
function setupInitialData() {
  const accounts = store.db.prepare("INSERT INTO accounts (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)");
  store.tx(() => {
    if (!store.meta("initialized")) {
      if (CFG.seedDemo) {
        const data = S.seed();
        for (const type of COLLECTIONS) for (const obj of data[type] || []) store.put(type, obj);
        const pw = hashPassword(CFG.demoPassword);
        for (const u of data.users) accounts.run(u.id, u.email.toLowerCase(), pw, new Date().toISOString());
        log(`Beispieldaten angelegt. Anmeldung z. B. mit ${data.users[1].email} / ${CFG.demoPassword}`);
      }
      store.meta("initialized", new Date().toISOString());
    }
    // Administrator aus der Konfiguration anlegen, falls diese E-Mail noch keinen Zugang hat (auch als Notfallzugang)
    const email = (env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (email && !store.db.prepare("SELECT 1 FROM accounts WHERE email = ?").get(email)) {
      let pw = env.ADMIN_PASSWORD; let generated = false;
      if (!pw || validatePassword(pw)) { pw = randomToken(12); generated = true; }
      const existing = store.all("users").find((u) => u.email.toLowerCase() === email);
      const user = existing ? { ...existing, role: "ADMIN", active: true } : { id: S.uid(), name: env.ADMIN_NAME || "Administrator", email, role: "ADMIN", active: true, color: S.hashColor(email), notifyEmail: true };
      store.put("users", user); accounts.run(user.id, email, hashPassword(pw), new Date().toISOString());
      log(`Administrator angelegt: ${email}${generated ? ` – Startpasswort: ${pw}  (bitte nach dem ersten Login ändern)` : ""}`);
    }
    if (!store.db.prepare("SELECT 1 FROM accounts LIMIT 1").get()) log("WARNUNG: Es gibt noch keinen Zugang. Bitte ADMIN_EMAIL (und optional ADMIN_PASSWORD) setzen und neu starten.");
  });
}

/* ---------- HTTP-Hilfen ---------- */
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};
// In Teams eingebettete Seiten: Teams darf einbetten (das Teams-SDK liegt unter /vendor)
const TEAMS_HEADERS = { "X-Frame-Options": undefined, "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'self' https://teams.microsoft.com https://*.teams.microsoft.com https://teams.cloud.microsoft https://*.cloud.microsoft https://*.office.com https://teams.live.com https://*.skype.com; base-uri 'none'; form-action 'self'" };
/** Nur relative Rücksprungziele innerhalb der App zulassen (kein offener Redirect). */
const safeNext = (n) => (typeof n === "string" && /^\/(teams\/)?[A-Za-z0-9/_-]*$/.test(n) && !n.startsWith("//") ? n : null);
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const COMPRESSIBLE = /^(application\/(json|javascript|xml|manifest\+json)|text\/|image\/svg)/;
const acceptsGzip = (res) => /\bgzip\b/.test(String(res.req?.headers["accept-encoding"] || ""));
function send(res, status, body, headers = {}) {
  const h = { ...SECURITY_HEADERS, ...headers };
  for (const k of Object.keys(h)) if (h[k] === undefined) delete h[k];
  if (CFG.secureCookies) h["Strict-Transport-Security"] = "max-age=31536000";
  if (body !== undefined && typeof body !== "string" && !Buffer.isBuffer(body)) { body = JSON.stringify(body); h["Content-Type"] = "application/json; charset=utf-8"; h["Cache-Control"] = "no-store"; }
  // Komprimieren spart bei großen Antworten 80–90 % Übertragung (wichtig unterwegs im Mobilfunk)
  if (body && body.length > 2048 && !h["Content-Encoding"] && COMPRESSIBLE.test(h["Content-Type"] || "") && acceptsGzip(res)) {
    h["Content-Encoding"] = "gzip"; h.Vary = "Accept-Encoding";
    if (body.length > 256 * 1024) { // große Antworten im Hintergrund komprimieren, damit der Server für andere frei bleibt
      return zlib.gzip(body, { level: 4 }, (err, gz) => { if (err) { delete h["Content-Encoding"]; res.writeHead(status, h); return res.end(body); } res.writeHead(status, h); res.end(gz); });
    }
    body = zlib.gzipSync(body, { level: 5 });
  }
  res.writeHead(status, h); res.end(body);
}
function clientIp(req) { return (CFG.trustProxy && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?"; }
async function readJson(req, limit = 2e6) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new HttpError(413, "Anfrage zu groß."); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new HttpError(400, "Ungültiges JSON."); }
}
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const staticGz = new Map();
function serveFile(req, res, file, extraHeaders = {}) {
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, "Nicht gefunden", { "Content-Type": "text/plain; charset=utf-8" });
  const st = fs.statSync(full); const etag = `"${st.size}-${st.mtimeMs}"`;
  if (req.headers["if-none-match"] === etag) return send(res, 304, undefined, { ETag: etag, ...extraHeaders });
  const type = MIME[path.extname(full)] || "application/octet-stream";
  if (COMPRESSIBLE.test(type) && acceptsGzip(res)) {
    let gz = staticGz.get(full); if (!gz || gz.etag !== etag) { gz = { etag, data: zlib.gzipSync(fs.readFileSync(full), { level: 9 }) }; staticGz.set(full, gz); }
    return send(res, 200, gz.data, { "Content-Type": type, "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Cache-Control": "no-cache", ETag: etag, ...extraHeaders });
  }
  send(res, 200, fs.readFileSync(full), { "Content-Type": type, "Cache-Control": "no-cache", ETag: etag, ...extraHeaders });
}

/* ---------- Anhänge (Dateien im Datenordner, Metadaten am Vorgang) ---------- */
const FILES = path.join(CFG.dataDir, "files"); fs.mkdirSync(FILES, { recursive: true });
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const ops = createOps({ store, cfg: CFG, log, filesDir: FILES, version: VERSION, extra: () => ({
  snapshot: snapshot ? { ms: snapshot.ms, issues: snapshot.issues, archived: snapshot.archived, bytes: snapshot.json.length, gz: snapshot.gz.length } : null,
  archiveDays: ARCHIVE_DAYS, online: new Set([...clients].map((c) => c.userId)).size, mail: mailer.configured }) });
const audit = ops.audit;

/* ---------- Microsoft Teams: App-Paket (manifest.json + Symbole als ZIP) ---------- */
function zipStore(files) { // ZIP ohne Kompression – reicht für drei kleine Dateien
  const parts = [], central = []; let off = 0;
  for (const { name, data } of files) {
    const n = Buffer.from(name), crc = zlib.crc32(data) >>> 0, h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, n, data); central.push(c, n); off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}
function teamsPackage() {
  let id = store.meta("teamsAppId"); if (!id) { id = crypto.randomUUID(); store.meta("teamsAppId", id); }
  const b = brand(); const host = new URL(CFG.appUrl).host; const name = b.appName.slice(0, 30);
  const tab = (entityId, label, view) => ({ entityId, name: label, contentUrl: `${CFG.appUrl}/teams/tab?view=${encodeURIComponent(view)}`, websiteUrl: `${CFG.appUrl}/#/${view}`, scopes: ["personal"] });
  const manifest = {
    $schema: "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json", manifestVersion: "1.16",
    version: `1.${Number(store.meta("teamsAppVersion") || 0)}.${Math.floor(Date.now() / 864e5) % 65535}`, id,
    developer: { name: CFG.company.slice(0, 32), websiteUrl: CFG.appUrl, privacyUrl: `${CFG.appUrl}/portal`, termsOfUseUrl: `${CFG.appUrl}/portal` },
    name: { short: name, full: `${name} – Vorgänge, Service und Projekte` },
    description: { short: "Vorgänge, Kundenanfragen und Projekte direkt in Teams", full: `${name} in Microsoft Teams: Mein Tag, Suche, Dashboard und Projekt-Boards als Reiter – persönlich oder im Kanal fürs ganze Team. Anmeldung mit dem bestehenden Zugang bzw. mit Microsoft.` },
    icons: { color: "color.png", outline: "outline.png" }, accentColor: b.color,
    staticTabs: [tab("mytasks", "Mein Tag", "your-work"), tab("search", "Suche", "filters?state=open"), tab("dashboard", "Dashboard", "dashboard")],
    configurableTabs: [{ configurationUrl: `${CFG.appUrl}/teams/config`, canUpdateConfiguration: true, scopes: ["team", "groupChat"] }],
    permissions: ["identity"], validDomains: [host],
    // Benachrichtigungen im Aktivitätsfeed: verknüpft die Teams-App mit der App-Registrierung (MS_CLIENT_ID)
    ...(mailer.appConfigured ? { webApplicationInfo: { id: env.MS_CLIENT_ID, resource: `api://${host}/${env.MS_CLIENT_ID}` },
      activities: { activityTypes: [{ type: "gftNotification", description: "Benachrichtigung aus dem Tracker (zugewiesen, erwähnt, fällig, SLA …)", templateText: "{title}" }] } } : {}),
  };
  const color = fs.readFileSync(path.join(PUBLIC, "icons", "teams-color.png")); // 192×192, App-Logo
  const outline = fs.readFileSync(path.join(PUBLIC, "icons", "teams-outline.png")); // 32×32, weiß auf transparent
  return zipStore([{ name: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2)) }, { name: "color.png", data: color }, { name: "outline.png", data: outline }]);
}

/* ---------- Erscheinungsbild: App-Name, Firmenname, Farbe, Logo ---------- */
const ENV_COMPANY = CFG.company; const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };
function brand() {
  const logo = store.meta("brandLogo"); const f = logo && path.join(CFG.dataDir, logo); const ok = f && fs.existsSync(f);
  return { appName: store.meta("brandAppName") || "GF Tracker", company: CFG.company, color: store.meta("brandColor") || "#2436e8", logo: ok ? `/brand/logo?v=${Math.round(fs.statSync(f).mtimeMs)}` : null };
}
function applyBrand() {
  CFG.company = store.meta("brandCompany") || ENV_COMPANY; const b = brand();
  setMailBrand({ color: b.color, logoUrl: b.logo && /\.svg$/.test(store.meta("brandLogo") || "") ? null : b.logo ? CFG.appUrl + b.logo : null }); // SVG zeigt Outlook nicht an
}
applyBrand();
const MAX_FILE = Number(env.MAX_UPLOAD_MB || 15) * 1024 * 1024;
const BLOCKED = /\.(exe|bat|cmd|com|scr|js|jse|vbs|vbe|ps1|msi|msp|dll|jar|hta|cpl|lnk|reg)$/i;
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);
async function readRaw(req, limit) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new HttpError(413, `Datei zu groß (höchstens ${Math.round(limit / 1048576)} MB).`); chunks.push(c); }
  return Buffer.concat(chunks);
}
const cleanName = (n) => String(n || "datei").normalize("NFC").replace(/[\\/\x00-\x1f"<>|:*?]/g, "_").replace(/^\.+/, "").slice(0, 150) || "datei";
/** Datei speichern und am Vorgang vermerken; gibt die Metadaten zurück. */
function addAttachment(issueId, { name, type, data, userId = null, by = null, source = "upload" }) {
  const fname = cleanName(name); if (BLOCKED.test(fname)) throw new HttpError(415, "Ausführbare Dateien sind aus Sicherheitsgründen nicht erlaubt.");
  if (!data?.length) throw new HttpError(400, "Leere Datei."); if (data.length > MAX_FILE) throw new HttpError(413, `Datei zu groß (höchstens ${Math.round(MAX_FILE / 1048576)} MB).`);
  const meta = { id: S.uid(), name: fname, size: data.length, type: String(type || "application/octet-stream").split(";")[0].trim().toLowerCase().slice(0, 100), at: new Date().toISOString(), userId, by, source };
  fs.writeFileSync(path.join(FILES, meta.id), data);
  store.tx(() => {
    const i = store.get("issues", issueId); if (!i) throw new HttpError(404, "Vorgang nicht gefunden.");
    i.attachments = [...(i.attachments || []), meta];
    i.history.unshift({ id: S.uid(), at: meta.at, userId, by: userId ? null : by, field: "Anhang", from: "", to: fname });
    i.updatedAt = meta.at; store.put("issues", i);
  });
  return meta;
}
const findAttachment = (fileId) => { for (const i of store.all("issues")) { const a = (i.attachments || []).find((x) => x.id === fileId); if (a) return { issue: i, a }; } return null; };
function sendAttachment(req, res, a, url) {
  const full = path.join(FILES, a.id); if (!/^[A-Za-z0-9_-]+$/.test(a.id) || !fs.existsSync(full)) return send(res, 404, { error: "Datei nicht gefunden." });
  const inline = url.searchParams.get("inline") === "1" && INLINE_TYPES.has(a.type);
  res.writeHead(200, { "Content-Type": inline ? a.type : INLINE_TYPES.has(a.type) ? a.type : "application/octet-stream", "Content-Length": fs.statSync(full).size,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`, "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox", "Cache-Control": "private, max-age=3600" });
  fs.createReadStream(full).pipe(res);
}

/* ---------- Startdaten und Archiv ---------- */
// Erledigte Vorgänge, die länger als ARCHIVE_DAYS erledigt sind, werden beim Start nicht an die Browser
// geschickt (bleiben vollständig gespeichert und werden bei Bedarf nachgeladen).
const ARCHIVE_DAYS = Number(env.ARCHIVE_DAYS ?? 180);
const archiveCutoff = () => new Date(Date.now() - ARCHIVE_DAYS * 864e5).toISOString();
function isArchived(i, cutoff = archiveCutoff()) { if (!(ARCHIVE_DAYS > 0) || !i.resolvedAt || i.resolvedAt >= cutoff) return false; const p = projectById(i.projectId); return !!p && S.statusInfo(p, i.status).cat === "done"; }
let snapshot = null;
/** Gemeinsamer Startdatensatz für alle Browser – höchstens alle 3 Sekunden neu gebaut, fertig komprimiert.
    Der Browser holt danach alle Änderungen seit der Revision des Datensatzes – so bleibt alles konsistent. */
function stateSnapshot() {
  if (snapshot && (snapshot.rev === store.rev() || Date.now() - snapshot.at < 3000)) return snapshot;
  const t0 = Date.now(); const cutoff = archiveCutoff(); const out = { rev: store.rev() }; let archived = 0;
  for (const t of COLLECTIONS) if (t !== "notifications") out[t] = store.all(t);
  out.users = out.users.map(publicUser);
  out.issues = out.issues.filter((i) => (isArchived(i, cutoff) ? (archived++, false) : true));
  out.archive = { count: archived, days: ARCHIVE_DAYS };
  const json = JSON.stringify(out);
  snapshot = { rev: out.rev, at: Date.now(), json: Buffer.from(json), gz: zlib.gzipSync(json, { level: 5 }), ms: Date.now() - t0, issues: out.issues.length, archived };
  if (snapshot.ms > 300) log(`Startdatensatz: ${snapshot.issues} Vorgänge (+${archived} im Archiv), ${(snapshot.json.length / 1048576).toFixed(1)} MB → ${(snapshot.gz.length / 1048576).toFixed(1)} MB komprimiert, ${snapshot.ms} ms`);
  return snapshot;
}
function sendSnapshot(res) {
  const snap = stateSnapshot(); const gz = acceptsGzip(res);
  res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Accept-Encoding", ...(gz ? { "Content-Encoding": "gzip" } : {}), "Content-Length": (gz ? snap.gz : snap.json).length });
  res.end(gz ? snap.gz : snap.json);
}

/* ---------- Live-Aktualisierung (Server-Sent Events) ---------- */
const clients = new Set();
function broadcast() { const rev = store.rev(); for (const c of clients) c.res.write(`event: rev\ndata: ${rev}\n\n`); }
setInterval(() => { for (const c of clients) c.res.write(": ping\n\n"); }, 25e3).unref();

/* ---------- Fachliche Hilfen ---------- */
const userById = (id) => (id ? store.get("users", id) : null);
const projectById = (id) => store.get("projects", id);
const issueKey = (i) => `${projectById(i.projectId)?.key || "?"}-${i.no}`;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, color: u.color, notifyEmail: u.notifyEmail !== false, notifyTeams: u.notifyTeams !== false });
const notifId = (key, userId) => "n" + sha256(`${key}:${userId}`).slice(0, 22);
function createNotification(userId, type, title, text, issueId, key) {
  const id = key ? notifId(key, userId) : S.uid();
  if (store.get("notifications", id, true)) return false; // schon einmal erzeugt (auch wenn inzwischen gelöscht)
  const u = userById(userId); if (!u || !u.active) return false;
  store.put("notifications", { id, userId, type, title, text, issueId, at: new Date().toISOString(), read: false, key: key || null });
  return true;
}

/** Kunde zu einer E-Mail-Adresse (Ansprechpartner oder Firmenadresse). */
function findCustomerByEmail(email) {
  const e = String(email || "").trim().toLowerCase(); if (!e) return null;
  return store.all("customers").find((c) => (c.email || "").toLowerCase() === e || (c.contacts || []).some((k) => (k.email || "").toLowerCase() === e)) || null;
}

/* ---------- Synchronisierung: Änderungen der Browser anwenden ---------- */
function canWrite(user, type, op, cur, data) {
  const admin = user.role === "ADMIN";
  if (type === "users") {
    if (op === "put") return "Benutzer werden über die Benutzerverwaltung angelegt.";
    if (op === "delete") return "Benutzer können nur deaktiviert werden.";
    if (admin) return null;
    if (cur.id !== user.id) return "Nur Administratoren dürfen andere Benutzer ändern.";
    const allowed = new Set(["name", "notifyEmail", "notifyTeams"]);
    const fields = [...Object.keys(data.set || {}), ...(data.unset || []), ...Object.keys(data.arr || {})];
    return fields.every((f) => allowed.has(f)) ? null : "Sie dürfen nur Ihren Namen und Ihre Benachrichtigungen ändern.";
  }
  if (type === "projects" && !admin) return "Nur Administratoren dürfen Projekte anlegen, ändern oder löschen.";
  if (type === "customers" && op === "delete" && !admin) return "Kunden können nur Administratoren löschen.";
  if (type === "absences" && !admin) {
    const target = (cur || data)?.userId; const lead = (store.all("teams")).some((t) => t.leadId === user.id && t.memberIds.includes(target));
    if (cur?.source === "factorial") return "Abwesenheiten aus Factorial werden dort gepflegt.";
    if (target !== user.id && !lead) return "Abwesenheiten anderer Personen pflegen Teamleitung oder Administratoren.";
    const moved = data?.set?.userId; if (moved && moved !== target) { const lead2 = (store.all("teams")).some((t) => t.leadId === user.id && t.memberIds.includes(moved)); if (moved !== user.id && !lead2) return "Abwesenheiten anderer Personen pflegen Teamleitung oder Administratoren."; }
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
function sanitize(type, obj, cur) {
  if (type === "issues") {
    const p = projectById(obj.projectId); if (!p) throw new HttpError(400, "Projekt existiert nicht.");
    if (!S.TYPES[obj.type]) throw new HttpError(400, "Unbekannter Vorgangstyp.");
    if (!S.PRIOS[obj.priority]) obj.priority = "MEDIUM";
    if (typeof obj.summary !== "string" || !obj.summary.trim()) throw new HttpError(400, "Zusammenfassung fehlt.");
    obj.summary = obj.summary.slice(0, 255);
    if (cur) { obj.no = cur.no; obj.projectId = cur.projectId; }
    else {
      const clash = (() => { const x = store.issueByNo(obj.projectId, obj.no); return !!x && x.id !== obj.id; })();
      if (!Number.isInteger(obj.no) || obj.no < 1 || clash) obj.no = store.reserveNumber(obj.projectId);
    }
  }
  if (type === "projects") {
    obj.key = String(obj.key || "").toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(obj.key)) throw new HttpError(400, "Ungültiger Projektschlüssel.");
    if (store.all("projects").some((p) => p.key === obj.key && p.id !== obj.id)) throw new HttpError(409, `Schlüssel ${obj.key} ist bereits vergeben.`);
    if (!S.PROJECT_TYPES[obj.type]) throw new HttpError(400, "Unbekannter Projekttyp.");
  }
  if (type === "users" && cur) { obj.email = cur.email; }
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
const AUDITED_DELETES = { issues: "Vorgang", projects: "Projekt", customers: "Kunde", teams: "Team", sprints: "Sprint", users: "Person", absences: "Abwesenheit" };
const auditLabel = (type, o) => type === "issues" ? `${issueKey(o)} ${o.summary}` : type === "projects" ? `${o.key} – ${o.name}` : type === "absences" ? `${userById(o.userId)?.name || "?"} ${o.start}–${o.end}` : o.name || o.email || o.id;
function applyOp(user, op, effects) {
  const { type, id } = op;
  if (!COLLECTIONS.includes(type) || !ID_RE.test(String(id))) throw new HttpError(400, "Ungültiges Objekt.");
  const cur = store.get(type, id);
  if (op.op === "delete") {
    const err = canWrite(user, type, "delete", cur, {}); if (err) throw new HttpError(403, err);
    if (cur) { store.del(type, id); if (AUDITED_DELETES[type]) audit(user, "delete", `${AUDITED_DELETES[type]}: ${auditLabel(type, cur)}`); }
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
      if (type === "notifications") { const target = userById(op.data.userId); if (!target) throw new HttpError(400, "Empfänger unbekannt."); }
      next = op.data;
    }
  } else if (op.op === "patch") {
    if (!cur) return { type, id, deleted: true, error: "Das Objekt wurde inzwischen gelöscht." };
    const err = canWrite(user, type, "patch", cur, op.patch || {}); if (err) throw new HttpError(403, err);
    next = S.applyPatch(cur, op.patch || {});
  } else throw new HttpError(400, "Unbekannte Operation.");
  next.id = id; next = sanitize(type, next, cur);
  if (JSON.stringify(next).length > 400e3) throw new HttpError(413, "Objekt zu groß.");
  if (type === "users" && cur && cur.active && next.active === false) effects.deactivated.push(id);
  if (type === "users" && cur && cur.role !== next.role) audit(user, "user.role", `${next.email}: ${S.ROLES[cur.role] || cur.role} → ${S.ROLES[next.role] || next.role}`);
  if (type === "users" && cur && !!cur.active !== !!next.active) audit(user, "user.active", `${next.email}: ${next.active ? "aktiviert" : "deaktiviert"}`);
  if (type === "projects" && !cur) audit(user, "project.created", `${next.key} – ${next.name}`);
  if (type === "issues") effects.issues.push({ before: cur, after: next });
  if (type === "customers") effects.customers.push(next);
  store.put(type, next);
  return { type, id, data: type === "users" ? publicUser(next) : next };
}

/* ---------- E-Mails an Kunden bei Antworten/Lösung ---------- */
function portalLink(issueId) {
  let row = store.db.prepare("SELECT token FROM portal_tokens WHERE issue_id = ?").get(issueId);
  if (!row) { const token = randomToken(24); store.db.prepare("INSERT INTO portal_tokens (token_hash, issue_id, token, created_at) VALUES (?, ?, ?, ?)").run(sha256(token), issueId, token, Date.now()); row = { token }; }
  return `${CFG.appUrl}/portal/r/${row.token}`;
}
/** Kundenmails: Antworten gehen ans Service-Postfach (→ landen im Vorgang), Kopie in „Gesendete Elemente“. */
function customerMailOpts(key) { const inbox = m365.settings().inbox; return { replyTo: inbox || undefined, saveToSent: true, headers: { "X-GFT-Issue": key } }; }
const replyHint = (key) => (m365.settings().inbox && m365.settings().mailIn && mailer.appConfigured ? `Antworten Sie einfach auf diese E-Mail – Ihre Nachricht wird automatisch dem Vorgang ${key} zugeordnet.` : null);
/** Termin als Kalenderdatei (Outlook: „In Kalender speichern“). */
function appointmentIcs(i) {
  const c = i.customerId ? store.get("customers", i.customerId) : null; const tech = userById(i.assigneeId)?.name; const key = issueKey(i);
  return ICS.calendar([{ uid: `appt-${i.id}@gf-tracker`, sequence: Math.floor(Date.now() / 60000), start: i.appointmentAt, end: new Date(new Date(i.appointmentAt).getTime() + m365.settings().calendarMinutes * 60e3),
    summary: `Servicetermin ${CFG.company}: ${i.summary}`, description: [`Vorgang ${key}`, tech ? `Techniker/in: ${tech}` : "", i.customer?.name ? `Ansprechpartner: ${i.customer.name}` : ""].filter(Boolean).join("\n"),
    location: c ? S.customerAddress(c) : "", url: portalLink(i.id), alarmMinutes: 60 }], { name: `${CFG.company} – Servicetermin` });
}
function customerMails({ before, after }) {
  const p = projectById(after.projectId); if (!p || p.type !== "service" || !after.customer?.email || !mailer.configured) return;
  const key = issueKey(after); const link = portalLink(after.id); const opts = customerMailOpts(key); const hint = replyHint(key);
  const greeting = `Guten Tag ${after.customer.name || ""},`;
  const known = new Set((before?.comments || []).map((c) => c.id));
  for (const c of after.comments.filter((c) => !known.has(c.id) && c.userId && !c.internal)) {
    const agent = userById(c.userId)?.name || "Service";
    queueMail(after.customer.email, `[${key}] Neue Antwort zu Ihrer Anfrage`, mailTemplate({ company: CFG.company, greeting, title: after.summary, preheader: `${agent}: ${c.text.slice(0, 100)}`, lines: [`${agent} hat geantwortet:`, c.text], button: { url: link, label: "Anfrage ansehen" }, replyHint: hint, footer: `Vorgang ${key}` }), opts);
  }
  if (after.status === "SCHEDULED" && after.appointmentAt && (before?.status !== "SCHEDULED" || before?.appointmentAt !== after.appointmentAt)) {
    const when = fmtAppt(after.appointmentAt); const tech = userById(after.assigneeId)?.name; const moved = before?.status === "SCHEDULED";
    queueMail(after.customer.email, `[${key}] ${moved ? "Neuer Termin" : "Terminbestätigung"}: ${when}`, mailTemplate({ company: CFG.company, greeting,
      title: `${moved ? "Ihr Termin wurde verschoben" : "Wir haben einen Termin für Sie eingeplant"}: ${when}`, preheader: `${when}${tech ? ` · ${tech}` : ""}`,
      lines: [`Anliegen: ${after.summary}`, tech ? `Techniker/in: ${tech}` : "", "Den Termin können Sie über den Anhang direkt in Ihren Outlook-Kalender übernehmen. Passt er nicht? Antworten Sie einfach."].filter(Boolean),
      button: { url: link, label: "Anfrage ansehen" }, replyHint: hint, footer: `Vorgang ${key}` }), { ...opts, attachments: m365.settings().calendarInvite && m365.settings().calendar && mailer.appConfigured ? [] : [{ name: "Servicetermin.ics", contentType: "text/calendar; charset=utf-8; method=PUBLISH", content: appointmentIcs(after) }] });
  }
  if (before && S.statusInfo(p, before.status).cat !== "done" && S.statusInfo(p, after.status).cat === "done") {
    const r = after.resolution;
    const report = r ? ["Servicebericht:", r.cause ? `Ursache: ${r.cause}` : "", `Durchgeführte Arbeiten: ${r.action}`, r.parts ? `Material/Ersatzteile: ${r.parts}` : "", r.hours ? `Arbeitszeit: ${String(r.hours).replace(".", ",")} h` : "", r.by ? `Techniker/in: ${userById(r.by)?.name || ""}` : ""].filter(Boolean) : [];
    queueMail(after.customer.email, `[${key}] Ihre Anfrage wurde gelöst`, mailTemplate({ company: CFG.company, greeting, title: `Ihre Anfrage „${after.summary}“ wurde gelöst.`, preheader: r ? r.action.slice(0, 120) : "Ihre Anfrage wurde gelöst.",
      lines: [...report, "Falls noch etwas offen ist, antworten Sie einfach – die Anfrage wird dann wieder geöffnet."], button: { url: link, label: "Anfrage und Bericht ansehen" }, replyHint: hint, footer: `Vorgang ${key}` }), opts);
  }
}
const fmtAppt = (iso) => new Date(iso).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: env.TZ || "Europe/Berlin" }) + " Uhr";
const mailQueue = [];
function queueMail(to, subject, html, opts = {}) { mailQueue.push({ to, subject, html, ...opts }); }
async function flushMailQueue() {
  while (mailQueue.length) { const m = mailQueue.shift(); try { await mailer.send(m); log(`E-Mail gesendet an ${m.to}: ${m.subject}`); } catch (e) { log("E-Mail-Fehler:", e.message); } }
}

/* ---------- Hintergrundaufgaben ---------- */
/** Fristen und SLA prüfen – erzeugt Benachrichtigungen genau einmal (feste IDs). */
function deadlineJob() {
  const t = S.today(); let created = 0;
  store.tx(() => {
    for (const i of store.all("issues")) {
      const p = projectById(i.projectId); if (!p || S.statusInfo(p, i.status).cat === "done") continue;
      const key = issueKey(i);
      if (i.dueDate && i.type !== "EPIC") {
        const d = S.daysBetween(t, i.dueDate);
        if (d < 0) for (const u of new Set([i.assigneeId, i.reporterId].filter(Boolean))) created += createNotification(u, "overdue", `Überfällig: ${key} ${i.summary}`, `Fällig war ${i.dueDate.split("-").reverse().join(".")}.`, i.id, `od:${i.id}:${i.dueDate}`);
        else if (d <= 2) { const u = i.assigneeId || i.reporterId; if (u) created += createNotification(u, "due", `Bald fällig: ${key} ${i.summary}`, `Fällig am ${i.dueDate.split("-").reverse().join(".")}.`, i.id, `ds:${i.id}:${i.dueDate}`); }
      }
      if (i.status === "SCHEDULED" && i.appointmentAt && i.assigneeId) {
        const ms = new Date(i.appointmentAt).getTime() - Date.now();
        if (ms > 0 && ms <= 18 * 36e5) created += createNotification(i.assigneeId, "due", `Einsatz ${fmtAppt(i.appointmentAt).replace(/ Uhr$/, "")}: ${key}`, `${i.customer?.company || ""} – ${i.summary}`, i.id, `appt:${i.id}:${i.appointmentAt}`);
        if (ms < -2 * 36e5) created += createNotification(i.assigneeId, "overdue", `Einsatz noch nicht begonnen: ${key}`, `Termin war ${fmtAppt(i.appointmentAt)}. Bitte beginnen oder neu einplanen.`, i.id, `apptlate:${i.id}:${i.appointmentAt}`);
      }
      for (const kind of ["first", "resolve"]) {
        const s = S.slaCompute(i, p, kind); if (!s || s.stopped) continue;
        const who = i.assigneeId || p.leadId; if (!who) continue;
        const name = kind === "first" ? "Erste Antwort" : "Lösung";
        if (s.breached) created += createNotification(who, "sla", `SLA verletzt (${name}): ${key}`, i.summary, i.id, `slab:${kind}:${i.id}:${i.priority}`);
        else if (s.risk) created += createNotification(who, "sla", `SLA gefährdet (${name}): ${key}`, `${i.summary} – noch ${S.fmtDur(s.remaining)}`, i.id, `slar:${kind}:${i.id}:${i.priority}`);
      }
    }
    created += maintenanceJob(t);
  });
  if (created) broadcast();
}
/** Wartungsplan: Anlagen mit fälliger Wartung bekommen automatisch einen Wartungsvorgang im Service-Projekt. */
function maintenanceJob(t) {
  const mp = store.all("projects").find((p) => p.type === "service" && p.autoMaint); if (!mp) return 0;
  let n = 0;
  for (const { customer, asset, due } of S.maintenanceDue({ customers: store.all("customers"), issues: store.all("issues"), projects: store.all("projects"), today: t, leadDays: mp.maintLeadDays ?? 21 })) {
    const i = S.newIssue({ project: mp, no: store.reserveNumber(mp.id), reporterId: null, ...S.maintenanceIssueData(customer, asset, due) });
    automation.onCreate(i); store.put("issues", i);
    const c2 = JSON.parse(JSON.stringify(customer)); c2.assets.find((a) => a.id === asset.id).autoCreatedFor = due; store.put("customers", c2);
    const team = i.teamId ? store.get("teams", i.teamId) : null;
    for (const u of new Set([...(team?.memberIds || []), mp.leadId].filter(Boolean))) createNotification(u, "new", `Wartung fällig: ${issueKey(i)}`, `${customer.name} – ${asset.name} bis ${due.split("-").reverse().join(".")}`, i.id);
    emit("issue.created", i); n++;
    log(`Wartungsvorgang ${issueKey(i)} angelegt: ${customer.name} / ${asset.name}`);
  }
  return n;
}
/** Folgen einer Vorgangsänderung: Wartungsplan fortschreiben, Ereignisse für Webhooks/Kalender. */
function issueEffects({ before, after }) {
  const p = projectById(after.projectId); if (!p) return;
  if (!before && automation.onCreate(after)) store.put("issues", after); // Zuweisungsregeln
  const cat = (i) => (i ? S.statusInfo(p, i.status).cat : null);
  if (after.assetId && after.customerId && after.type === "MAINT" && before && cat(before) !== "done" && cat(after) === "done") {
    const c = store.get("customers", after.customerId); const next = c && S.completeMaintenance(c, after.assetId, S.dayKey(after.resolvedAt || new Date()));
    if (next) store.put("customers", next);
  }
  if (!before || before.appointmentAt !== after.appointmentAt || before.assigneeId !== after.assigneeId || before.status !== after.status || before.summary !== after.summary) m365.calendarTouch(after);
  if (!before) emit("issue.created", after);
  else {
    if (before.status !== after.status) emit(cat(after) === "done" && cat(before) !== "done" ? "issue.resolved" : "issue.status_changed", after, { from: S.statusInfo(p, before.status).name });
    if (before.assigneeId !== after.assigneeId && after.assigneeId) emit("issue.assigned", after);
    const known = new Set((before.comments || []).map((c) => c.id));
    for (const c of after.comments.filter((c) => !known.has(c.id))) emit("comment.created", after, { comment: { text: c.text, internal: !!c.internal, author: c.userId ? userById(c.userId)?.name : c.author, at: c.at } });
  }
}
/** Ereignis-Verteiler (Webhooks, Kalender) – Empfänger melden sich mit onEvent an. */
const eventHandlers = [];
const onEvent = (fn) => eventHandlers.push(fn);
function emit(type, issue, extra = {}) { for (const fn of eventHandlers) { try { fn(type, issue, extra); } catch (e) { log("Ereignis-Fehler:", e.message); } } }
/* ---------- Schnittstellen: REST-API und Webhooks ---------- */
const apiV1 = createApiV1({ store, S, HttpError, readJson, cfg: CFG, issueKey, projectById, userById, publicUser, broadcast, issueEffects, customerMails, flushMailQueue, emit: (...a) => emit(...a), ilog, createNotification, findCustomerByEmail, addAttachment });
const automation = createAutomation({ store, S, projectById, userById, issueKey, createNotification, log });
function automationJob() {
  if (automation.job().length) broadcast();
}
const webhooks = createWebhooks({ store, cfg: CFG, issueDto: apiV1.issueDto, customerDto: apiV1.customerDto, ilog, log });
onEvent((type, obj, extra) => webhooks.enqueue(type, obj, extra));
const m365 = createM365({ store, S, mailer, cfg: CFG, env, ilog, issueKey, projectById, userById, createNotification, findCustomerByEmail, broadcast, issueEffects, confirmReceipt, sessions, customerMails, flushMailQueue, addAttachment, maxFile: MAX_FILE });
setInterval(() => m365.pullCalendarChanges(), Number(env.CAL_PULL_INTERVAL_MS) || 5 * 60e3).unref();
setTimeout(() => m365.pollMailbox(), 5e3).unref();
setInterval(() => m365.pollMailbox(), Number(env.MAILIN_INTERVAL_MS) || 120e3).unref();
const factorial = createFactorial({ store, S, env, ilog, broadcast });
if (factorial.configured) { setTimeout(() => factorial.sync().catch(() => {}), 10e3).unref(); setInterval(() => factorial.sync().catch(() => {}), Number(env.FACTORIAL_INTERVAL_MS) || 60 * 60e3).unref(); }
setInterval(() => webhooks.work(), Number(env.WEBHOOK_INTERVAL_MS) || 10e3).unref();
function integrationStatus() {
  const meta = (k) => store.meta(k);
  return { appUrl: CFG.appUrl, events: WEBHOOK_EVENTS,
    teams: { packaged: !!store.meta("teamsAppId"), sent7d: store.db.prepare("SELECT COUNT(*) AS n FROM teams_log WHERE ok = 1").get().n, failed7d: store.db.prepare("SELECT COUNT(*) AS n FROM teams_log WHERE ok = 0").get().n },
    mail: { configured: mailer.configured, sender: env.MAIL_SENDER || null },
    m365: { appConfigured: mailer.appConfigured, ...m365.settings(), lastPoll: store.meta("mailInLastPoll"), redirectUri: `${CFG.appUrl}/auth/microsoft/callback`, ssoEnv: env.SSO_MICROSOFT === "1" || env.SSO_MICROSOFT === "true" },
    apiKeys: apiV1.listKeys().map((k) => ({ ...k, createdBy: userById(k.created_by)?.name || null })),
    webhooks: webhooks.list().map((h) => ({ ...h, stats: webhooks.stats().find((s) => s.hook_id === h.id) || null })),
    log: store.db.prepare("SELECT at, source, level, message FROM integration_log ORDER BY id DESC LIMIT 60").all(),
    factorial: factorial.status() };
}
/** Benachrichtigungen per E-Mail (gebündelt je Person, nur der letzten 24 h). */
async function notificationMailJob() {
  if (!mailer.configured) return;
  const sent = new Set(store.db.prepare("SELECT notification_id FROM mail_log").all().map((r) => r.notification_id));
  const since = Date.now() - 864e5; const byUser = new Map();
  for (const n of store.all("notifications")) {
    if (sent.has(n.id) || n.read || new Date(n.at).getTime() < since) continue;
    (byUser.get(n.userId) || byUser.set(n.userId, []).get(n.userId)).push(n);
  }
  const mark = store.db.prepare("INSERT OR IGNORE INTO mail_log (notification_id, sent_at) VALUES (?, ?)");
  for (const [userId, list] of byUser) {
    const u = userById(userId); list.forEach((n) => mark.run(n.id, Date.now()));
    if (!u || !u.active || u.notifyEmail === false || !u.email) continue;
    const items = list.map((n) => ({ title: n.title, text: n.text, url: n.issueId ? `${CFG.appUrl}/#/issue/${(() => { const i = store.get("issues", n.issueId); return i ? issueKey(i) : ""; })()}` : CFG.appUrl }));
    const subject = list.length === 1 ? `[${CFG.company}] ${list[0].title}` : `[${CFG.company}] ${list.length} neue Benachrichtigungen`;
    queueMail(u.email, subject, mailTemplate({ company: CFG.company, greeting: `Hallo ${u.name.split(" ")[0]},`, title: list.length === 1 ? list[0].title : `${list.length} neue Benachrichtigungen`, items, button: { url: CFG.appUrl, label: "GF Tracker öffnen" }, footer: "E-Mail-Benachrichtigungen können Sie in den Einstellungen abschalten." }));
  }
  await flushMailQueue();
}
/* ---------- Benachrichtigungen im Teams-Aktivitätsfeed (Microsoft Graph, TeamsActivity.Send) ---------- */
const teamsWarned = new Map(); let teamsBusy = false;
const teamsDeepLink = (key) => { const id = store.meta("teamsAppId"); const web = `${CFG.appUrl}/#/issue/${key}`; return id ? `https://teams.microsoft.com/l/entity/${id}/mytasks?webUrl=${encodeURIComponent(web)}&context=${encodeURIComponent(JSON.stringify({ subEntityId: key }))}` : web; };
async function teamsNotifyJob() {
  if (teamsBusy || !mailer.appConfigured || !m365.settings().teamsNotify || !store.meta("teamsAppId")) return; teamsBusy = true;
  try {
    const since = Math.max(Date.now() - 864e5, Number(store.meta("teamsNotifySince") || 0)); // beim Einschalten keine alten Meldungen nachschicken
    const done = store.db.prepare("SELECT 1 FROM teams_log WHERE notification_id = ?"); const mark = store.db.prepare("INSERT OR IGNORE INTO teams_log (notification_id, sent_at, ok) VALUES (?, ?, ?)");
    const due = store.all("notifications").filter((n) => !n.read && new Date(n.at).getTime() >= since && !done.get(n.id)).sort((a, b) => a.at.localeCompare(b.at)).slice(0, 50);
    for (const n of due) {
      const u = userById(n.userId); if (!u || !u.active || u.notifyTeams === false || !u.email) { mark.run(n.id, Date.now(), 0); continue; }
      const i = n.issueId && store.get("issues", n.issueId); const key = i ? issueKey(i) : "";
      try {
        await mailer.graph("POST", `/users/${encodeURIComponent(u.email)}/teamwork/sendActivityNotification`, {
          topic: { source: "text", value: (key ? `${key} ${i.summary}` : n.title).slice(0, 120), webUrl: key ? teamsDeepLink(key) : CFG.appUrl.startsWith("https://") ? teamsDeepLink("") : CFG.appUrl },
          activityType: "gftNotification", previewText: { content: (n.text || n.title).slice(0, 150) }, templateParameters: [{ name: "title", value: n.title.slice(0, 120) }] });
        mark.run(n.id, Date.now(), 1);
      } catch (e) {
        mark.run(n.id, Date.now(), 0); const last = teamsWarned.get(u.id) || 0;
        if (Date.now() - last > 36e5) { teamsWarned.set(u.id, Date.now()); ilog("teams", "warn", `Teams-Benachrichtigung an ${u.email} nicht möglich: ${e.status === 403 ? "Berechtigung TeamsActivity.Send fehlt oder App nicht freigegeben" : e.status === 404 ? "Teams-App ist bei dieser Person nicht installiert" : e.message}`); }
      }
    }
    store.db.prepare("DELETE FROM teams_log WHERE sent_at < ?").run(Date.now() - 7 * 864e5);
  } finally { teamsBusy = false; }
}
function backupJob() {
  try { ops.backup(); } catch (e) { log("Sicherung fehlgeschlagen:", e.message); ilog("backup", "error", `Sicherung fehlgeschlagen: ${e.message}`); }
}

/* ---------- Kundenportal ---------- */
function portalView(issue) {
  const p = projectById(issue.projectId); const st = S.statusInfo(p, issue.status);
  return { key: issueKey(issue), summary: issue.summary, description: issue.description, type: issue.type, status: st.name, statusCat: st.cat, closed: issue.status === "CLOSED", createdAt: issue.createdAt,
    attachments: (issue.attachments || []).filter((a) => a.source === "portal" || a.source === "email" || a.public).map((a) => ({ id: a.id, name: a.name, size: a.size, type: a.type, fromCustomer: a.source !== "upload" })),
    appointmentAt: ["SCHEDULED", "WORKING"].includes(issue.status) ? issue.appointmentAt || null : null, technician: issue.assigneeId ? userById(issue.assigneeId)?.name || null : null,
    report: issue.resolution && st.cat === "done" ? { cause: issue.resolution.cause, action: issue.resolution.action, parts: issue.resolution.parts, hours: issue.resolution.hours, at: issue.resolution.at } : null,
    comments: issue.comments.filter((c) => !c.internal).map((c) => ({ at: c.at, text: c.text, fromCustomer: !c.userId, author: c.userId ? `${userById(c.userId)?.name || "Service"} (Service)` : c.author || "Sie" })) };
}
const str = (v, max) => String(v ?? "").trim().slice(0, max);
async function portalCreate(req) {
  const ip = clientIp(req); if (!portalLimiter.check(ip)) throw new HttpError(429, "Zu viele Anfragen. Bitte in einigen Minuten erneut versuchen.");
  const b = await readJson(req, 64e3);
  if (b.website) throw new HttpError(400, "Ungültige Anfrage."); // Honeypot gegen Spam-Bots
  const p = store.all("projects").find((x) => x.key === str(b.projectKey, 10).toUpperCase() && x.type === "service");
  if (!p) throw new HttpError(400, "Service-Bereich nicht gefunden.");
  const type = S.REQUEST_TYPES.some((r) => r.id === b.type) ? b.type : null; if (!type) throw new HttpError(400, "Bitte eine Anfrageart wählen.");
  const name = str(b.name, 120), company = str(b.company, 160), email = str(b.email, 200).toLowerCase(), summary = str(b.summary, 200), description = str(b.description, 8000);
  if (!name || !company || !summary || !description) throw new HttpError(400, "Bitte alle Pflichtfelder ausfüllen.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Bitte eine gültige E-Mail-Adresse angeben.");
  const priority = S.URGENCY.some((u) => u.id === b.urgency) ? b.urgency : "MEDIUM";
  portalLimiter.hit(ip);
  const issue = store.tx(() => {
    const known = findCustomerByEmail(email);
    const i = S.newIssue({ project: p, no: store.reserveNumber(p.id), type, summary, priority, reporterId: null, labels: ["portal"],
      description: [str(b.asset, 200) ? `Anlage/Standort: ${str(b.asset, 200)}` : "", description].filter(Boolean).join("\n\n"),
      customer: { name, company, email, phone: str(b.phone, 60) }, customerId: known?.id || null });
    store.put("issues", i); issueEffects({ before: null, after: i });
    const agents = store.all("users").filter((u) => u.active && (u.role === "AGENT" || u.id === p.leadId));
    for (const u of agents) createNotification(u.id, "new", `Neue Anfrage: ${p.key}-${i.no}`, `${company} · ${name}: ${summary}`, i.id);
    return i;
  });
  broadcast();
  const link = confirmReceipt(issue, email, name);
  return { key: issueKey(issue), token: link.split("/").pop(), url: link, mailSent: mailer.configured };
}
/** Manifest des Outlook-Add-ins (Microsoft 365 Admin Center → Integrierte Apps → Benutzerdefinierte App hochladen). */
function outlookManifest() {
  const A = CFG.appUrl; const h = sha256(`gf-tracker-outlook|${A}`); const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  const x = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); const host = new URL(A).origin;
  return `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0" xmlns:mailappor="http://schemas.microsoft.com/office/mailappversionoverrides/1.0" xsi:type="MailApp">
  <Id>${id}</Id>
  <Version>1.1.0.0</Version>
  <ProviderName>${x(CFG.company)}</ProviderName>
  <DefaultLocale>de-DE</DefaultLocale>
  <DisplayName DefaultValue="GF Tracker"/>
  <Description DefaultValue="Vorgang aus einer E-Mail anlegen, an bestehende Vorgänge anhängen und Kunde mit offenen Vorgängen zum Absender anzeigen."/>
  <IconUrl DefaultValue="${x(A)}/icons/icon-64.png"/>
  <HighResolutionIconUrl DefaultValue="${x(A)}/icons/icon-128.png"/>
  <SupportUrl DefaultValue="${x(A)}/"/>
  <AppDomains><AppDomain>${x(host)}</AppDomain></AppDomains>
  <Hosts><Host Name="Mailbox"/></Hosts>
  <Requirements><Sets><Set Name="Mailbox" MinVersion="1.5"/></Sets></Requirements>
  <FormSettings><Form xsi:type="ItemRead"><DesktopSettings><SourceLocation DefaultValue="${x(A)}/outlook/taskpane.html"/><RequestedHeight>450</RequestedHeight></DesktopSettings></Form></FormSettings>
  <Permissions>ReadItem</Permissions>
  <Rule xsi:type="RuleCollection" Mode="Or"><Rule xsi:type="ItemIs" ItemType="Message" FormType="Read"/></Rule>
  <DisableEntityHighlighting>false</DisableEntityHighlighting>
  <VersionOverrides xmlns="http://schemas.microsoft.com/office/mailappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Requirements><bt:Sets DefaultMinVersion="1.5"><bt:Set Name="Mailbox"/></bt:Sets></Requirements>
    <Hosts>
      <Host xsi:type="MailHost">
        <DesktopFormFactor>
          <ExtensionPoint xsi:type="MessageReadCommandSurface">
            <OfficeTab id="TabDefault">
              <Group id="gftGroup">
                <Label resid="groupLabel"/>
                <Control xsi:type="Button" id="gftTaskpane">
                  <Label resid="btnLabel"/>
                  <Supertip><Title resid="btnLabel"/><Description resid="btnDesc"/></Supertip>
                  <Icon><bt:Image size="16" resid="icon16"/><bt:Image size="32" resid="icon32"/><bt:Image size="80" resid="icon80"/></Icon>
                  <Action xsi:type="ShowTaskpane"><SourceLocation resid="taskpaneUrl"/><SupportsPinning>true</SupportsPinning></Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>
    </Hosts>
    <Resources>
      <bt:Images>
        <bt:Image id="icon16" DefaultValue="${x(A)}/icons/icon-16.png"/>
        <bt:Image id="icon32" DefaultValue="${x(A)}/icons/icon-32.png"/>
        <bt:Image id="icon80" DefaultValue="${x(A)}/icons/icon-80.png"/>
      </bt:Images>
      <bt:Urls><bt:Url id="taskpaneUrl" DefaultValue="${x(A)}/outlook/taskpane.html"/></bt:Urls>
      <bt:ShortStrings><bt:String id="groupLabel" DefaultValue="GF Tracker"/><bt:String id="btnLabel" DefaultValue="GF Tracker"/></bt:ShortStrings>
      <bt:LongStrings><bt:String id="btnDesc" DefaultValue="Kunde zum Absender anzeigen, Vorgang aus dieser E-Mail anlegen oder an einen Vorgang anhängen."/></bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
`;
}
/** Persönlicher Kalender-Feed (Outlook „Kalender abonnieren“): Einsätze, Fristen, Abwesenheiten – mit ?scope=team für alle Teamkollegen. */
function calendarFeed(u, team) {
  const ids = new Set([u.id]); if (team) for (const t of store.all("teams")) if (t.memberIds.includes(u.id)) t.memberIds.forEach((x) => ids.add(x));
  const minutes = m365.settings().calendarMinutes; const since = Date.now() - 30 * 864e5; const events = [];
  for (const i of store.all("issues")) {
    if (!ids.has(i.assigneeId)) continue; const p = projectById(i.projectId); if (!p) continue;
    const done = S.statusInfo(p, i.status).cat === "done"; const key = issueKey(i); const link = `${CFG.appUrl}/#/issue/${key}`;
    const c = i.customerId ? store.get("customers", i.customerId) : null; const who = team && i.assigneeId !== u.id ? ` (${userById(i.assigneeId)?.name || ""})` : "";
    const desc = [`${key} · ${S.statusInfo(p, i.status).name}`, i.customer ? [i.customer.company, i.customer.name, i.customer.phone].filter(Boolean).join(" · ") : "", String(i.description || "").slice(0, 500), link].filter(Boolean).join("\n");
    if (i.appointmentAt && new Date(i.appointmentAt).getTime() > since && (done || ["SCHEDULED", "WORKING", "PARTS", "WAITING"].includes(i.status)))
      events.push({ uid: `appt-${i.id}@gf-tracker`, start: i.appointmentAt, end: new Date(new Date(i.appointmentAt).getTime() + minutes * 60e3), summary: `🔧 ${key} ${i.summary}${i.customer?.company ? ` – ${i.customer.company}` : ""}${who}`,
        description: desc, location: c ? S.customerAddress(c) : "", url: link, alarmMinutes: done ? null : 60, categories: ["GF Tracker"] });
    if (i.dueDate && !done && i.type !== "EPIC" && !team) // Erinnerung am Vortag um 9 Uhr
      events.push({ uid: `due-${i.id}@gf-tracker`, allDay: i.dueDate, summary: `⏰ Fällig: ${key} ${i.summary}`, description: desc, url: link, alarmTrigger: "-PT15H", categories: ["GF Tracker", "Frist"] });
  }
  for (const a of store.all("absences")) if (ids.has(a.userId) && new Date(a.end).getTime() > since)
    events.push({ uid: `abs-${a.id}@gf-tracker`, allDay: a.start, allDayEnd: a.end, summary: `${team || a.userId !== u.id ? `${userById(a.userId)?.name || ""}: ` : ""}${a.type}`, description: a.note || "", categories: ["Abwesenheit"] });
  return ICS.calendar(events, { name: team ? `GF Tracker – Team (${u.name})` : `GF Tracker – ${u.name}` });
}
/** Eingangsbestätigung mit persönlichem Portal-Link an den Kunden (Portal und E-Mail-Eingang). */
function confirmReceipt(issue, email, name) {
  const link = portalLink(issue.id); const key = issueKey(issue);
  if (mailer.configured && email) {
    queueMail(email, `[${key}] Ihre Anfrage ist eingegangen`, mailTemplate({ company: CFG.company, greeting: `Guten Tag ${name || ""},`, title: `Vielen Dank – Ihre Anfrage „${issue.summary}“ ist eingegangen.`, preheader: `Vorgangsnummer ${key} – wir melden uns schnellstmöglich.`,
      lines: [`Ihre Vorgangsnummer: ${key}`, "Über den folgenden Link sehen Sie jederzeit den Bearbeitungsstand."], button: { url: link, label: "Anfrage ansehen" }, replyHint: replyHint(key), footer: "Bitte bewahren Sie diese E-Mail auf." }), customerMailOpts(key));
    flushMailQueue();
  }
  return link;
}
function portalIssue(token) {
  const row = store.db.prepare("SELECT issue_id FROM portal_tokens WHERE token_hash = ?").get(sha256(String(token)));
  const issue = row && store.get("issues", row.issue_id);
  if (!issue) throw new HttpError(404, "Anfrage nicht gefunden. Bitte den Link aus der Bestätigungs-E-Mail verwenden.");
  return issue;
}
async function portalReply(req, token) {
  const ip = clientIp(req); if (!portalLimiter.check(`r:${ip}`)) throw new HttpError(429, "Zu viele Nachrichten. Bitte später erneut versuchen.");
  const b = await readJson(req, 32e3); const text = str(b.text, 8000); if (!text) throw new HttpError(400, "Bitte eine Nachricht eingeben.");
  portalLimiter.hit(`r:${ip}`);
  const issue = store.tx(() => {
    const i = portalIssue(token); const p = projectById(i.projectId);
    if (i.status === "CLOSED") throw new HttpError(409, "Diese Anfrage ist abgeschlossen. Bitte stellen Sie eine neue Anfrage.");
    const now = new Date().toISOString();
    i.comments.push({ id: S.uid(), userId: null, author: i.customer?.name || "Kunde", text, at: now, internal: false });
    if (i.status === "WAITING" || S.statusInfo(p, i.status).cat === "done") {
      const from = i.status; i.status = "WORKING"; S.applyTransition(i, p, from, "WORKING", now);
      i.history.unshift({ id: S.uid(), at: now, userId: null, field: "Status", from: S.statusInfo(p, from).name, to: S.statusInfo(p, "WORKING").name });
    }
    i.updatedAt = now; store.put("issues", i);
    const who = i.assigneeId || p.leadId; if (who) createNotification(who, "comment", `Kunde hat geantwortet: ${issueKey(i)}`, `${i.customer?.name}: ${text.slice(0, 120)}`, i.id);
    return i;
  });
  broadcast();
  return portalView(issue);
}

/* ---------- Admin: Import/Export ---------- */
function exportAll() {
  const out = { format: "gf-tracker", version: 1, exportedAt: new Date().toISOString() };
  for (const t of COLLECTIONS) if (t !== "notifications") out[t] = store.all(t);
  out.users = out.users.map(publicUser);
  return out;
}
function importAll(data, admin) {
  if (!data || !Array.isArray(data.issues) || !Array.isArray(data.projects) || !Array.isArray(data.users)) throw new HttpError(400, "Unbekanntes Format. Erwartet wird eine Sicherung des GF Trackers.");
  store.tx(() => {
    for (const t of COLLECTIONS) for (const o of store.all(t)) store.del(t, o.id);
    const users = data.users.map((u) => ({ ...publicUser({ notifyEmail: true, active: true, color: S.hashColor(u.email), ...u }), email: String(u.email).toLowerCase() }));
    if (!users.some((u) => u.id === admin.id)) users.push(publicUser(admin));
    for (const u of users) store.put("users", u);
    for (const t of ["teams", "customers", "absences", "projects", "sprints", "issues", "filters"]) for (const o of data[t] || []) if (o && ID_RE.test(String(o.id))) store.put(t, o);
    store.db.exec("DELETE FROM counters");
  });
  broadcast();
  const missing = store.all("users").filter((u) => !store.db.prepare("SELECT 1 FROM accounts WHERE user_id = ?").get(u.id));
  return { imported: data.issues.length, usersWithoutPassword: missing.map((u) => u.email) };
}

/* ---------- Routen ---------- */
async function handleApi(req, res, url, session) {
  const m = req.method; const p = url.pathname;
  const user = session ? userById(session.userId) : null;
  const needUser = () => { if (!user || !user.active) throw new HttpError(401, "Nicht angemeldet."); return user; };
  const needAdmin = () => { needUser(); if (user.role !== "ADMIN") throw new HttpError(403, "Nur für Administratoren."); return user; };
  if (p === "/api/v1" || p.startsWith("/api/v1/")) return apiV1.handle(req, url); // eigene Anmeldung per API-Schlüssel, ohne Cookies
  if (m !== "GET" && req.headers["x-gft"] !== "1") throw new HttpError(403, "Ungültige Anfrage (CSRF-Schutz).");

  if (p === "/api/health") return { ok: true, rev: store.rev(), mail: mailer.configured };
  if (p === "/api/login" && m === "POST") {
    const b = await readJson(req, 8e3); const email = str(b.email, 200).toLowerCase(); const key = `${clientIp(req)}|${email}`;
    if (!loginLimiter.check(key)) throw new HttpError(429, "Zu viele Fehlversuche. Bitte 15 Minuten warten.");
    const acc = store.db.prepare("SELECT user_id, password_hash FROM accounts WHERE email = ?").get(email);
    const u = acc && userById(acc.user_id);
    const ok = verifyPassword(String(b.password || ""), acc?.password_hash || DUMMY_HASH); // gleiche Rechenzeit auch bei unbekannter E-Mail
    if (!acc || !u || !u.active || !ok) { loginLimiter.hit(key); audit(u || null, "login.failed", email, clientIp(req)); throw new HttpError(401, "E-Mail oder Passwort falsch."); }
    loginLimiter.reset(key); log(`Anmeldung: ${email}`); audit(u, "login", "", clientIp(req));
    return { __cookie: sessions.create(u.id, req, clientIp(req)), body: { user: publicUser(u) } };
  }
  // Passwort vergessen / Einladung annehmen (öffentlich, Link mit Einmal-Token)
  if (p === "/api/password/forgot" && m === "POST") {
    const b = await readJson(req, 4e3); const ip = clientIp(req);
    if (!forgotLimiter.check(ip)) throw new HttpError(429, "Zu viele Anfragen. Bitte 15 Minuten warten.");
    forgotLimiter.hit(ip);
    try { await accounts.forgot(str(b.email, 200)); } catch (e) { log("Passwort-Link konnte nicht verschickt werden:", e.message); }
    return { ok: true, mail: mailer.configured };
  }
  if (p === "/api/password/check" && m === "GET") {
    const c = accounts.check(url.searchParams.get("t"));
    return c.valid ? { valid: true, kind: c.kind, name: c.user.name, email: c.user.email } : { valid: false, reason: c.reason };
  }
  if (p === "/api/password/set" && m === "POST") {
    const b = await readJson(req, 8e3);
    try { const u = accounts.redeem(b.token, b.password); audit(u, "password.link", "", clientIp(req)); broadcast(); return { __cookie: sessions.create(u.id, req, clientIp(req)), body: { ok: true } }; }
    catch (e) { if (e.status) throw new HttpError(e.status, e.message); throw e; }
  }
  if (p === "/api/logout" && m === "POST") { if (user) audit(user, "logout", "", clientIp(req)); return { __cookie: sessions.destroy(req), body: { ok: true } }; }

  if (p === "/api/brand" && m === "GET") return brand();
  if (p === "/api/auth/config") return { microsoft: m365.settings().sso };
  // Kundenportal (öffentlich)
  if (p === "/api/portal/config") return { company: CFG.company, logo: brand().logo, projects: store.all("projects").filter((x) => x.type === "service").map((x) => ({ key: x.key, name: x.name })), requestTypes: S.REQUEST_TYPES, urgency: S.URGENCY };
  if (p === "/api/portal/requests" && m === "POST") return await portalCreate(req);
  let pm = p.match(/^\/api\/portal\/requests\/([A-Za-z0-9_-]{20,64})$/);
  if (pm && m === "GET") return portalView(portalIssue(pm[1]));
  pm = p.match(/^\/api\/portal\/requests\/([A-Za-z0-9_-]{20,64})\/attachments$/);
  if (pm && m === "POST") {
    const ip = clientIp(req); if (!portalLimiter.check(`f:${ip}`)) throw new HttpError(429, "Zu viele Dateien. Bitte später erneut versuchen.");
    const issue = portalIssue(pm[1]); if (issue.status === "CLOSED") throw new HttpError(409, "Diese Anfrage ist abgeschlossen.");
    if ((issue.attachments || []).filter((a) => a.source === "portal").length >= 10) throw new HttpError(409, "Höchstens 10 Dateien je Anfrage.");
    const type = String(req.headers["content-type"] || ""); if (!/^(image\/(png|jpeg|gif|webp|heic|heif)|application\/pdf)/.test(type)) throw new HttpError(415, "Bitte Fotos (JPG, PNG) oder PDF hochladen.");
    portalLimiter.hit(`f:${ip}`);
    const data = await readRaw(req, Math.min(MAX_FILE, 10 * 1048576));
    const meta = addAttachment(issue.id, { name: decodeURIComponent(String(req.headers["x-filename"] || "foto")), type, data, by: issue.customer?.name || "Kunde", source: "portal" });
    const who = issue.assigneeId || projectById(issue.projectId)?.leadId; if (who) createNotification(who, "comment", `Kunde hat eine Datei geschickt: ${issueKey(issue)}`, meta.name, issue.id);
    broadcast(); return { ok: true, id: meta.id };
  }
  pm = p.match(/^\/api\/portal\/requests\/([A-Za-z0-9_-]{20,64})\/files\/([A-Za-z0-9_-]+)$/);
  if (pm && m === "GET") { const issue = portalIssue(pm[1]); const a = (issue.attachments || []).find((x) => x.id === pm[2] && (x.source !== "upload" || x.public)); if (!a) throw new HttpError(404, "Datei nicht gefunden."); return { __file: a }; }
  pm = p.match(/^\/api\/portal\/requests\/([A-Za-z0-9_-]{20,64})\/comments$/);
  if (pm && m === "POST") return await portalReply(req, pm[1]);

  // Ab hier nur angemeldet
  needUser();
  if (p === "/api/me" && m === "GET") return { user: publicUser(user), mail: mailer.configured, company: CFG.company, appUrl: CFG.appUrl, brand: brand() };
  pm = p.match(/^\/api\/issues\/([A-Za-z0-9_-]+)\/attachments$/);
  if (pm && m === "POST") {
    if (!store.get("issues", pm[1])) throw new HttpError(404, "Vorgang nicht gefunden.");
    const data = await readRaw(req, MAX_FILE);
    const meta = addAttachment(pm[1], { name: decodeURIComponent(String(req.headers["x-filename"] || "datei")), type: req.headers["content-type"], data, userId: user.id, source: "upload" });
    broadcast(); return meta;
  }
  pm = p.match(/^\/api\/issues\/([A-Za-z0-9_-]+)\/attachments\/([A-Za-z0-9_-]+)$/);
  if (pm && m === "DELETE") {
    const i = store.get("issues", pm[1]); const a = i && (i.attachments || []).find((x) => x.id === pm[2]); if (!a) throw new HttpError(404, "Anhang nicht gefunden.");
    if (a.userId !== user.id && user.role !== "ADMIN") throw new HttpError(403, "Nur wer die Datei hochgeladen hat oder Administratoren dürfen sie löschen.");
    store.tx(() => { const cur = store.get("issues", pm[1]); cur.attachments = (cur.attachments || []).filter((x) => x.id !== a.id);
      cur.history.unshift({ id: S.uid(), at: new Date().toISOString(), userId: user.id, field: "Anhang entfernt", from: a.name, to: "" }); cur.updatedAt = new Date().toISOString(); store.put("issues", cur); });
    fs.rmSync(path.join(FILES, a.id), { force: true }); broadcast(); return { ok: true };
  }
  pm = p.match(/^\/api\/files\/([A-Za-z0-9_-]+)$/);
  if (pm && m === "GET") { const hit = findAttachment(pm[1]); if (!hit) throw new HttpError(404, "Datei nicht gefunden."); return { __file: hit.a }; }
  if (p === "/api/me/outlook" && m === "GET") return { manifestUrl: `${CFG.appUrl}/outlook/manifest.xml`, key: apiV1.userKeyInfo(user.id), https: CFG.appUrl.startsWith("https://") };
  if (p === "/api/me/outlook" && m === "POST") { const k = apiV1.createUserKey(user.id); ilog("outlook", "info", `Zugangsschlüssel für das Outlook-Add-in erzeugt: ${user.email}`); return { token: k.token, key: apiV1.userKeyInfo(user.id) }; }
  if (p === "/api/me/calendar" && (m === "GET" || m === "POST")) {
    if (m === "POST") store.db.prepare("DELETE FROM sync_map WHERE kind = 'icstoken' AND local_id = ?").run(user.id);
    let row = store.db.prepare("SELECT remote_id FROM sync_map WHERE kind = 'icstoken' AND local_id = ?").get(user.id);
    if (!row) { row = { remote_id: randomToken(24) }; store.db.prepare("INSERT INTO sync_map (kind, local_id, remote_id) VALUES ('icstoken', ?, ?)").run(user.id, row.remote_id); }
    const url = `${CFG.appUrl}/cal/${row.remote_id}.ics`;
    return { url, teamUrl: `${url}?scope=team`, webcal: url.replace(/^https?:/, "webcal:") };
  }
  if (p === "/api/me/password" && m === "POST") {
    const b = await readJson(req, 8e3); const acc = store.db.prepare("SELECT password_hash FROM accounts WHERE user_id = ?").get(user.id);
    if (!acc || !verifyPassword(String(b.current || ""), acc.password_hash)) throw new HttpError(400, "Das aktuelle Passwort ist falsch.");
    const err = validatePassword(b.next); if (err) throw new HttpError(400, err);
    store.db.prepare("UPDATE accounts SET password_hash = ? WHERE user_id = ?").run(hashPassword(b.next), user.id);
    store.db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(user.id, session.tokenHash);
    audit(user, "password.changed", "", clientIp(req)); return { ok: true };
  }
  if (p === "/api/teams/token" && m === "POST") { // Anmeldung für die Teams-App (ohne Cookie, Token im Kopf)
    const token = sessions.createToken(user.id, null, clientIp(req), "Microsoft Teams"); audit(user, "login", "Microsoft Teams", clientIp(req)); return { token };
  }
  if (p === "/api/me/sessions" && m === "GET") return { sessions: sessions.list(user.id, session.tokenHash) };
  if (p === "/api/me/sessions/others" && m === "DELETE") { store.db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(user.id, session.tokenHash); return { ok: true }; }
  pm = p.match(/^\/api\/me\/sessions\/([a-f0-9]{16})$/);
  if (pm && m === "DELETE") { if (!sessions.revoke(user.id, pm[1])) throw new HttpError(404, "Sitzung nicht gefunden."); return { ok: true }; }
  if (p === "/api/state" && m === "GET" && url.searchParams.get("part") === "base") return { __snapshot: true };
  if (p === "/api/state" && m === "GET" && url.searchParams.get("part") === "notifications")
    return { notifications: store.all("notifications").filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300) };
  if (p === "/api/archive" && m === "GET") { // archivierte Vorgänge nachladen (optional für einen Kunden)
    const cutoff = archiveCutoff(); const cust = url.searchParams.get("customer");
    return { issues: store.all("issues").filter((i) => isArchived(i, cutoff) && (!cust || i.customerId === cust)) };
  }
  pm = p.match(/^\/api\/issues\/by-key\/([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (pm && m === "GET") { const pr = store.all("projects").find((x) => x.key === pm[1].toUpperCase()); const i = pr && store.issueByNo(pr.id, Number(pm[2])); if (!i) throw new HttpError(404, "Vorgang nicht gefunden."); return { issue: i }; }
  if (p === "/api/state" && m === "GET") {
    const out = { rev: store.rev() };
    for (const t of COLLECTIONS) out[t] = store.all(t);
    out.users = out.users.map(publicUser);
    out.notifications = out.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    return out;
  }
  if (p === "/api/changes" && m === "GET") {
    const since = Number(url.searchParams.get("since") || 0);
    // Zu weit zurück (z. B. Gerät lange offline): lieber neu laden als Tausende Änderungen nachspielen
    if (since === store.rev()) return { rev: since, changes: [] };
    if (!(since > 0) || store.rev() - since > 5000) return { rev: store.rev(), reset: true, changes: [] };
    const changes = store.since(since).filter((c) => c.type !== "notifications" || c.data.userId === user.id)
      .map((c) => (c.deleted ? { type: c.type, id: c.id, deleted: true } : { type: c.type, id: c.id, data: c.type === "users" ? publicUser(c.data) : c.data }));
    return { rev: store.rev(), changes };
  }
  if (p === "/api/sync" && m === "POST") {
    const b = await readJson(req); if (!Array.isArray(b.ops) || b.ops.length > 500) throw new HttpError(400, "Ungültige Änderungen.");
    const effects = { issues: [], customers: [], deactivated: [] }; const results = [];
    store.tx(() => { for (const op of b.ops) { try { results.push(applyOp(user, op, effects)); } catch (e) { if (!(e instanceof HttpError)) throw e; const cur = store.get(op.type, op.id); results.push({ type: op.type, id: op.id, error: e.message, ...(cur ? { data: op.type === "users" ? publicUser(cur) : cur } : { deleted: true }) }); } } });
    effects.deactivated.forEach((id) => sessions.destroyUser(id));
    store.tx(() => { effects.issues.forEach(issueEffects); effects.customers.forEach((c) => emit("customer.updated", c)); });
    effects.issues.forEach(customerMails); flushMailQueue();
    broadcast();
    return { rev: store.rev(), results };
  }
  pm = p.match(/^\/api\/projects\/([A-Za-z0-9_-]+)\/reserve$/);
  if (pm && m === "POST") {
    if (!projectById(pm[1])) throw new HttpError(404, "Projekt nicht gefunden.");
    const count = Math.min(5000, Math.max(1, Number(url.searchParams.get("count")) || 1)); // Block für Importe
    return { no: store.tx(() => { const first = store.reserveNumber(pm[1]); if (count > 1) store.s.setCounter.run(pm[1], first + count); return first; }), count };
  }
  if (p === "/api/events" && m === "GET") return { __sse: true };

  // Administration
  if (p === "/api/admin/users" && m === "POST") {
    needAdmin(); const b = await readJson(req, 8e3);
    const name = str(b.name, 120), email = str(b.email, 200).toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Bitte Name und gültige E-Mail angeben.");
    if (!S.ROLES[b.role]) throw new HttpError(400, "Unbekannte Rolle.");
    const invite = !!b.invite; // Einladung: die Person legt ihr Passwort über einen Link selbst fest
    if (!invite) { const err = validatePassword(b.password); if (err) throw new HttpError(400, err); }
    if (store.db.prepare("SELECT 1 FROM accounts WHERE email = ?").get(email)) throw new HttpError(409, "Diese E-Mail-Adresse hat bereits einen Zugang.");
    const existing = store.all("users").find((u) => u.email.toLowerCase() === email);
    const u = existing ? { ...existing, name, role: b.role, active: true } : { id: S.uid(), name, email, role: b.role, active: true, color: S.hashColor(email), notifyEmail: true };
    store.tx(() => { store.put("users", u); if (!invite) store.db.prepare("INSERT INTO accounts (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(u.id, email, hashPassword(b.password), new Date().toISOString()); });
    broadcast(); log(`Benutzer angelegt: ${email} (${b.role}) durch ${user.email}`); audit(user, "user.created", `${name} <${email}> · ${S.ROLES[b.role]}${invite ? " · Einladung" : ""}`, clientIp(req));
    return { user: publicUser(u), ...(invite ? { invite: await accounts.invite(u, user) } : {}) };
  }
  if (p === "/api/admin/integrations" && m === "GET") { needAdmin(); return integrationStatus(); }
  if (p === "/api/admin/integrations/settings" && m === "POST") {
    needAdmin(); const b = await readJson(req, 8e3);
    if ("mailInbox" in b) { const v = str(b.mailInbox, 200).toLowerCase(); if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, "Postfach: bitte eine E-Mail-Adresse angeben."); store.meta("mailInbox", v); }
    for (const k of ["mailInEnabled", "calendarSync", "ssoMicrosoft", "factorialCreateUsers", "calendarInviteCustomer", "calendarPull", "teamsNotify"]) if (k in b) store.meta(k, b[k] ? "1" : "0");
    if (b.teamsNotify && !store.meta("teamsNotifySince")) store.meta("teamsNotifySince", String(Date.now())); if (b.teamsNotify === false) store.meta("teamsNotifySince", "");
    if ("calendarMinutes" in b) store.meta("calendarMinutes", String(Math.min(600, Math.max(15, Number(b.calendarMinutes) || 120))));
    ilog("settings", "info", `Integrationseinstellungen geändert durch ${user.email}`); audit(user, "settings", `Integrationen: ${Object.keys(b).join(", ")}`, clientIp(req));
    if (b.calendarSync) for (const i of store.all("issues")) if (i.status === "SCHEDULED" && i.appointmentAt) m365.calendarTouch(i);
    return integrationStatus();
  }
  if (p === "/api/admin/factorial/sync" && m === "POST") { needAdmin(); try { return await factorial.sync(); } catch (e) { throw new HttpError(502, e.message); } }
  if (p === "/api/admin/mail/poll" && m === "POST") { needAdmin(); if (!mailer.appConfigured) throw new HttpError(409, "Microsoft 365 ist nicht eingerichtet (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET)."); if (!m365.settings().inbox) throw new HttpError(409, "Kein Postfach hinterlegt."); return await m365.pollMailbox(); }
  if (p === "/api/admin/api-keys" && m === "POST") { needAdmin(); const b = await readJson(req, 8e3); const k = apiV1.createKey(b.name, b.scope, user.id); ilog("api", "info", `API-Schlüssel „${str(b.name, 80)}“ (${b.scope === "write" ? "lesen+schreiben" : "nur lesen"}) erstellt von ${user.email}`); audit(user, "apikey.created", `${str(b.name, 80)} (${b.scope === "write" ? "lesen+schreiben" : "nur lesen"})`, clientIp(req)); return k; }
  pm = p.match(/^\/api\/admin\/api-keys\/([A-Za-z0-9_-]+)$/);
  if (pm && m === "DELETE") { needAdmin(); if (!apiV1.revokeKey(pm[1])) throw new HttpError(404, "Schlüssel nicht gefunden."); ilog("api", "info", `API-Schlüssel widerrufen durch ${user.email}`); audit(user, "apikey.revoked", pm[1], clientIp(req)); return { ok: true }; }
  if (p === "/api/admin/webhooks" && m === "POST") { needAdmin(); try { const h = webhooks.add(await readJson(req, 16e3)); ilog("webhook", "info", `Webhook „${h.name}“ angelegt`); audit(user, "webhook", `angelegt: ${h.name}`, clientIp(req)); return h; } catch (e) { throw new HttpError(400, e.message); } }
  pm = p.match(/^\/api\/admin\/webhooks\/([A-Za-z0-9_-]+)(\/test)?$/);
  if (pm && m === "PATCH" && !pm[2]) { needAdmin(); try { const h = webhooks.update(pm[1], await readJson(req, 16e3)); if (!h) throw new HttpError(404, "Webhook nicht gefunden."); return { ok: true }; } catch (e) { throw e instanceof HttpError ? e : new HttpError(400, e.message); } }
  if (pm && m === "DELETE" && !pm[2]) { needAdmin(); if (!webhooks.remove(pm[1])) throw new HttpError(404, "Webhook nicht gefunden."); audit(user, "webhook", `gelöscht: ${pm[1]}`, clientIp(req)); return { ok: true }; }
  if (pm && m === "POST" && pm[2]) { needAdmin(); try { return { ok: true, status: await webhooks.test(pm[1]) }; } catch (e) { ilog("webhook", "error", `Test fehlgeschlagen: ${e.message}`); throw new HttpError(502, `Test fehlgeschlagen: ${e.message}`); } }
  if (p === "/api/admin/users/import" && m === "POST") {
    needAdmin(); const b = await readJson(req, 4e6); if (!Array.isArray(b.users) || b.users.length > 2000) throw new HttpError(400, "Ungültige Liste.");
    let created = 0, updated = 0; const skipped = [];
    store.tx(() => { for (const x of b.users) {
      const name = str(x.name, 120), email = str(x.email, 200).toLowerCase(); const role = S.ROLES[x.role] ? x.role : "MEMBER";
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped.push(email || name); continue; }
      const ex = store.all("users").find((u) => u.email.toLowerCase() === email);
      if (ex) { store.put("users", { ...ex, name, role: ex.id === user.id ? ex.role : role, active: true }); updated++; }
      else { store.put("users", { id: S.uid(), name, email, role, active: true, color: S.hashColor(email), notifyEmail: true }); created++; }
    } });
    broadcast(); log(`Mitarbeiter-Import durch ${user.email}: ${created} neu, ${updated} aktualisiert`); audit(user, "user.import", `${created} neu, ${updated} aktualisiert`, clientIp(req));
    return { created, updated, skipped };
  }
  if (p === "/api/admin/accounts" && m === "GET") { needAdmin(); return { accounts: accounts.overview(), mail: mailer.configured }; }
  pm = p.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]+)\/(invite|logout)$/);
  if (pm && m === "POST") {
    needAdmin(); const target = userById(pm[1]); if (!target) throw new HttpError(404, "Benutzer nicht gefunden.");
    if (pm[2] === "logout") { sessions.destroyUser(target.id); log(`Alle Sitzungen von ${target.email} beendet durch ${user.email}`); audit(user, "user.logout", target.email, clientIp(req)); return { ok: true }; }
    if (!target.active) throw new HttpError(409, "Die Person ist deaktiviert.");
    const inv = await accounts.invite(target, user); audit(user, "user.invited", `${target.email}${inv.mailed ? " (per E-Mail)" : ""}`, clientIp(req)); return inv;
  }
  pm = p.match(/^\/api\/admin\/users\/([A-Za-z0-9_-]+)\/password$/);
  if (pm && m === "POST") {
    needAdmin(); const b = await readJson(req, 8e3); const target = userById(pm[1]); if (!target) throw new HttpError(404, "Benutzer nicht gefunden.");
    const err = validatePassword(b.password); if (err) throw new HttpError(400, err);
    const h = hashPassword(b.password);
    const exists = store.db.prepare("SELECT 1 FROM accounts WHERE user_id = ?").get(target.id);
    if (exists) store.db.prepare("UPDATE accounts SET password_hash = ? WHERE user_id = ?").run(h, target.id);
    else store.db.prepare("INSERT INTO accounts (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").run(target.id, target.email.toLowerCase(), h, new Date().toISOString());
    sessions.destroyUser(target.id); log(`Passwort gesetzt für ${target.email} durch ${user.email}`); audit(user, "password.admin", target.email, clientIp(req));
    return { ok: true };
  }
  if (p === "/api/admin/export" && m === "GET") { needAdmin(); audit(user, "backup.download", "JSON-Export", clientIp(req)); return { __download: `gf-tracker-sicherung-${S.today()}.json`, body: exportAll() }; }
  if (p === "/api/admin/import" && m === "POST") { needAdmin(); const b = await readJson(req, 50e6); try { ops.backup({ force: true }); } catch (e) { log("Sicherung vor Import:", e.message); } const r = importAll(b, user); audit(user, "backup.restore", `${r.imported} Vorgänge eingespielt (vorher automatisch gesichert)`, clientIp(req)); return r; }
  if (p === "/api/admin/system" && m === "GET") { needAdmin(); return ops.status(); }
  if (p === "/api/admin/brand" && m === "POST") {
    needAdmin(); const b = await readJson(req, 8e3);
    if ("color" in b) { if (!/^#[0-9a-f]{6}$/i.test(String(b.color))) throw new HttpError(400, "Farbe bitte als #RRGGBB angeben."); store.meta("brandColor", b.color.toLowerCase()); }
    if ("appName" in b) store.meta("brandAppName", str(b.appName, 40));
    if ("company" in b) store.meta("brandCompany", str(b.company, 120));
    applyBrand(); audit(user, "settings", `Erscheinungsbild: ${Object.keys(b).join(", ")}`, clientIp(req)); broadcast(); return brand();
  }
  if (p === "/api/admin/brand/logo" && (m === "PUT" || m === "DELETE")) {
    needAdmin(); const old = store.meta("brandLogo"); const dropOld = () => { if (old) fs.rmSync(path.join(CFG.dataDir, old), { force: true }); };
    if (m === "DELETE") { dropOld(); store.meta("brandLogo", ""); applyBrand(); audit(user, "settings", "Logo entfernt", clientIp(req)); return brand(); }
    const type = String(req.headers["content-type"] || "").split(";")[0].trim(); const ext = LOGO_TYPES[type]; if (!ext) throw new HttpError(415, "Bitte PNG, JPG, WebP oder SVG hochladen.");
    const data = await readRaw(req, 1048576); if (!data.length) throw new HttpError(400, "Leere Datei.");
    if (ext === "svg" && /<script|on\w+\s*=|javascript:/i.test(data.toString("utf8"))) throw new HttpError(415, "Das SVG enthält Skripte und wird aus Sicherheitsgründen abgelehnt.");
    dropOld(); const name = `brand-logo.${ext}`; fs.writeFileSync(path.join(CFG.dataDir, name), data); store.meta("brandLogo", name);
    applyBrand(); audit(user, "settings", "Logo hochgeladen", clientIp(req)); broadcast(); return brand();
  }
  if (p === "/api/admin/teams/package" && m === "GET") { needAdmin(); audit(user, "settings", "Teams-App-Paket heruntergeladen", clientIp(req)); return { __zip: teamsPackage(), name: "gf-tracker-teams.zip" }; }
  if (p === "/api/admin/automation" && m === "GET") { needAdmin(); return { rules: automation.rules(), kinds: RULE_KINDS, triggers: TRIGGERS, recent: automation.recent(60) }; }
  if (p === "/api/admin/automation" && m === "PUT") {
    needAdmin(); const b = await readJson(req, 64e3); let rules;
    try { rules = automation.save(b.rules); } catch (e) { throw new HttpError(400, e.message); }
    audit(user, "rules", `${rules.length} Regeln (${rules.filter((r) => r.enabled).length} aktiv)`, clientIp(req));
    if (b.runNow) automationJob();
    return { rules, recent: automation.recent(60) };
  }
  if (p === "/api/admin/backup" && m === "POST") { needAdmin(); const r = ops.backup({ force: true }); audit(user, "backup.created", r.file, clientIp(req)); return r; }
  pm = p.match(/^\/api\/admin\/backups\/([A-Za-z0-9T._-]+)$/);
  if (pm && m === "GET") { needAdmin(); const f = ops.backupPath(pm[1]); if (!f) throw new HttpError(404, "Sicherung nicht gefunden."); audit(user, "backup.download", pm[1], clientIp(req)); return { __dbfile: f, name: pm[1] }; }
  if (p === "/api/admin/audit" && m === "GET") { needAdmin(); const q = url.searchParams; return { actions: AUDIT_ACTIONS, entries: ops.auditList({ q: str(q.get("q"), 100), action: str(q.get("action"), 40), before: Number(q.get("before")) || 0, limit: Number(q.get("limit")) || 100 }) }; }
  if (p === "/api/admin/mail-test" && m === "POST") {
    needAdmin(); if (!mailer.configured) throw new HttpError(409, "E-Mail ist nicht eingerichtet (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAIL_SENDER).");
    try { await mailer.send({ to: user.email, subject: `[${CFG.company}] Test-E-Mail`, html: mailTemplate({ company: CFG.company, title: "Der E-Mail-Versand funktioniert.", lines: [`Absender: ${env.MAIL_SENDER}`] }) }); }
    catch (e) { throw new HttpError(502, e.message); }
    return { ok: true, to: user.email };
  }
  throw new HttpError(404, "Unbekannte Schnittstelle.");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    const session = sessions.resolve(req, url);
    if (url.pathname.startsWith("/api/")) {
      const out = await handleApi(req, res, url, session);
      const extra = session?.setCookie ? { "Set-Cookie": session.setCookie } : {};
      if (out && out.__sse) {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no", ...extra });
        res.write(`event: rev\ndata: ${store.rev()}\n\n`);
        const c = { res, userId: session.userId }; clients.add(c); req.on("close", () => clients.delete(c));
        return;
      }
      if (out && out.__status) return send(res, out.__status, out.body, extra);
      if (out && out.__file) return sendAttachment(req, res, out.__file, url);
      if (out && out.__snapshot) return sendSnapshot(res);
      if (out && out.__zip) return send(res, 200, out.__zip, { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${out.name}"`, "Cache-Control": "no-store" });
      if (out && out.__dbfile) { res.writeHead(200, { "Content-Type": "application/vnd.sqlite3", "Content-Length": fs.statSync(out.__dbfile).size, "Content-Disposition": `attachment; filename="${out.name}"`, "Cache-Control": "no-store", ...SECURITY_HEADERS }); return fs.createReadStream(out.__dbfile).pipe(res); }
      if (out && out.__cookie) return send(res, 200, out.body, { "Set-Cookie": out.__cookie });
      if (out && out.__download) return send(res, 200, JSON.stringify(out.body, null, 2), { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${out.__download}"`, "Cache-Control": "no-store", ...extra });
      return send(res, 200, out, extra);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Methode nicht erlaubt", { "Content-Type": "text/plain; charset=utf-8" });
    if (url.pathname === "/" || url.pathname === "/index.html") {
      if (!session || !userById(session.userId)?.active) return send(res, 302, "", { Location: "/login" });
      return serveFile(req, res, "index.html");
    }
    if (url.pathname === "/outlook/manifest.xml") return send(res, 200, outlookManifest(), { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": 'attachment; filename="gf-tracker-outlook.xml"', "Cache-Control": "no-store" });
    if (url.pathname.startsWith("/outlook/")) {
      // Aufgabenbereich läuft innerhalb von Outlook: Einbetten durch Outlook erlauben, Office.js von Microsoft laden
      return serveFile(req, res, decodeURIComponent(url.pathname).replace(/^\/+/, ""), { "X-Frame-Options": undefined,
        "Content-Security-Policy": "default-src 'self'; script-src 'self' https://appsforoffice.microsoft.com https://*.office.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src https://*.office.com https://*.microsoft.com; frame-ancestors 'self' https://outlook.office.com https://outlook.office365.com https://outlook.live.com https://*.officeapps.live.com https://*.office.com https://*.microsoft.com; base-uri 'none'" });
    }
    const calm = url.pathname.match(/^\/cal\/([A-Za-z0-9_-]{20,64})\.ics$/);
    if (calm && (req.method === "GET" || req.method === "HEAD")) {
      const row = store.db.prepare("SELECT local_id FROM sync_map WHERE kind = 'icstoken' AND remote_id = ?").get(calm[1]); const u = row && userById(row.local_id);
      if (!u || !u.active) return send(res, 404, "Kalender nicht gefunden", { "Content-Type": "text/plain; charset=utf-8" });
      res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": `inline; filename="gf-tracker.ics"`, "X-Content-Type-Options": "nosniff" });
      return res.end(req.method === "HEAD" ? undefined : calendarFeed(u, url.searchParams.get("scope") === "team"));
    }
    if (url.pathname === "/auth/microsoft") {
      if (!m365.settings().sso) return send(res, 302, "", { Location: "/login" });
      return send(res, 302, "", { Location: m365.ssoStart(safeNext(url.searchParams.get("next"))) });
    }
    if (url.pathname === "/auth/microsoft/callback") {
      try { const cookie = await m365.ssoCallback(url); return send(res, 302, "", { Location: cookie.next || "/", "Set-Cookie": String(cookie) }); }
      catch (e) { return send(res, 302, "", { Location: `/login?sso=${encodeURIComponent(e.code === "unknown" ? `Für ${e.email || "dieses Konto"} gibt es noch keinen Zugang im GF Tracker. Bitte an die Administration wenden.` : e.message)}` }); }
    }
    if (url.pathname === "/brand/logo") {
      const n = store.meta("brandLogo"); const f = n && path.join(CFG.dataDir, n); if (!f || !fs.existsSync(f)) return send(res, 404, "Kein Logo", { "Content-Type": "text/plain; charset=utf-8" });
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": Object.entries(LOGO_TYPES).find(([, e]) => n.endsWith(`.${e}`))[0], "Cache-Control": "public, max-age=86400", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
      return fs.createReadStream(f).pipe(res);
    }
    if (url.pathname === "/manifest.webmanifest") { // App-Name und Farbe aus dem Erscheinungsbild
      const mf = JSON.parse(fs.readFileSync(path.join(PUBLIC, "manifest.webmanifest"), "utf8")); const b = brand();
      Object.assign(mf, { name: b.appName === "GF Tracker" ? `GF Tracker${CFG.company !== "GF Tracker" ? ` – ${CFG.company}` : ""}` : b.appName, short_name: b.appName, theme_color: b.color });
      return send(res, 200, JSON.stringify(mf), { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" });
    }
    if (url.pathname === "/login") return serveFile(req, res, "login.html");
    // Microsoft Teams: Reiter, Konfiguration, Anmelde-Popup und die App selbst – dürfen in Teams eingebettet werden
    if (url.pathname === "/teams/auth-start") { const sso = m365.settings().sso; return send(res, 302, "", { Location: sso ? `/auth/microsoft?next=${encodeURIComponent("/teams/auth-end")}` : `/login?next=${encodeURIComponent("/teams/auth-end")}` }); }
    if (["/teams/tab", "/teams/config", "/teams/auth-end"].includes(url.pathname)) return serveFile(req, res, "teams.html", TEAMS_HEADERS);
    if (url.pathname === "/teams/app") return serveFile(req, res, "index.html", TEAMS_HEADERS);
    if (url.pathname === "/password") return serveFile(req, res, "password.html", { "Referrer-Policy": "no-referrer" });
    if (url.pathname === "/portal" || url.pathname.startsWith("/portal/")) {
      // Das Portal darf auf freigegebenen Websites eingebettet werden; die App selbst nie.
      const frame = CFG.portalFrameAncestors.length ? { "Content-Security-Policy": SECURITY_HEADERS["Content-Security-Policy"].replace("frame-ancestors 'none'", `frame-ancestors 'self' ${CFG.portalFrameAncestors.join(" ")}`), "X-Frame-Options": undefined } : {};
      return serveFile(req, res, "portal.html", frame);
    }
    return serveFile(req, res, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    log("Fehler:", e.stack || e); return send(res, 500, { error: "Interner Serverfehler." });
  }
});

setupInitialData();
deadlineJob(); backupJob();
setInterval(() => { try { deadlineJob(); } catch (e) { log("Fristenprüfung:", e.message); } try { automationJob(); } catch (e) { log("Automatik:", e.message); ilog("automation", "error", e.message); } notificationMailJob().catch((e) => log("Mail-Job:", e.message)); teamsNotifyJob().catch((e) => log("Teams-Job:", e.message)); }, Number(env.JOB_INTERVAL_MS) || 60e3).unref();
setInterval(() => { backupJob(); sessions.cleanup(); accounts.cleanup(); ops.cleanup(); automation.cleanup(); }, 60 * 60e3).unref();
server.listen(CFG.port, CFG.host, () => log(`GF Tracker läuft auf ${CFG.appUrl} (Port ${CFG.port}) · Daten: ${CFG.dataDir} · E-Mail: ${mailer.configured ? "aktiv" : "nicht eingerichtet"}`));
const shutdown = () => { log("Beende…"); for (const c of clients) c.res.end(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
