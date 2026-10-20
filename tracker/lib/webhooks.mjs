// Ausgehende Webhooks: Ereignisse (Vorgang angelegt, Status geändert, gelöst,
// zugewiesen, Kommentar, Kunde geändert) werden per HTTPS-POST an andere
// Systeme gemeldet – z. B. Warenwirtschaft, Power Automate oder einen
// Microsoft-Teams-Kanal (Format "teams" = Adaptive Card für Teams-Workflows).
// Zustellung über eine Warteschlange in der Datenbank mit Wiederholungen;
// jede Nachricht trägt eine HMAC-SHA256-Signatur (Header X-GFT-Signature).
import { createHmac } from "node:crypto";
import { randomToken } from "./auth.mjs";

export const WEBHOOK_EVENTS = {
  "issue.created": "Vorgang angelegt", "issue.status_changed": "Status geändert", "issue.resolved": "Vorgang gelöst/erledigt",
  "issue.assigned": "Vorgang zugewiesen", "comment.created": "Neuer Kommentar", "customer.updated": "Kunde angelegt/geändert",
};
const MAX_ATTEMPTS = 8;

export function createWebhooks(ctx) {
  const { store, cfg, issueDto, customerDto, ilog, log } = ctx;
  const hooks = () => { try { return JSON.parse(store.meta("webhooks") || "[]"); } catch { return []; } };
  const saveHooks = (list) => store.meta("webhooks", JSON.stringify(list));
  const mask = (h) => ({ ...h, secret: `${h.secret.slice(0, 6)}…` });

  function add({ name, url, events, format }) {
    if (!/^https?:\/\/[^\s]+$/i.test(String(url || ""))) throw new Error("Bitte eine gültige URL (https://…) angeben.");
    const h = { id: randomToken(9), name: String(name || "Webhook").slice(0, 80), url: String(url).trim(), events: (events || []).filter((e) => WEBHOOK_EVENTS[e]), format: format === "teams" ? "teams" : "json",
      secret: `whsec_${randomToken(24)}`, active: true, createdAt: new Date().toISOString() };
    if (!h.events.length) h.events = Object.keys(WEBHOOK_EVENTS);
    saveHooks([...hooks(), h]); return h;
  }
  function update(id, patch) {
    const list = hooks(); const h = list.find((x) => x.id === id); if (!h) return null;
    if ("active" in patch) h.active = !!patch.active; if (patch.name) h.name = String(patch.name).slice(0, 80);
    if (patch.url) { if (!/^https?:\/\//i.test(patch.url)) throw new Error("Ungültige URL."); h.url = String(patch.url).trim(); }
    if (Array.isArray(patch.events)) h.events = patch.events.filter((e) => WEBHOOK_EVENTS[e]);
    if (patch.format) h.format = patch.format === "teams" ? "teams" : "json";
    saveHooks(list); return h;
  }
  const remove = (id) => { const list = hooks(); const n = list.filter((x) => x.id !== id); saveHooks(n); return n.length !== list.length; };

  /* ---------- Nachrichten ---------- */
  function payload(type, obj, extra) {
    const base = { event: type, eventName: WEBHOOK_EVENTS[type] || type, at: new Date().toISOString(), source: cfg.appUrl };
    if (type.startsWith("customer.")) return { ...base, customer: customerDto(obj) };
    return { ...base, issue: issueDto(obj), ...extra };
  }
  function teamsCard(p) {
    const i = p.issue; const c = p.customer;
    const title = i ? `${p.eventName}: ${i.key} ${i.summary}` : `${p.eventName}: ${c.no ? `${c.no} ` : ""}${c.name}`;
    const facts = i ? [["Status", i.statusName], ["Priorität", i.priorityName], ["Kunde", i.customer?.name || i.contact?.company || ""], ["Verantwortlich", i.assignee?.name || "nicht zugewiesen"], ["Team", i.team || ""],
      ["Termin", i.appointmentAt ? new Date(i.appointmentAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: process.env.TZ || "Europe/Berlin" }) : ""], ["Fällig", i.dueDate ? i.dueDate.split("-").reverse().join(".") : ""],
      ...(p.from ? [["Vorher", p.from]] : []), ...(p.comment ? [["Kommentar", `${p.comment.author}: ${p.comment.text.slice(0, 300)}`]] : [])].filter(([, v]) => v)
      : [["Ort", [c.zip, c.city].filter(Boolean).join(" ")], ["Anlagen", String(c.assets.length)]];
    return { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: {
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4", msteams: { width: "Full" },
      body: [{ type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true }, { type: "FactSet", facts: facts.map(([t, v]) => ({ title: t, value: String(v) })) }],
      actions: [{ type: "Action.OpenUrl", title: "Im GF Tracker öffnen", url: i ? i.url : `${cfg.appUrl}/#/customers/${c.id}` }] } }] };
  }
  /** Ereignis in die Warteschlange aller passenden Webhooks stellen. */
  function enqueue(type, obj, extra = {}) {
    const list = hooks().filter((h) => h.active && h.events.includes(type)); if (!list.length) return;
    const p = payload(type, obj, extra); const now = Date.now();
    const ins = store.db.prepare("INSERT INTO webhook_queue (hook_id, event, body, next_at, created_at) VALUES (?, ?, ?, ?, ?)");
    for (const h of list) ins.run(h.id, type, JSON.stringify(h.format === "teams" ? teamsCard(p) : p), now, now);
  }
  async function deliver(h, event, body, deliveryId) {
    const sig = createHmac("sha256", h.secret).update(body).digest("hex");
    const res = await fetch(h.url, { method: "POST", body, signal: AbortSignal.timeout(10e3),
      headers: { "Content-Type": "application/json", "User-Agent": "GF-Tracker-Webhook/1", "X-GFT-Event": event, "X-GFT-Delivery": String(deliveryId), "X-GFT-Signature": `sha256=${sig}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return res.status;
  }
  let running = false;
  async function work() {
    if (running) return; running = true;
    try {
      const all = Object.fromEntries(hooks().map((h) => [h.id, h]));
      const due = store.db.prepare("SELECT * FROM webhook_queue WHERE done = 0 AND next_at <= ? ORDER BY id LIMIT 25").all(Date.now());
      for (const row of due) {
        const h = all[row.hook_id];
        if (!h) { store.db.prepare("UPDATE webhook_queue SET done = 3 WHERE id = ?").run(row.id); continue; }
        try { await deliver(h, row.event, row.body, row.id); store.db.prepare("UPDATE webhook_queue SET done = 1, attempts = attempts + 1, last_error = NULL WHERE id = ?").run(row.id); }
        catch (e) {
          const attempts = row.attempts + 1; const failed = attempts >= MAX_ATTEMPTS;
          store.db.prepare("UPDATE webhook_queue SET attempts = ?, next_at = ?, last_error = ?, done = ? WHERE id = ?").run(attempts, Date.now() + Math.min(6 * 36e5, 30e3 * 2 ** attempts), String(e.message).slice(0, 300), failed ? 2 : 0, row.id);
          if (failed || attempts === 1) ilog("webhook", failed ? "error" : "warn", `${h.name}: ${row.event} ${failed ? "endgültig fehlgeschlagen" : "fehlgeschlagen, wird wiederholt"} – ${e.message}`);
        }
      }
      store.db.prepare("DELETE FROM webhook_queue WHERE done <> 0 AND created_at < ?").run(Date.now() - 7 * 864e5);
    } catch (e) { log("Webhook-Fehler:", e.message); } finally { running = false; }
  }
  async function test(id) {
    const h = hooks().find((x) => x.id === id); if (!h) throw new Error("Webhook nicht gefunden.");
    const p = { event: "test", eventName: "Testnachricht", at: new Date().toISOString(), source: cfg.appUrl, message: "Der Webhook des GF Trackers ist korrekt eingerichtet." };
    const body = JSON.stringify(h.format === "teams" ? { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: { $schema: "http://adaptivecards.io/schemas/adaptive-card.json", type: "AdaptiveCard", version: "1.4", body: [{ type: "TextBlock", text: "✅ GF Tracker: Verbindung zu diesem Kanal funktioniert.", weight: "Bolder", wrap: true }] } }] } : p);
    const status = await deliver(h, "test", body, "test"); ilog("webhook", "info", `${h.name}: Test erfolgreich (HTTP ${status})`); return status;
  }
  const stats = () => store.db.prepare("SELECT hook_id, SUM(done = 0) AS pending, SUM(done = 1) AS delivered, SUM(done = 2) AS failed, MAX(CASE WHEN done = 2 OR attempts > 0 THEN last_error END) AS last_error FROM webhook_queue GROUP BY hook_id").all();
  return { list: () => hooks().map(mask), add, update, remove, enqueue, work, test, stats };
}
