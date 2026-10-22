// Anmeldung: Passwörter mit scrypt (Node-Bordmittel), Sitzungen als zufälliges
// Token im HttpOnly-Cookie; in der Datenbank liegt nur der SHA-256-Hash.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const COOKIE = "gft_session";
const SESSION_DAYS = 14;
const SCRYPT = { N: 16384, r: 8, p: 1 };

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 10) return "Das Passwort muss mindestens 10 Zeichen lang sein.";
  if (pw.length > 200) return "Das Passwort ist zu lang.";
  return null;
}

export function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((p) => p.trim().split("=")).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]));
}

export class Sessions {
  constructor(store, { secureCookies }) {
    this.store = store; this.secure = secureCookies;
    const q = (sql) => store.db.prepare(sql);
    this.s = {
      insert: q("INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen, ip, agent) VALUES (?, ?, ?, ?, ?, ?, ?)"),
      get: q("SELECT user_id, expires_at, last_seen FROM sessions WHERE token_hash = ?"),
      seen: q("UPDATE sessions SET last_seen = ? WHERE token_hash = ?"),
      list: q("SELECT token_hash, created_at, last_seen, ip, agent, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen DESC"),
      login: q("UPDATE accounts SET last_login = ? WHERE user_id = ?"),
      touch: q("UPDATE sessions SET expires_at = ? WHERE token_hash = ?"),
      del: q("DELETE FROM sessions WHERE token_hash = ?"),
      delUser: q("DELETE FROM sessions WHERE user_id = ?"),
      cleanup: q("DELETE FROM sessions WHERE expires_at < ?"),
    };
  }
  /** Neue Sitzung; `req` liefert Gerät und IP für die Sitzungsübersicht. */
  create(userId, req = null, ip = null) {
    const token = randomToken(); const now = Date.now(); const exp = now + SESSION_DAYS * 864e5;
    this.s.insert.run(sha256(token), userId, exp, now, now, ip, req ? String(req.headers["user-agent"] || "").slice(0, 300) : null);
    this.s.login.run(now, userId);
    return this.cookie(token, exp);
  }
  /** Aktive Sitzungen einer Person – `id` ist ein Kürzel des Hashs, nie das Token selbst. */
  list(userId, currentHash) {
    return this.s.list.all(userId, Date.now()).map((r) => ({ id: r.token_hash.slice(0, 16), createdAt: r.created_at, lastSeen: r.last_seen || r.created_at, ip: r.ip, device: describeAgent(r.agent), current: r.token_hash === currentHash }));
  }
  revoke(userId, id) {
    const row = this.s.list.all(userId, Date.now()).find((r) => r.token_hash.slice(0, 16) === id); if (!row) return false;
    this.s.del.run(row.token_hash); return true;
  }
  /** Prüft das Sitzungscookie; verlängert die Sitzung, wenn weniger als die Hälfte übrig ist. */
  resolve(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE]; if (!token) return null;
    const h = sha256(token); const row = this.s.get.get(h);
    if (!row || row.expires_at < Date.now()) return null;
    if (Date.now() - (row.last_seen || 0) > 5 * 60e3) this.s.seen.run(Date.now(), h); // höchstens alle 5 Minuten schreiben
    let setCookie = null;
    if (row.expires_at - Date.now() < (SESSION_DAYS / 2) * 864e5) { const exp = Date.now() + SESSION_DAYS * 864e5; this.s.touch.run(exp, h); setCookie = this.cookie(token, exp); }
    return { userId: row.user_id, tokenHash: h, setCookie };
  }
  destroy(req) { const token = parseCookies(req.headers.cookie)[COOKIE]; if (token) this.s.del.run(sha256(token)); return this.cookie("", 0); }
  destroyUser(userId) { this.s.delUser.run(userId); }
  cleanup() { this.s.cleanup.run(Date.now()); }
  cookie(token, exp) {
    return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax${this.secure ? "; Secure" : ""}; ${exp ? `Expires=${new Date(exp).toUTCString()}` : "Max-Age=0"}`;
  }
}

/** „Chrome auf Windows“ statt des vollständigen User-Agent. */
export function describeAgent(ua) {
  if (!ua) return "Unbekanntes Gerät";
  const b = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Outlook|Microsoft Office/.test(ua) ? "Outlook" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${b} auf ${os}` : b;
}

/** Einfache Bremse gegen Passwort-Raten: max. 10 Fehlversuche pro 15 Minuten je IP+E-Mail. */
export class RateLimiter {
  constructor(max, windowMs) { this.max = max; this.window = windowMs; this.hits = new Map(); }
  check(key) {
    const now = Date.now(); const list = (this.hits.get(key) || []).filter((t) => now - t < this.window);
    this.hits.set(key, list); return list.length < this.max;
  }
  hit(key) { const list = this.hits.get(key) || []; list.push(Date.now()); this.hits.set(key, list); }
  reset(key) { this.hits.delete(key); }
}
