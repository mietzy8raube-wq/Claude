// Microsoft-365-Anbindung über Microsoft Graph (App-Registrierung in Entra ID):
//  1. E-Mail → Vorgang: ungelesene Mails im Service-Postfach werden zu Vorgängen,
//     Antworten mit [SD-12] im Betreff landen als Kundenantwort im Vorgang.
//     Berechtigung: Mail.ReadWrite (Anwendung) – auf das Postfach beschränkbar.
//  2. Outlook-Kalender: eingeplante Einsätze erscheinen als Termin im Kalender
//     der zuständigen Person (Berechtigung: Calendars.ReadWrite, Anwendung).
//  3. Anmeldung mit Microsoft (OpenID Connect, Autorisierungscode + PKCE);
//     Weiterleitungs-URI: <APP_URL>/auth/microsoft/callback (Plattform „Web“).
import { createHash, randomBytes } from "node:crypto";

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const AUTO_REPLY = /^(automatische antwort|automatic reply|abwesenheitsnotiz|abwesend|out of office|autoreply|unzustellbar|undeliverable|delivery status notification)/i;
const INCIDENT_WORDS = /störung|stoerung|defekt|ausfall|ausgefallen|fehler|alarm|steht still|leck|undicht|notfall|dringend/i;

export function createM365(ctx) {
  const { store, S, mailer, cfg, env, ilog, issueKey, projectById, userById, createNotification, findCustomerByEmail, broadcast, issueEffects, confirmReceipt, sessions, customerMails, flushMailQueue, addAttachment, maxFile } = ctx;
  const meta = (k, v) => store.meta(k, v);
  const settings = () => ({
    inbox: (meta("mailInbox") || env.MAIL_INBOX || "").trim().toLowerCase(),
    mailIn: meta("mailInEnabled") !== "0",
    calendar: meta("calendarSync") === "1",
    calendarMinutes: Number(meta("calendarMinutes") || env.CALENDAR_EVENT_MINUTES || 120),
    calendarInvite: meta("calendarInviteCustomer") === "1",
    calendarPull: meta("calendarPull") !== "0",
    sso: Boolean(mailer.appConfigured && (env.SSO_MICROSOFT === "1" || env.SSO_MICROSOFT === "true" || meta("ssoMicrosoft") === "1")),
  });
  const mapGet = (kind, id) => store.db.prepare("SELECT remote_id, extra FROM sync_map WHERE kind = ? AND local_id = ?").get(kind, id);
  const mapSet = (kind, id, remote, extra) => store.db.prepare("INSERT INTO sync_map (kind, local_id, remote_id, extra) VALUES (?, ?, ?, ?) ON CONFLICT(kind, local_id) DO UPDATE SET remote_id = excluded.remote_id, extra = excluded.extra").run(kind, id, remote, extra ? JSON.stringify(extra) : null);
  const mapDel = (kind, id) => store.db.prepare("DELETE FROM sync_map WHERE kind = ? AND local_id = ?").run(kind, id);

  /* ---------- 1. E-Mail → Vorgang ---------- */
  /** Zitierten Verlauf und Signaturtrenner aus Antworten entfernen. */
  function cleanBody(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n"); const out = [];
    for (const l of lines) {
      if (/^(-{2,}\s*(original|ursprüngliche)|_{5,}|von:\s|from:\s|am .+ schrieb|on .+ wrote)/i.test(l.trim())) break;
      if (/^>/.test(l.trim())) continue; out.push(l);
    }
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000);
  }
  let polling = false;
  async function pollMailbox() {
    const st = settings(); if (!st.mailIn || !st.inbox || !mailer.appConfigured || polling) return { skipped: true };
    polling = true; let created = 0, replies = 0;
    try {
      const sp = store.all("projects").find((p) => p.type === "service"); if (!sp) return { skipped: true };
      const res = await mailer.graph("GET", `/users/${encodeURIComponent(st.inbox)}/mailFolders/inbox/messages?$filter=isRead eq false&$top=25&$orderby=receivedDateTime asc&$select=id,subject,from,receivedDateTime,body,internetMessageId,hasAttachments`, null, { Prefer: 'outlook.body-content-type="text"' });
      for (const msg of res?.value || []) {
        const from = (msg.from?.emailAddress?.address || "").toLowerCase(); const fromName = msg.from?.emailAddress?.name || from; const subject = String(msg.subject || "").trim();
        const markRead = () => mailer.graph("PATCH", `/users/${encodeURIComponent(st.inbox)}/messages/${encodeURIComponent(msg.id)}`, { isRead: true }).catch((e) => ilog("mail", "warn", `Als gelesen markieren fehlgeschlagen: ${e.message}`));
        const mid = msg.internetMessageId || msg.id;
        if (mapGet("mail", mid)) { await markRead(); continue; }
        if (!from || from === st.inbox || from === String(env.MAIL_SENDER || "").toLowerCase() || AUTO_REPLY.test(subject)) { mapSet("mail", mid, msg.id); await markRead(); continue; }
        const text = cleanBody(msg.body?.content);
        /** Anhänge der Mail am Vorgang speichern (Signatur-Logos u. ä. werden übersprungen). */
        const saveAttachments = async (issueId) => {
          if (!msg.hasAttachments || !addAttachment) return 0; let n = 0;
          try {
            const list = await mailer.graph("GET", `/users/${encodeURIComponent(st.inbox)}/messages/${encodeURIComponent(msg.id)}/attachments`);
            for (const a of list?.value || []) {
              if (a["@odata.type"] !== "#microsoft.graph.fileAttachment" || !a.contentBytes) continue;
              if (a.isInline && (a.size || 0) < 20480) continue;
              const data = Buffer.from(a.contentBytes, "base64");
              if (data.length > maxFile) { ilog("mail", "warn", `Anhang „${a.name}“ (${Math.round(data.length / 1048576)} MB) zu groß – bleibt im Postfach`); continue; }
              try { addAttachment(issueId, { name: a.name, type: a.contentType, data, by: fromName, source: "email" }); n++; } catch (e) { ilog("mail", "warn", `Anhang „${a.name}“ nicht übernommen: ${e.message}`); }
            }
          } catch (e) { ilog("mail", "warn", `Anhänge nicht abrufbar: ${e.message}`); }
          return n;
        };
        const keyMatch = subject.match(/\[([A-Z][A-Z0-9]{1,9})-(\d+)\]/);
        const target = keyMatch && (() => { const p = store.all("projects").find((x) => x.key === keyMatch[1]); const hit = p && store.issueByNo(p.id, Number(keyMatch[2])); return hit ? store.get("issues", hit.id) : null; })();
        if (target && target.status !== "CLOSED") {
          store.tx(() => {
            const before = JSON.parse(JSON.stringify(target)); const p = projectById(target.projectId); const now = new Date().toISOString();
            target.comments.push({ id: S.uid(), userId: null, author: target.customer?.name || fromName, text: text || "(leere Nachricht)", at: now, internal: false, via: "email" });
            if (target.status === "WAITING" || S.statusInfo(p, target.status).cat === "done") {
              const f = target.status; target.status = "WORKING"; S.applyTransition(target, p, f, "WORKING", now);
              target.history.unshift({ id: S.uid(), at: now, userId: null, by: "E-Mail", field: "Status", from: S.statusInfo(p, f).name, to: S.statusInfo(p, "WORKING").name });
            }
            target.updatedAt = now; store.put("issues", target); issueEffects({ before, after: target });
            const who = target.assigneeId || p.leadId; if (who) createNotification(who, "comment", `Antwort per E-Mail: ${issueKey(target)}`, `${fromName}: ${text.slice(0, 120)}`, target.id);
            mapSet("mail", mid, msg.id, { issue: target.id });
          });
          await saveAttachments(target.id); replies++;
        } else {
          const cust = findCustomerByEmail(from);
          const contact = cust ? (cust.contacts || []).find((k) => (k.email || "").toLowerCase() === from) : null;
          const issue = store.tx(() => {
            const i = S.newIssue({ project: sp, no: store.reserveNumber(sp.id), type: INCIDENT_WORDS.test(`${subject} ${text}`) ? "INCIDENT" : "SERVICE", summary: subject.replace(/^(aw|re|wg|fw|fwd):\s*/i, "").slice(0, 200) || "(ohne Betreff)",
              description: text, priority: INCIDENT_WORDS.test(subject) ? "HIGH" : "MEDIUM", reporterId: null, labels: ["e-mail"], customerId: cust?.id || null,
              customer: cust ? { ...S.customerSnapshot(cust, contact?.id), ...(contact ? {} : { name: fromName, email: from }) } : { name: fromName, company: "", email: from, phone: "" } });
            i.history[0] = { ...i.history[0], by: "E-Mail" }; store.put("issues", i); issueEffects({ before: null, after: i });
            const team = i.teamId ? store.get("teams", i.teamId) : null;
            const notifyIds = new Set([...(team?.memberIds || []), ...store.all("users").filter((u) => u.active && u.role === "AGENT").map((u) => u.id), sp.leadId].filter(Boolean));
            for (const u of notifyIds) createNotification(u, "new", `Neue E-Mail-Anfrage: ${issueKey(i)}`, `${cust?.name || fromName}: ${i.summary}`, i.id);
            mapSet("mail", mid, msg.id, { issue: i.id });
            return i;
          });
          await saveAttachments(issue.id); confirmReceipt(issue, from, fromName); created++;
        }
        await markRead();
      }
      if (created || replies) { broadcast(); ilog("mail", "info", `Postfach ${st.inbox}: ${created} neue Vorgänge, ${replies} Antworten übernommen`); }
      meta("mailInLastPoll", new Date().toISOString());
      return { created, replies };
    } catch (e) { ilog("mail", "error", `Postfach-Abruf fehlgeschlagen: ${e.message}`); return { error: e.message }; }
    finally { polling = false; }
  }

  /* ---------- 2. Outlook-Kalender ---------- */
  const TZ = env.TZ || "Europe/Berlin";
  function localDateTime(iso, addMin = 0) {
    const d = new Date(new Date(iso).getTime() + addMin * 60e3);
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  function eventBody(i) {
    const st = settings(); const key = issueKey(i); const c = i.customerId ? store.get("customers", i.customerId) : null; const a = c && (c.assets || []).find((x) => x.id === i.assetId);
    const addr = c ? S.customerAddress(c) : "";
    return { subject: `🔧 ${key} ${i.summary}${i.customer?.company ? ` – ${i.customer.company}` : ""}`,
      start: { dateTime: localDateTime(i.appointmentAt), timeZone: TZ }, end: { dateTime: localDateTime(i.appointmentAt, st.calendarMinutes), timeZone: TZ },
      location: { displayName: addr || i.customer?.company || "" }, categories: ["GF Tracker"], showAs: "busy", isReminderOn: true, reminderMinutesBeforeStart: 60,
      ...(st.calendarInvite && i.customer?.email ? { attendees: [{ emailAddress: { address: i.customer.email, name: i.customer.name || i.customer.email }, type: "required" }], responseRequested: true, allowNewTimeProposals: true } : {}),
      body: { contentType: "HTML", content: `<p><b>${esc(key)} ${esc(i.summary)}</b></p><p>${esc(i.customer?.company || "")}${i.customer?.name ? ` · ${esc(i.customer.name)}` : ""}${i.customer?.phone ? ` · Tel. ${esc(i.customer.phone)}` : ""}<br>${esc(addr)}</p>${a ? `<p>Anlage: ${esc(a.name)}${a.serial ? ` (SN ${esc(a.serial)})` : ""}</p>` : ""}<p style="white-space:pre-wrap">${esc(String(i.description || "").slice(0, 2000))}</p><p><a href="${esc(cfg.appUrl)}/#/issue/${esc(key)}">Im GF Tracker öffnen</a></p>` } };
  }
  const calSig = (i, body = eventBody(i)) => `${i.appointmentAt}|${body.subject}|${settings().calendarMinutes}|${body.attendees?.[0]?.emailAddress.address || ""}`;
  const queue = new Map(); let calRunning = false;
  /** Vorgang zur Kalender-Abstimmung vormerken (läuft entkoppelt, Fehler landen im Protokoll). */
  function calendarTouch(issue) { if (!settings().calendar || !mailer.appConfigured) return; queue.set(issue.id, true); setTimeout(runCalendar, 50); }
  async function runCalendar() {
    if (calRunning) return; calRunning = true;
    try {
      while (queue.size) {
        const id = queue.keys().next().value; queue.delete(id);
        const i = store.get("issues", id); const cur = mapGet("cal", id); const old = cur ? { id: cur.remote_id, ...JSON.parse(cur.extra || "{}") } : null;
        const p = i && projectById(i.projectId); const u = i?.assigneeId ? userById(i.assigneeId) : null;
        const want = i && u?.email && i.appointmentAt && ["SCHEDULED", "WORKING"].includes(i.status);
        try {
          if (old && (!want || old.email !== u.email.toLowerCase())) {
            const done = i && p && S.statusInfo(p, i.status).cat === "done";
            if (!want && done) { mapDel("cal", id); continue; } // erledigte Einsätze bleiben im Kalender stehen
            await mailer.graph("DELETE", `/users/${encodeURIComponent(old.email)}/events/${encodeURIComponent(old.id)}`).catch((e) => { if (e.status !== 404) throw e; });
            mapDel("cal", id); ilog("calendar", "info", `Termin für ${i ? issueKey(i) : id} aus dem Kalender von ${old.email} entfernt`);
            if (!want) continue;
          }
          if (!want) continue;
          const email = u.email.toLowerCase(); const body = eventBody(i); const sig = calSig(i, body);
          const exists = mapGet("cal", id);
          if (exists) { const ex = JSON.parse(exists.extra || "{}"); if (ex.sig === sig) continue;
            await mailer.graph("PATCH", `/users/${encodeURIComponent(email)}/events/${encodeURIComponent(exists.remote_id)}`, body); mapSet("cal", id, exists.remote_id, { email, sig, at: i.appointmentAt });
            ilog("calendar", "info", `Termin ${issueKey(i)} im Kalender von ${u.name} aktualisiert`); }
          else { const ev = await mailer.graph("POST", `/users/${encodeURIComponent(email)}/events`, { ...body, transactionId: `gft-${id}-${Date.now()}` }); mapSet("cal", id, ev.id, { email, sig, at: i.appointmentAt });
            ilog("calendar", "info", `Termin ${issueKey(i)} in den Kalender von ${u.name} eingetragen`); }
        } catch (e) { ilog("calendar", "error", `Kalender für ${i ? issueKey(i) : id}: ${e.message}`); }
      }
    } finally { calRunning = false; }
  }

  /** Rückweg: Termine, die in Outlook verschoben oder gelöscht wurden, in den Tracker übernehmen. */
  let pulling = false;
  async function pullCalendarChanges() {
    const st = settings(); if (!st.calendar || !st.calendarPull || !mailer.appConfigured || pulling) return; pulling = true; let moved = 0;
    try {
      for (const row of store.db.prepare("SELECT local_id, remote_id, extra FROM sync_map WHERE kind = 'cal'").all()) {
        const i = store.get("issues", row.local_id); if (!i || !["SCHEDULED", "WORKING"].includes(i.status) || !i.appointmentAt) continue;
        if (new Date(i.appointmentAt).getTime() < Date.now() - 864e5) continue; // nur aktuelle/künftige Termine
        const ex = JSON.parse(row.extra || "{}"); let ev;
        try { ev = await mailer.graph("GET", `/users/${encodeURIComponent(ex.email)}/events/${encodeURIComponent(row.remote_id)}?$select=start,end,isCancelled,lastModifiedDateTime`, null, { Prefer: 'outlook.timezone="UTC"' }); }
        catch (e) { if (e.status !== 404) throw e; ev = null; }
        const u = store.all("users").find((x) => x.email.toLowerCase() === ex.email); const p = projectById(i.projectId);
        if (!ev || ev.isCancelled) {
          mapDel("cal", i.id);
          for (const who of new Set([i.assigneeId, p?.leadId].filter(Boolean))) createNotification(who, "overdue", `Termin in Outlook gelöscht: ${issueKey(i)}`, `${u?.name || ex.email} hat den Termin ${i.summary} im Kalender gelöscht – bitte neu einplanen oder bestätigen.`, i.id, `caldel:${i.id}:${i.appointmentAt}`);
          ilog("calendar", "warn", `Termin ${issueKey(i)} wurde in Outlook gelöscht (${ex.email}) – Hinweis an Disposition`); continue;
        }
        const startUtc = new Date(String(ev.start?.dateTime || "").replace(/\.\d+$/, "") + (ev.start?.timeZone === "UTC" ? "Z" : ""));
        // Nur echte Änderungen in Outlook übernehmen: Vergleich mit dem zuletzt abgeglichenen Termin, nicht mit dem
        // aktuellen Stand im Tracker – sonst würde eine noch nicht übertragene Verschiebung im Tracker überschrieben.
        const last = ex.at ? new Date(ex.at).getTime() : null;
        if (isNaN(startUtc) || last === null || Math.abs(startUtc.getTime() - last) < 60e3) continue;
        if (Math.abs(startUtc.getTime() - new Date(i.appointmentAt).getTime()) < 60e3) { mapSet("cal", i.id, row.remote_id, { ...ex, at: i.appointmentAt }); continue; }
        const before = JSON.parse(JSON.stringify(i)); const now = new Date().toISOString();
        i.history.unshift({ id: S.uid(), at: now, userId: u?.id || null, by: `Outlook${u ? ` (${u.name})` : ""}`, field: "Termin", from: new Date(i.appointmentAt).toLocaleString("de-DE", { timeZone: env.TZ || "Europe/Berlin" }), to: startUtc.toLocaleString("de-DE", { timeZone: env.TZ || "Europe/Berlin" }) });
        i.appointmentAt = startUtc.toISOString(); i.updatedAt = now;
        store.tx(() => { store.put("issues", i); mapSet("cal", i.id, row.remote_id, { ...ex, sig: calSig(i), at: i.appointmentAt }); issueEffects({ before, after: i }); });
        if (p?.leadId && p.leadId !== i.assigneeId) createNotification(p.leadId, "status", `Termin in Outlook verschoben: ${issueKey(i)}`, `${u?.name || ex.email}: neu ${startUtc.toLocaleString("de-DE", { timeZone: env.TZ || "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}`, i.id);
        customerMails({ before, after: i }); moved++;
        ilog("calendar", "info", `Termin ${issueKey(i)} in Outlook verschoben – übernommen (${startUtc.toISOString()})`);
      }
      if (moved) { broadcast(); flushMailQueue(); }
    } catch (e) { ilog("calendar", "error", `Abgleich aus Outlook fehlgeschlagen: ${e.message}`); }
    finally { pulling = false; }
  }

  /* ---------- 3. Anmeldung mit Microsoft ---------- */
  const pending = new Map(); // state → { verifier, nonce, exp }
  const loginHost = mailer.loginHost; const tenant = mailer.cfg.tenantId; const redirectUri = `${cfg.appUrl}/auth/microsoft/callback`;
  function ssoStart() {
    const state = b64url(randomBytes(18)), nonce = b64url(randomBytes(18)), verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k);
    pending.set(state, { verifier, nonce, exp: Date.now() + 10 * 60e3 });
    const q = new URLSearchParams({ client_id: mailer.cfg.clientId, response_type: "code", redirect_uri: redirectUri, response_mode: "query", scope: "openid profile email", state, nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" });
    return `${loginHost}/${tenant}/oauth2/v2.0/authorize?${q}`;
  }
  async function ssoCallback(url) {
    const err = url.searchParams.get("error"); if (err) throw new Error(url.searchParams.get("error_description") || err);
    const state = url.searchParams.get("state"); const p = pending.get(state); pending.delete(state);
    if (!p || p.exp < Date.now()) throw new Error("Anmeldung abgelaufen – bitte erneut versuchen.");
    const res = await fetch(`${loginHost}/${tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(15e3),
      body: new URLSearchParams({ client_id: mailer.cfg.clientId, client_secret: mailer.cfg.clientSecret, grant_type: "authorization_code", code: url.searchParams.get("code") || "", redirect_uri: redirectUri, code_verifier: p.verifier, scope: "openid profile email" }) });
    const body = await res.json().catch(() => ({})); if (!res.ok || !body.id_token) throw new Error(`Microsoft-Anmeldung fehlgeschlagen (${res.status}) ${body.error_description || ""}`.trim());
    // Das ID-Token kommt direkt vom Token-Endpunkt (TLS, mit Client-Geheimnis) – Inhalt prüfen
    const claims = JSON.parse(Buffer.from(body.id_token.split(".")[1] || "", "base64url").toString("utf8"));
    if (claims.aud !== mailer.cfg.clientId) throw new Error("Token gehört zu einer anderen Anwendung.");
    if (claims.nonce !== p.nonce) throw new Error("Ungültige Anmeldung (Nonce).");
    if (claims.exp * 1000 < Date.now()) throw new Error("Token abgelaufen.");
    if (!["common", "organizations"].includes(tenant) && claims.tid && claims.tid !== tenant) throw new Error("Konto gehört zu einem anderen Mandanten.");
    const email = String(claims.email || claims.preferred_username || claims.upn || "").toLowerCase();
    const user = store.all("users").find((u) => u.active && u.email.toLowerCase() === email);
    if (!user) { ilog("sso", "warn", `Anmeldung mit Microsoft abgelehnt: ${email || "ohne E-Mail"} ist keine aktive Person im GF Tracker`); throw Object.assign(new Error("unknown"), { code: "unknown", email }); }
    ilog("sso", "info", `Anmeldung mit Microsoft: ${email}`);
    return sessions.create(user.id);
  }

  return { settings, pollMailbox, calendarTouch, runCalendar, pullCalendarChanges, ssoStart, ssoCallback, cleanBody, localDateTime };
}
