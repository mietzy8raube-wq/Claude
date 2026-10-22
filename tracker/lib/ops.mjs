// Betrieb: Audit-Protokoll, Sicherungen (Datenbank + Dateien), Systemstatus für die Administration.
import fs from "node:fs";
import path from "node:path";

export const AUDIT_ACTIONS = {
  "login": "Anmeldung", "login.failed": "Anmeldung fehlgeschlagen", "logout": "Abmeldung",
  "password.changed": "Eigenes Passwort geändert", "password.link": "Passwort über Link festgelegt", "password.admin": "Passwort durch Administration gesetzt",
  "user.created": "Person angelegt", "user.invited": "Einladung/Link erstellt", "user.role": "Rolle geändert", "user.active": "Person aktiviert/deaktiviert", "user.logout": "Auf allen Geräten abgemeldet", "user.import": "Personen importiert",
  "delete": "Gelöscht", "project.created": "Projekt angelegt",
  "apikey.created": "API-Schlüssel erstellt", "apikey.revoked": "API-Schlüssel widerrufen", "webhook": "Webhook geändert", "settings": "Einstellungen geändert",
  "backup.download": "Sicherung heruntergeladen", "backup.created": "Sicherung erstellt", "backup.restore": "Sicherung eingespielt", "rules": "Automatik-Regeln geändert",
};

export function createOps({ store, cfg, log, filesDir, version, extra = () => ({}) }) {
  const BK = path.join(cfg.dataDir, "backups"); const BKF = path.join(BK, "files");
  fs.mkdirSync(BKF, { recursive: true });
  const ins = store.db.prepare("INSERT INTO audit_log (at, user_id, user_name, action, detail, ip) VALUES (?, ?, ?, ?, ?, ?)");

  /** Eintrag ins Audit-Protokoll; Fehler hier dürfen nie die eigentliche Aktion stören. */
  function audit(user, action, detail = "", ip = null) {
    try { ins.run(Date.now(), user?.id || null, user?.name || user?.email || null, action, String(detail).slice(0, 500), ip); } catch (e) { log("Audit:", e.message); }
  }
  function auditList({ q = "", before = 0, limit = 100, action = "" } = {}) {
    const where = ["1=1"]; const args = [];
    if (before) { where.push("id < ?"); args.push(before); }
    if (action) { where.push("action LIKE ?"); args.push(`${action}%`); }
    if (q) { where.push("(detail LIKE ? OR user_name LIKE ? OR ip LIKE ?)"); args.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    return store.db.prepare(`SELECT id, at, user_id, user_name, action, detail, ip FROM audit_log WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`).all(...args, Math.min(500, limit));
  }

  /** Dateien sind unveränderlich (Name = ID) – daher reicht ein Spiegel, der nur neue Dateien kopiert. */
  function mirrorFiles() {
    let copied = 0;
    for (const f of fs.readdirSync(filesDir)) {
      const dst = path.join(BKF, f); if (fs.existsSync(dst)) continue;
      fs.copyFileSync(path.join(filesDir, f), dst); copied++;
    }
    return copied;
  }
  const dbBackups = () => fs.readdirSync(BK).filter((f) => /^tracker-[\d-]+(T[\d-]+)?\.db$/.test(f)).sort();
  /** Tagessicherung (oder sofort mit `force`): Datenbank-Kopie + Dateispiegel, alte Kopien aufräumen. */
  function backup({ force = false } = {}) {
    const day = new Date().toISOString().slice(0, 10);
    const name = force ? `tracker-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.db` : `tracker-${day}.db`;
    const file = path.join(BK, name); if (!force && fs.existsSync(file)) return null;
    const t0 = Date.now(); store.backup(file); const copied = mirrorFiles();
    const files = dbBackups(); for (const f of files.slice(0, Math.max(0, files.length - cfg.backupKeep))) fs.unlinkSync(path.join(BK, f));
    store.meta("lastBackup", JSON.stringify({ at: Date.now(), file: name, ms: Date.now() - t0, copied }));
    log(`Sicherung erstellt: ${file} (${copied} neue Dateien gespiegelt)`);
    return { file: name, copied };
  }
  const backupPath = (name) => (/^tracker-[\dT-]+\.db$/.test(name) && fs.existsSync(path.join(BK, name)) ? path.join(BK, name) : null);

  function dirSize(dir) { let n = 0, bytes = 0; try { for (const f of fs.readdirSync(dir)) { const st = fs.statSync(path.join(dir, f)); if (st.isFile()) { n++; bytes += st.size; } } } catch {} return { count: n, bytes }; }
  const size = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };

  function status() {
    const dbFile = path.join(cfg.dataDir, "tracker.db"); const mem = process.memoryUsage();
    let disk = null; try { const s = fs.statfsSync(cfg.dataDir); disk = { free: s.bavail * s.bsize, total: s.blocks * s.bsize }; } catch {}
    const counts = {}; for (const t of ["users", "teams", "customers", "projects", "issues", "notifications"]) counts[t] = store.count(t);
    const now = Date.now();
    return {
      version, schema: store.schema, node: process.version, startedAt: now - Math.round(process.uptime() * 1000), rev: store.rev(),
      memory: { rss: mem.rss, heap: mem.heapUsed }, disk,
      db: { bytes: size(dbFile), wal: size(dbFile + "-wal") }, files: dirSize(filesDir), counts,
      backups: { list: dbBackups().reverse().map((f) => ({ name: f, bytes: size(path.join(BK, f)), at: fs.statSync(path.join(BK, f)).mtimeMs })), mirror: dirSize(BKF), last: JSON.parse(store.meta("lastBackup") || "null"), keep: cfg.backupKeep },
      sessions: store.db.prepare("SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM sessions WHERE expires_at > ?").get(now),
      activeToday: store.db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE last_seen > ?").get(now - 864e5).n,
      webhooks: store.db.prepare("SELECT SUM(done = 0) AS pending, SUM(done = 2) AS failed FROM webhook_queue").get(),
      errors: store.db.prepare("SELECT at, source, message FROM integration_log WHERE level = 'error' AND at > ? ORDER BY id DESC LIMIT 10").all(now - 7 * 864e5),
      ...extra(),
    };
  }
  /** Audit-Einträge nach 2 Jahren löschen. */
  function cleanup() { store.db.prepare("DELETE FROM audit_log WHERE at < ?").run(Date.now() - 730 * 864e5); }

  return { audit, auditList, backup, backupPath, status, cleanup };
}
