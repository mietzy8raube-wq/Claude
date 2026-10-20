// E-Mail-Versand über Microsoft 365 (Microsoft Graph, Anwendungsberechtigung
// "Mail.Send"). Ohne Konfiguration werden keine E-Mails versendet – die
// Anwendung funktioniert trotzdem vollständig (Benachrichtigungen in der App).
export class Mailer {
  constructor(cfg) {
    this.cfg = cfg; this.token = null;
    this.loginHost = (cfg.loginHost || "https://login.microsoftonline.com").replace(/\/$/, "");
    this.graphBase = (cfg.graphBase || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  }
  get configured() { return Boolean(this.cfg.tenantId && this.cfg.clientId && this.cfg.clientSecret && this.cfg.sender); }
  /** App-Anmeldung möglich (für Postfach, Kalender) – unabhängig vom Absender. */
  get appConfigured() { return Boolean(this.cfg.tenantId && this.cfg.clientId && this.cfg.clientSecret); }

  /** Allgemeiner Graph-Aufruf mit App-Token; liefert JSON (oder null bei leerer Antwort). */
  async graph(method, path, body, headers = {}) {
    const res = await fetch(`${this.graphBase}${path}`, { method, headers: { Authorization: `Bearer ${await this.accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20e3) });
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`Microsoft Graph ${method} ${path.split("?")[0]} → ${res.status}: ${text.slice(0, 300)}`), { status: res.status });
    return text ? JSON.parse(text) : null;
  }

  async accessToken() {
    if (this.token && this.token.exp - Date.now() > 5 * 60e3) return this.token.value;
    const res = await fetch(`${this.loginHost}/${this.cfg.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, grant_type: "client_credentials", scope: `${new URL(this.graphBase).origin}/.default` }),
    });
    if (!res.ok) throw new Error(`Microsoft-Anmeldung fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const body = await res.json();
    this.token = { value: body.access_token, exp: Date.now() + body.expires_in * 1000 };
    return this.token.value;
  }

  /**
   * E-Mail über das Absenderpostfach senden.
   * replyTo: Antworten gehen an diese Adresse (Service-Postfach → landen im Vorgang)
   * saveToSent: in „Gesendete Elemente“ ablegen (Kundenkorrespondenz bleibt in Outlook nachvollziehbar)
   * headers: eigene Kopfzeilen (müssen mit X- beginnen), z. B. X-GFT-Issue
   */
  async send({ to, subject, html, replyTo, saveToSent = false, headers = {}, attachments = [] }) {
    if (!this.configured) return false;
    const message = { subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: to } }] };
    if (replyTo && replyTo.toLowerCase() !== String(this.cfg.sender).toLowerCase()) message.replyTo = [{ emailAddress: { address: replyTo } }];
    const h = Object.entries(headers).filter(([k, v]) => /^X-[A-Za-z0-9-]+$/.test(k) && v); if (h.length) message.internetMessageHeaders = h.map(([name, value]) => ({ name, value: String(value).slice(0, 200) }));
    if (attachments.length) message.attachments = attachments.map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: a.name, contentType: a.contentType || "application/octet-stream", contentBytes: Buffer.from(a.content).toString("base64") }));
    const res = await fetch(`${this.graphBase}/users/${encodeURIComponent(this.cfg.sender)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: !!saveToSent }),
    });
    if (!res.ok && res.status !== 202) throw new Error(`E-Mail an ${to} fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return true;
  }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * HTML-Vorlage, die in allen Outlook-Varianten sauber aussieht: klassisches Outlook für
 * Windows (Word-Darstellung – daher Tabellenlayout und VML-Schaltfläche), neues Outlook,
 * Outlook im Web und mobil (inkl. Dunkelmodus) sowie andere Mailprogramme.
 * preheader: Vorschautext in der Nachrichtenliste.
 */
export function mailTemplate({ company, greeting, title, lines = [], items = [], button, footer, preheader, replyHint }) {
  const font = "font-family:'Segoe UI',Calibri,Arial,sans-serif";
  const btn = button ? `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(button.url)}" style="height:40px;v-text-anchor:middle;width:${Math.max(180, button.label.length * 9 + 40)}px;" arcsize="15%" stroke="f" fillcolor="#0c66e4"><w:anchorlock/><center style="color:#ffffff;${font};font-size:14px;font-weight:bold;">${esc(button.label)}</center></v:roundrect><![endif]--><!--[if !mso]><!-- --><a href="${esc(button.url)}" style="display:inline-block;background:#0c66e4;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;${font};font-size:14px;font-weight:600;mso-hide:all">${esc(button.label)}</a><!--<![endif]-->` : "";
  const pre = preheader || lines[0] || title;
  return `<!doctype html><html lang="de" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>table,td{border-collapse:collapse}</style><![endif]-->
<style>@media (prefers-color-scheme: dark){.bg{background:#1b1f23!important}.card{background:#22272b!important;border-color:#3b4249!important}.tx{color:#dee4ea!important}.mu{color:#9fadbc!important}.ln{color:#85b8ff!important}.ft{border-color:#3b4249!important}}
[data-ogsc] .card{background:#22272b!important}[data-ogsc] .tx{color:#dee4ea!important}[data-ogsc] .mu{color:#9fadbc!important}</style></head>
<body class="bg" style="margin:0;padding:0;background:#f4f5f7;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f5f7">${esc(String(pre).slice(0, 140))}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="bg" style="background:#f4f5f7"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="card" style="max-width:600px;background:#ffffff;border:1px solid #dcdfe4;border-radius:8px">
<tr><td class="mu" style="padding:22px 28px 6px;${font};font-size:13px;color:#626f86">${esc(company)}</td></tr>
${greeting ? `<tr><td class="tx" style="padding:0 28px 6px;${font};font-size:15px;color:#172b4d">${esc(greeting)}</td></tr>` : ""}
<tr><td class="tx" style="padding:2px 28px 8px;${font};font-size:18px;font-weight:600;line-height:1.4;color:#172b4d">${esc(title)}</td></tr>
${lines.filter(Boolean).map((l) => `<tr><td class="mu" style="padding:4px 28px;${font};font-size:14px;line-height:1.55;color:#44546f;white-space:pre-wrap">${esc(l)}</td></tr>`).join("")}
${items.length ? `<tr><td style="padding:6px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${items.map((it) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f3;${font}"><a class="ln" href="${esc(it.url)}" style="color:#0c66e4;font-weight:600;text-decoration:none;font-size:14px">${esc(it.title)}</a>${it.text ? `<div class="mu" style="font-size:13px;color:#626f86;margin-top:2px">${esc(it.text)}</div>` : ""}</td></tr>`).join("")}</table></td></tr>` : ""}
${btn ? `<tr><td style="padding:18px 28px 6px">${btn}</td></tr>` : ""}
${replyHint ? `<tr><td class="mu" style="padding:14px 28px 4px;${font};font-size:13px;color:#626f86">↩ ${esc(replyHint)}</td></tr>` : ""}
<tr><td style="padding:12px 0 0"></td></tr>
${footer ? `<tr><td class="mu ft" style="padding:12px 28px 18px;border-top:1px solid #dcdfe4;${font};font-size:12px;color:#8590a2">${esc(footer)}</td></tr>` : ""}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
