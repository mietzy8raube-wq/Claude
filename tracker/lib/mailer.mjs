// E-Mail-Versand über Microsoft 365 (Microsoft Graph, Anwendungsberechtigung
// "Mail.Send"). Ohne Konfiguration werden keine E-Mails versendet – die
// Anwendung funktioniert trotzdem vollständig (Benachrichtigungen in der App).
export class Mailer {
  constructor(cfg) {
    this.cfg = cfg; this.token = null;
    this.loginHost = (cfg.loginHost || "https://login.microsoftonline.com").replace(/\/$/, "");
    this.graph = (cfg.graphBase || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  }
  get configured() { return Boolean(this.cfg.tenantId && this.cfg.clientId && this.cfg.clientSecret && this.cfg.sender); }

  async accessToken() {
    if (this.token && this.token.exp - Date.now() > 5 * 60e3) return this.token.value;
    const res = await fetch(`${this.loginHost}/${this.cfg.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, grant_type: "client_credentials", scope: `${new URL(this.graph).origin}/.default` }),
    });
    if (!res.ok) throw new Error(`Microsoft-Anmeldung fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    this.token = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
    return this.token.value;
  }

  async send({ to, subject, html }) {
    if (!this.configured) return false;
    const res = await fetch(`${this.graph}/users/${encodeURIComponent(this.cfg.sender)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: false }),
    });
    if (!res.ok && res.status !== 202) throw new Error(`E-Mail an ${to} fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return true;
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Schlichte, in Outlook gut lesbare HTML-Vorlage. */
export function mailTemplate({ company, greeting, title, lines = [], items = [], button, footer }) {
  return `<!doctype html><html lang="de"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#172b4d">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #dcdfe4">
<tr><td style="padding:22px 26px 6px;font-size:13px;color:#626f86">${esc(company)}</td></tr>
${greeting ? `<tr><td style="padding:0 26px 6px;font-size:15px">${esc(greeting)}</td></tr>` : ""}
<tr><td style="padding:2px 26px 6px;font-size:17px;font-weight:600;line-height:1.4">${esc(title)}</td></tr>
${lines.map((l) => `<tr><td style="padding:4px 26px;font-size:14px;line-height:1.55;color:#44546f;white-space:pre-wrap">${esc(l)}</td></tr>`).join("")}
${items.length ? `<tr><td style="padding:6px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items.map((it) => `<tr><td style="padding:9px 0;border-bottom:1px solid #eef0f3"><a href="${esc(it.url)}" style="color:#0c66e4;font-weight:600;text-decoration:none;font-size:14px">${esc(it.title)}</a>${it.text ? `<div style="font-size:13px;color:#626f86;margin-top:2px">${esc(it.text)}</div>` : ""}</td></tr>`).join("")}</table></td></tr>` : ""}
${button ? `<tr><td style="padding:18px 26px 24px"><a href="${esc(button.url)}" style="display:inline-block;background:#0c66e4;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">${esc(button.label)}</a></td></tr>` : ""}
${footer ? `<tr><td style="padding:12px 26px;border-top:1px solid #dcdfe4;font-size:12px;color:#8590a2">${esc(footer)}</td></tr>` : ""}
</table></body></html>`;
}
