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
`;

export const COLLECTIONS = ["users", "teams", "projects", "sprints", "issues", "filters", "notifications"];

export class Store {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(SCHEMA);
    const q = (sql) => this.db.prepare(sql);
    this.s = {
      getMeta: q("SELECT value FROM meta WHERE key = ?"),
      setMeta: q("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
      get: q("SELECT data, deleted FROM entities WHERE type = ? AND id = ?"),
      all: q("SELECT data FROM entities WHERE type = ? AND deleted = 0"),
      put: q("INSERT INTO entities (type, id, data, rev, deleted) VALUES (?, ?, ?, ?, 0) ON CONFLICT(type, id) DO UPDATE SET data = excluded.data, rev = excluded.rev, deleted = 0"),
      del: q("UPDATE entities SET deleted = 1, rev = ? WHERE type = ? AND id = ?"),
      since: q("SELECT type, id, data, deleted FROM entities WHERE rev > ? ORDER BY rev"),
      counter: q("SELECT next_no FROM counters WHERE project_id = ?"),
      setCounter: q("INSERT INTO counters (project_id, next_no) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET next_no = excluded.next_no"),
    };
  }

  tx(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try { const r = fn(); this.db.exec("COMMIT"); return r; } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  meta(key, value) {
    if (value === undefined) return this.s.getMeta.get(key)?.value ?? null;
    this.s.setMeta.run(key, String(value));
  }

  rev() { return Number(this.meta("rev") || 0); }
  bump() { const r = this.rev() + 1; this.meta("rev", r); return r; }

  /** Liefert das Objekt oder null; mit includeDeleted auch gelöschte (für Duplikatprüfung). */
  get(type, id, includeDeleted = false) {
    const row = this.s.get.get(type, id);
    if (!row || (row.deleted && !includeDeleted)) return null;
    return JSON.parse(row.data);
  }
  all(type) { return this.s.all.all(type).map((r) => JSON.parse(r.data)); }
  put(type, obj) { const rev = this.bump(); this.s.put.run(type, obj.id, JSON.stringify(obj), rev); return rev; }
  del(type, id) { const rev = this.bump(); this.s.del.run(rev, type, id); return rev; }
  since(rev) { return this.s.since.all(rev).map((r) => ({ type: r.type, id: r.id, data: JSON.parse(r.data), deleted: !!r.deleted })); }

  /** Vergibt die nächste freie Vorgangsnummer eines Projekts (eindeutig, auch bei gleichzeitigen Anlagen). */
  reserveNumber(projectId) {
    const used = this.all("issues").filter((i) => i.projectId === projectId).reduce((m, i) => Math.max(m, i.no || 0), 0);
    const next = Math.max(Number(this.s.counter.get(projectId)?.next_no || 1), used + 1);
    this.s.setCounter.run(projectId, next + 1);
    return next;
  }

  backup(file) { this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
}
