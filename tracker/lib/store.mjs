// Datenhaltung in SQLite (eingebaut in Node.js, keine Zusatzpakete).
// Alle fachlichen Objekte (Projekte, Vorgänge, Sprints, …) liegen als JSON in
// der Tabelle "entities". Jede Änderung erhöht eine fortlaufende Revision –
// darüber holen sich die Browser nur das, was sich seit ihrem Stand geändert hat.
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS entities (
  type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
  rev INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (type, id)
);
CREATE INDEX IF NOT EXISTS entities_rev ON entities (rev);
CREATE TABLE IF NOT EXISTS counters (project_id TEXT PRIMARY KEY, next_no INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS accounts (
  user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS portal_tokens (token_hash TEXT PRIMARY KEY, issue_id TEXT NOT NULL, token TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS portal_tokens_issue ON portal_tokens (issue_id);
CREATE TABLE IF NOT EXISTS mail_log (notification_id TEXT PRIMARY KEY, sent_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, name TEXT NOT NULL, prefix TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL, created_by TEXT, created_at INTEGER NOT NULL, last_used_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS webhook_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, hook_id TEXT NOT NULL, event TEXT NOT NULL, body TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL, last_error TEXT, done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS webhook_queue_due ON webhook_queue (done, next_at);
CREATE TABLE IF NOT EXISTS integration_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, source TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_map (kind TEXT NOT NULL, local_id TEXT NOT NULL, remote_id TEXT NOT NULL, extra TEXT, PRIMARY KEY (kind, local_id));
`;

export const COLLECTIONS = ["users", "teams", "customers", "absences", "projects", "sprints", "issues", "filters", "notifications"];

export class Store {
  constructor(file, { strict = process.env.STORE_FREEZE === "1" } = {}) {
    this.db = new DatabaseSync(file); this.strict = strict;
    this.db.exec(SCHEMA);
    this.migrate();
    const q = (sql) => this.db.prepare(sql);
    this.s = {
      getMeta: q("SELECT value FROM meta WHERE key = ?"),
      setMeta: q("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
      put: q("INSERT INTO entities (type, id, data, rev, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT(type, id) DO UPDATE SET data = excluded.data, rev = excluded.rev, deleted = 0"),
      del: q("UPDATE entities SET deleted = 1, rev = ? WHERE type = ? AND id = ?"),
      sinceIds: q("SELECT type, id, deleted FROM entities WHERE rev > ? ORDER BY rev"),
      counter: q("SELECT next_no FROM counters WHERE project_id = ?"),
      setCounter: q("INSERT INTO counters (project_id, next_no) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET next_no = excluded.next_no"),
    };
    this.load();
  }

  /** Schema-Änderungen bestehender Datenbanken – nummeriert, jede läuft genau einmal (Stand in meta.schema). */
  migrate() {
    const has = (table, col) => this.db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
    const steps = [
      () => { if (!has("api_keys", "user_id")) this.db.exec("ALTER TABLE api_keys ADD COLUMN user_id TEXT"); },
      () => { // Sitzungsübersicht, letzte Anmeldung, Einladungen und Passwort-Links
        for (const [c, t] of [["last_seen", "INTEGER"], ["ip", "TEXT"], ["agent", "TEXT"]]) if (!has("sessions", c)) this.db.exec(`ALTER TABLE sessions ADD COLUMN ${c} ${t}`);
        if (!has("accounts", "last_login")) this.db.exec("ALTER TABLE accounts ADD COLUMN last_login INTEGER");
        this.db.exec("CREATE TABLE IF NOT EXISTS auth_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, created_by TEXT, used_at INTEGER)");
      },
    ];
    const cur = Number(this.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get()?.value || 0);
    for (let v = cur; v < steps.length; v++) {
      this.db.exec("BEGIN"); try { steps[v](); this.db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(v + 1)); this.db.exec("COMMIT"); }
      catch (e) { this.db.exec("ROLLBACK"); throw new Error(`Datenbank-Umstellung ${v + 1} fehlgeschlagen: ${e.message}`); }
    }
    this.schema = steps.length;
  }

  /** Alle Objekte einmal beim Start einlesen – danach wird nur noch aus dem Arbeitsspeicher gelesen. */
  load() {
    this.live = {}; this.dead = {}; this.issueNo = new Map(); this.maxNo = new Map();
    for (const t of COLLECTIONS) { this.live[t] = new Map(); this.dead[t] = new Map(); }
    for (const r of this.db.prepare("SELECT type, id, data, deleted FROM entities").iterate()) {
      if (!this.live[r.type]) { this.live[r.type] = new Map(); this.dead[r.type] = new Map(); }
      const obj = this.freeze(JSON.parse(r.data)); (r.deleted ? this.dead : this.live)[r.type].set(r.id, obj);
      if (r.type === "issues" && !r.deleted) this.indexIssue(obj);
    }
    this.revNo = Number(this.s.getMeta.get("rev")?.value || 0);
  }
  /** Im Testbetrieb (STORE_FREEZE=1) sind gelesene Objekte unveränderlich – so fallen versehentliche Änderungen ohne put() sofort auf. */
  freeze(o) { if (!this.strict || !o || typeof o !== "object") return o; Object.freeze(o); for (const v of Object.values(o)) this.freeze(v); return o; }
  indexIssue(i) { this.issueNo.set(`${i.projectId}:${i.no}`, i.id); if ((this.maxNo.get(i.projectId) || 0) < i.no) this.maxNo.set(i.projectId, i.no); }

  /** Transaktion: bei einem Fehler werden Datenbank und Arbeitsspeicher zurückgesetzt. */
  tx(fn) {
    if (this.journal) return fn(); // bereits in einer Transaktion
    this.db.exec("BEGIN IMMEDIATE"); this.journal = []; const rev0 = this.revNo;
    try { const r = fn(); this.db.exec("COMMIT"); this.journal = null; return r; }
    catch (e) {
      this.db.exec("ROLLBACK");
      for (const [t, id, live, dead] of this.journal.reverse()) { live ? this.live[t].set(id, live) : this.live[t].delete(id); dead ? this.dead[t].set(id, dead) : this.dead[t].delete(id); }
      this.journal = null; this.revNo = rev0; this.issueNo.clear(); this.maxNo.clear(); for (const i of this.live.issues.values()) this.indexIssue(i);
      throw e;
    }
  }
  remember(type, id) { if (this.journal) this.journal.push([type, id, this.live[type].get(id), this.dead[type].get(id)]); }

  meta(key, value) {
    if (value === undefined) return this.s.getMeta.get(key)?.value ?? null;
    this.s.setMeta.run(key, String(value));
  }

  rev() { return this.revNo; }
  bump() { this.revNo += 1; this.s.setMeta.run("rev", String(this.revNo)); return this.revNo; }

  /** Liefert eine eigene Kopie des Objekts (darf verändert werden) oder null; mit includeDeleted auch gelöschte. */
  get(type, id, includeDeleted = false) {
    const o = this.live[type]?.get(id) || (includeDeleted ? this.dead[type]?.get(id) : null);
    return o ? structuredClone(o) : null;
  }
  /** Alle Objekte eines Typs – nur lesen! Zum Ändern get() verwenden und put() aufrufen. */
  all(type) { return [...(this.live[type]?.values() || [])]; }
  count(type) { return this.live[type]?.size || 0; }
  put(type, obj) {
    const json = JSON.stringify(obj); const rev = this.bump(); this.s.put.run(type, obj.id, json, rev);
    this.remember(type, obj.id); const copy = this.freeze(JSON.parse(json));
    this.live[type].set(obj.id, copy); this.dead[type].delete(obj.id); if (type === "issues") this.indexIssue(copy);
    return rev;
  }
  del(type, id) {
    const rev = this.bump(); this.s.del.run(rev, type, id); this.remember(type, id);
    const o = this.live[type].get(id); if (o) { this.dead[type].set(id, o); this.live[type].delete(id); if (type === "issues") this.issueNo.delete(`${o.projectId}:${o.no}`); }
    return rev;
  }
  /** Änderungen seit einer Revision (Inhalte aus dem Arbeitsspeicher). */
  since(rev) {
    return this.s.sinceIds.all(rev).map((r) => { const d = !!r.deleted; const o = d ? this.dead[r.type]?.get(r.id) : this.live[r.type]?.get(r.id); return o === undefined && !d ? null : { type: r.type, id: r.id, data: o, deleted: d }; }).filter(Boolean);
  }
  issueByNo(projectId, no) { const id = this.issueNo.get(`${projectId}:${no}`); return id ? this.live.issues.get(id) : null; }

  /** Vergibt die nächste freie Vorgangsnummer eines Projekts (eindeutig, auch bei gleichzeitigen Anlagen). */
  reserveNumber(projectId) {
    const next = Math.max(Number(this.s.counter.get(projectId)?.next_no || 1), (this.maxNo.get(projectId) || 0) + 1);
    this.s.setCounter.run(projectId, next + 1);
    return next;
  }

  backup(file) { this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
}
