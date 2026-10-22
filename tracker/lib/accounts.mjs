// Zugänge verwalten: Einladung per Link, „Passwort vergessen“, Übersicht für die Administration.
// Links enthalten ein Zufalls-Token; gespeichert wird nur dessen SHA-256-Hash. Ein Link gilt einmal.
import { sha256, randomToken, hashPassword, validatePassword } from "./auth.mjs";
import { mailTemplate } from "./mailer.mjs";

const TTL = { invite: 7 * 864e5, reset: 60 * 60e3 };

export class Accounts {
  constructor({ store, sessions, mailer, cfg, userById, log }) {
    Object.assign(this, { store, sessions, mailer, cfg, userById, log });
    const q = (sql) => store.db.prepare(sql);
    this.s = {
      insert: q("INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)"),
      drop: q("DELETE FROM auth_tokens WHERE user_id = ? AND kind = ? AND used_at IS NULL"),
      get: q("SELECT * FROM auth_tokens WHERE token_hash = ?"),
      use: q("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?"),
      cleanup: q("DELETE FROM auth_tokens WHERE expires_at < ?"),
      account: q("SELECT user_id, last_login FROM accounts WHERE user_id = ?"),
      byEmail: q("SELECT user_id FROM accounts WHERE email = ?"),
      setPw: q("UPDATE accounts SET password_hash = ? WHERE user_id = ?"),
      addAcc: q("INSERT INTO accounts (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)"),
      overview: q("SELECT a.user_id, a.last_login, (SELECT COUNT(*) FROM sessions s WHERE s.user_id = a.user_id AND s.expires_at > ?) AS sessions FROM accounts a"),
      invites: q("SELECT user_id, MAX(expires_at) AS expires_at FROM auth_tokens WHERE kind = 'invite' AND used_at IS NULL AND expires_at > ? GROUP BY user_id"),
    };
  }

  /** Neuer Link; ältere, unbenutzte Links derselben Art werden ungültig. */
  issue(userId, kind, createdBy = null) {
    const token = randomToken(); const now = Date.now();
    this.store.tx(() => { this.s.drop.run(userId, kind); this.s.insert.run(sha256(token), userId, kind, now + TTL[kind], now, createdBy); });
    return { token, link: `${this.cfg.appUrl}/password?t=${token}`, expiresAt: now + TTL[kind] };
  }

  /** Prüft einen Link und liefert Art und Person (für die Seite „Passwort festlegen“). */
  check(token) {
    const row = token && this.s.get.get(sha256(String(token)));
    const user = row && this.userById(row.user_id);
    if (!row || row.used_at || row.expires_at < Date.now() || !user || !user.active)
      return { valid: false, reason: row?.used_at ? "Dieser Link wurde bereits verwendet." : "Dieser Link ist abgelaufen oder ungültig. Bitte einen neuen anfordern." };
    return { valid: true, kind: row.kind, user, row };
  }

  /** Passwort über den Link setzen: legt den Zugang bei einer Einladung an, meldet alle anderen Sitzungen ab. */
  redeem(token, password) {
    const c = this.check(token); if (!c.valid) throw Object.assign(new Error(c.reason), { status: 410 });
    const err = validatePassword(password); if (err) throw Object.assign(new Error(err), { status: 400 });
    const h = hashPassword(password); const u = c.user;
    this.store.tx(() => {
      if (this.s.account.get(u.id)) this.s.setPw.run(h, u.id);
      else {
        const other = this.s.byEmail.get(u.email.toLowerCase()); if (other && other.user_id !== u.id) throw Object.assign(new Error("Diese E-Mail-Adresse hat bereits einen anderen Zugang."), { status: 409 });
        this.s.addAcc.run(u.id, u.email.toLowerCase(), h, new Date().toISOString());
      }
      this.s.use.run(Date.now(), c.row.token_hash);
    });
    this.sessions.destroyUser(u.id);
    this.log(`${c.kind === "invite" ? "Einladung angenommen" : "Passwort zurückgesetzt"}: ${u.email}`);
    return u;
  }

  /** Einladung erzeugen und – wenn E-Mail eingerichtet ist – verschicken. Der Link wird immer zurückgegeben. */
  async invite(user, by) {
    const t = this.issue(user.id, "invite", by.id); let mailed = false, mailError = null;
    const hasAccount = !!this.s.account.get(user.id); // dann ist es ein Link zum Zurücksetzen
    if (this.mailer.configured) {
      try {
        await this.mailer.send({ to: user.email, subject: hasAccount ? "Neues Passwort festlegen – GF Tracker" : `Einladung zum GF Tracker – ${this.cfg.company}`, html: mailTemplate({
          company: this.cfg.company, greeting: `Hallo ${user.name},`, title: hasAccount ? "Neues Passwort festlegen" : "Sie wurden zum GF Tracker eingeladen.",
          lines: [hasAccount ? `${by.name} hat für Sie einen Link zum Festlegen eines neuen Passworts erstellt.` : `${by.name} hat für Sie einen Zugang angelegt. Legen Sie über den Knopf Ihr Passwort fest – danach können Sie sofort loslegen.`, "Der Link gilt 7 Tage und nur einmal."],
          button: { url: t.link, label: "Passwort festlegen" }, footer: "Sie haben diese E-Mail nicht erwartet? Dann können Sie sie ignorieren." }) });
        mailed = true;
      } catch (e) { mailError = e.message; }
    }
    this.log(`${hasAccount ? "Passwort-Link" : "Einladung"} für ${user.email} erstellt durch ${by.email}${mailed ? " (per E-Mail)" : ""}`);
    return { link: t.link, expiresAt: t.expiresAt, mailed, mailError };
  }

  /** „Passwort vergessen“: verrät nie, ob es die Adresse gibt. */
  async forgot(email) {
    const acc = this.s.byEmail.get(String(email).toLowerCase()); const u = acc && this.userById(acc.user_id);
    if (!u || !u.active || !this.mailer.configured) { if (u && !this.mailer.configured) this.log(`Passwort vergessen angefragt für ${u.email} – E-Mail nicht eingerichtet`); return; }
    const t = this.issue(u.id, "reset");
    await this.mailer.send({ to: u.email, subject: `Passwort zurücksetzen – GF Tracker`, html: mailTemplate({
      company: this.cfg.company, greeting: `Hallo ${u.name},`, title: "Neues Passwort festlegen",
      lines: ["Für Ihren Zugang wurde ein neues Passwort angefordert. Der Link gilt 60 Minuten und nur einmal."],
      button: { url: t.link, label: "Neues Passwort festlegen" }, footer: "Sie haben das nicht angefordert? Dann ignorieren Sie diese E-Mail – Ihr Passwort bleibt unverändert." }) });
    this.log(`Passwort-Link verschickt an ${u.email}`);
  }

  /** Je Person: Zugang vorhanden, letzte Anmeldung, aktive Sitzungen, offene Einladung. */
  overview() {
    const now = Date.now(); const out = {};
    for (const r of this.s.overview.all(now)) out[r.user_id] = { account: true, lastLogin: r.last_login, sessions: r.sessions };
    for (const r of this.s.invites.all(now)) out[r.user_id] = { ...(out[r.user_id] || { account: false, sessions: 0 }), inviteUntil: r.expires_at };
    return out;
  }

  cleanup() { this.s.cleanup.run(Date.now() - 30 * 864e5); }
}
