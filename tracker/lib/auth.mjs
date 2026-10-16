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
      insert: q("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"),
      get: q("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?"),
      touch: q("UPDATE sessions SET expires_at = ? WHERE token_hash = ?"),
      del: q("DELETE FROM sessions WHERE token_hash = ?"),
      delUser: q("DELETE FROM sessions WHERE user_id = ?"),
      cleanup: q("DELETE FROM sessions WHERE expires_at < ?"),
    };
  }
  create(userId) {
    const token = randomToken(); const exp = Date.now() + SESSION_DAYS * 864e5;
    this.s.insert.run(sha256(token), userId, exp, Date.now());
    return this.cookie(token, exp);
  }
  /** Prüft das Sitzungscookie; verlängert die Sitzung, wenn weniger als die Hälfte übrig ist. */
  resolve(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE]; if (!token) return null;
    const h = sha256(token); const row = this.s.get.get(h);
    if (!row || row.expires_at < Date.now()) return null;
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
