"use strict";
/* GF Tracker – Outlook-Add-in (Aufgabenbereich in Outlook für Windows, Mac, neues Outlook und Outlook im Web).
   Zeigt zum Absender der geöffneten E-Mail den Kunden mit offenen Vorgängen, legt aus der E-Mail einen Vorgang an
   (Anhänge auf Wunsch inklusive) oder hängt sie an einen bestehenden Vorgang an. Anmeldung mit einem persönlichen
   Zugangsschlüssel aus dem GF Tracker (Einstellungen → Outlook-Add-in). */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const KEY = "gftToken";
const state = { token: null, me: null, item: null, mail: null, lookup: null, projects: [], existing: null };
function toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; $("#toasts").appendChild(el); setTimeout(() => el.remove(), 4500); }

/* ---------- Zugang (in Outlook geräteübergreifend gespeichert) ---------- */
const roaming = () => { try { return Office.context.roamingSettings; } catch { return null; } };
function loadToken() { return roaming()?.get(KEY) || (() => { try { return localStorage.getItem(KEY); } catch { return null; } })(); }
function saveToken(t) {
  const r = roaming(); if (r) { if (t) r.set(KEY, t); else r.remove(KEY); r.saveAsync(() => {}); }
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch {}
  state.token = t;
}
async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || "GET", headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { saveToken(null); renderSetup(data.error); throw new Error(data.error || "Nicht angemeldet."); }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}
const openUrl = (url) => { try { if (Office.context.ui?.openBrowserWindow) return Office.context.ui.openBrowserWindow(url); } catch {} window.open(url, "_blank", "noopener"); };

function renderSetup(msg) {
  $("#tp-settings").hidden = true;
  $("#tp").innerHTML = `<div class="tp-card"><h2>Einmalig verbinden</h2>
    <p class="small muted" style="margin:0">Im GF Tracker unter <b>Einstellungen → Outlook-Add-in</b> „Zugangsschlüssel erzeugen“ klicken und den Schlüssel hier einfügen.</p>
    ${msg ? `<div class="note err">${esc(msg)}</div>` : ""}
    <form id="tp-setup" class="grid" style="gap:8px"><input type="password" name="token" placeholder="gft_…" required autocomplete="off" aria-label="Zugangsschlüssel"><button class="btn primary" type="submit">Verbinden</button></form>
    <a href="/" target="_blank" rel="noopener" class="small">GF Tracker öffnen</a></div>`;
}

/* ---------- E-Mail lesen ---------- */
function cleanBody(t) {
  const out = [];
  for (const l of String(t || "").replace(/\r/g, "").split("\n")) { if (/^(-{2,}\s*(original|ursprüngliche)|_{5,}|von:\s|from:\s|am .+ schrieb|on .+ wrote)/i.test(l.trim())) break; if (!/^>/.test(l.trim())) out.push(l); }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 8000);
}
function readMail() {
  const it = Office.context.mailbox.item; if (!it) return Promise.resolve(null);
  return new Promise((resolve) => {
    const base = { subject: it.subject || "", fromEmail: (it.from?.emailAddress || it.sender?.emailAddress || "").toLowerCase(), fromName: it.from?.displayName || it.sender?.displayName || "",
      messageId: it.internetMessageId || it.itemId || "", attachments: (it.attachments || []).filter((a) => !a.isInline && a.attachmentType !== "cloud").map((a) => ({ id: a.id, name: a.name, size: a.size, contentType: a.contentType })) };
    if (!it.body?.getAsync) return resolve({ ...base, body: "" });
    it.body.getAsync(Office.CoercionType?.Text || "text", (r) => resolve({ ...base, body: r.status === "succeeded" || r.status === Office.AsyncResultStatus?.Succeeded ? cleanBody(r.value) : "" }));
  });
}
function attachmentContent(id) {
  return new Promise((resolve, reject) => {
    const it = Office.context.mailbox.item; if (!it.getAttachmentContentAsync) return reject(new Error("Diese Outlook-Version kann Anhänge nicht übergeben."));
    it.getAttachmentContentAsync(id, (r) => { if (r.status !== "succeeded" && r.status !== Office.AsyncResultStatus?.Succeeded) return reject(new Error(r.error?.message || "Anhang nicht lesbar."));
      if (r.value.format !== "base64" && r.value.format !== Office.MailboxEnums?.AttachmentContentFormat?.Base64) return reject(new Error("Nur Dateianhänge können übernommen werden.")); resolve(r.value.content); });
  });
}

/* ---------- Ansicht ---------- */
const issueLink = (i) => `<a class="tp-issue" href="${esc(i.url)}" data-open="${esc(i.url)}"><span class="small"><b>${esc(i.key)}</b> · <span class="lozenge cat-${i.statusCategory}">${esc(i.statusName)}</span></span><span>${esc(i.summary)}</span>${i.assignee ? `<span class="small muted">${esc(i.assignee.name)}${i.appointmentAt ? ` · Termin ${new Date(i.appointmentAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""}</span>` : ""}</a>`;
async function load() {
  state.token = state.token || loadToken(); if (!state.token) return renderSetup();
  $("#tp-settings").hidden = false; $("#tp").innerHTML = '<p class="muted small">Lade …</p>';
  try {
    state.me = state.me || await api("/api/v1/me");
    state.mail = await readMail();
    if (!state.mail) { $("#tp").innerHTML = '<div class="tp-card"><p style="margin:0">Bitte eine E-Mail öffnen.</p></div>'; return; }
    const [lookup, projects, existing] = await Promise.all([
      state.mail.fromEmail ? api(`/api/v1/lookup?email=${encodeURIComponent(state.mail.fromEmail)}`) : null,
      state.projects.length ? { items: state.projects } : api("/api/v1/projects"),
      state.mail.messageId ? api(`/api/v1/issues?externalId=${encodeURIComponent("mail:" + state.mail.messageId)}`) : { items: [] },
    ]);
    state.lookup = lookup; state.projects = projects.items; state.existing = existing.items[0] || null;
    render();
  } catch (e) { if (state.token) $("#tp").innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
}
function render() {
  const m = state.mail, L = state.lookup, c = L?.customer; const svc = state.projects.find((p) => p.type === "service") || state.projects[0];
  const incident = /störung|stoerung|defekt|ausfall|fehler|alarm|steht|leck|undicht|notfall/i.test(`${m.subject} ${m.body}`);
  const proj = (k) => state.projects.find((p) => p.key === k) || svc;
  const typeOpts = (p) => p.issueTypes.filter((t) => t !== "SUBTASK" && t !== "EPIC").map((t) => `<option value="${t}" ${(incident ? t === "INCIDENT" : t === "SERVICE") ? "selected" : ""}>${esc({ INCIDENT: "Störung", SERVICE: "Serviceanfrage", MAINT: "Wartung", TASK: "Aufgabe", STORY: "Story", BUG: "Bug" }[t] || t)}</option>`).join("");
  const open = L?.openIssues || [];
  $("#tp").innerHTML = `
    <div class="tp-card"><div class="small muted">Absender</div><div><b>${esc(m.fromName || m.fromEmail)}</b><div class="small muted">${esc(m.fromEmail)}</div></div>
      ${c ? `<div><a href="${esc(state.me.appUrl)}/#/customers/${esc(c.id)}" data-open="${esc(state.me.appUrl)}/#/customers/${esc(c.id)}"><b>${esc(c.name)}</b></a>${c.no ? ` <span class="small muted">(${esc(c.no)})</span>` : ""}
        <div class="small muted">${esc([c.street, [c.zip, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</div>${L.contact?.role ? `<div class="small">${esc(L.contact.role)}${L.contact.phone ? ` · ${esc(L.contact.phone)}` : ""}</div>` : ""}
        <div class="small">${c.assets.length} Anlage${c.assets.length === 1 ? "" : "n"}${c.assets.filter((a) => a.nextMaintenance).length ? ` · nächste Wartung ${new Date(c.assets.map((a) => a.nextMaintenance).filter(Boolean).sort()[0]).toLocaleDateString("de-DE")}` : ""}</div></div>`
        : `<div class="small muted">Kein bekannter Kunde zu dieser Adresse.</div>`}
      ${open.length ? `<div class="small b">Offene Vorgänge (${open.length})</div>${open.slice(0, 6).map(issueLink).join("")}` : ""}</div>
    ${state.existing ? `<div class="tp-ok">Diese E-Mail ist bereits Vorgang <a href="${esc(state.existing.url)}" data-open="${esc(state.existing.url)}"><b>${esc(state.existing.key)}</b></a> (${esc(state.existing.statusName)}).</div>` : `
    <div class="tp-card"><h2>Als Vorgang anlegen</h2>
      <form id="tp-create" class="grid" style="gap:8px">
        <div class="grid g2" style="gap:8px"><label class="f">Projekt<select name="project" id="tp-project">${state.projects.map((p) => `<option value="${p.key}" ${p.key === svc?.key ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
          <label class="f">Typ<select name="type" id="tp-type">${typeOpts(proj(svc?.key))}</select></label></div>
        <label class="f">Zusammenfassung<input type="text" name="summary" value="${esc(m.subject.replace(/^(aw|re|wg|fw|fwd):\s*/i, ""))}" required maxlength="255"></label>
        <label class="f">Beschreibung<textarea name="description" rows="5">${esc(m.body)}</textarea></label>
        <div class="grid g2" style="gap:8px"><label class="f">Priorität<select name="priority"><option value="HIGHEST">Höchste</option><option value="HIGH" ${incident ? "selected" : ""}>Hoch</option><option value="MEDIUM" ${incident ? "" : "selected"}>Mittel</option><option value="LOW">Niedrig</option></select></label>
          <label class="row nowrap small" style="align-self:end"><input type="checkbox" name="mine"> Mir zuweisen</label></div>
        ${m.attachments.length ? `<div class="tp-atts"><div class="small b">Anhänge übernehmen</div>${m.attachments.map((a) => `<label><input type="checkbox" name="att" value="${esc(a.id)}" checked> ${esc(a.name)} <span class="muted">(${Math.max(1, Math.round(a.size / 1024))} KB)</span></label>`).join("")}</div>` : ""}
        <button class="btn primary" type="submit">Vorgang anlegen</button></form></div>
    <div class="tp-card"><h2>Zu bestehendem Vorgang hinzufügen</h2>
      <form id="tp-append" class="grid" style="gap:8px">
        <label class="f">Vorgang${open.length ? `<select name="key">${open.map((i) => `<option value="${esc(i.key)}">${esc(i.key)} – ${esc(i.summary.slice(0, 50))}</option>`).join("")}<option value="">anderer …</option></select>` : ""}</label>
        <input type="text" name="other" placeholder="z. B. SD-12" ${open.length ? "hidden" : ""} aria-label="Vorgangsschlüssel">
        ${m.attachments.length ? `<label class="row nowrap small"><input type="checkbox" name="withAtt" checked> Anhänge mitnehmen</label>` : ""}
        <button class="btn" type="submit">E-Mail als Kommentar anhängen</button></form></div>`}`;
}
async function uploadAttachments(key, ids) {
  let ok = 0;
  for (const id of ids) {
    const a = state.mail.attachments.find((x) => x.id === id); if (!a) continue;
    try { const content = await attachmentContent(id); await api(`/api/v1/issues/${encodeURIComponent(key)}/attachments`, { method: "POST", body: { name: a.name, contentType: a.contentType, contentBase64: content, source: "email" } }); ok++; }
    catch (e) { toast(`${a.name}: ${e.message}`); }
  }
  return ok;
}

/* ---------- Ereignisse ---------- */
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-open]"); if (a) { e.preventDefault(); openUrl(a.dataset.open); }
  if (e.target.id === "tp-settings" && confirm("Zugang zum GF Tracker in Outlook entfernen?")) { saveToken(null); state.me = null; renderSetup(); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "tp-project") { const p = state.projects.find((x) => x.key === e.target.value); $("#tp-type").innerHTML = p.issueTypes.filter((t) => t !== "SUBTASK" && t !== "EPIC").map((t) => `<option value="${t}">${esc({ INCIDENT: "Störung", SERVICE: "Serviceanfrage", MAINT: "Wartung", TASK: "Aufgabe", STORY: "Story", BUG: "Bug" }[t] || t)}</option>`).join(""); }
  if (e.target.name === "key" && e.target.form?.id === "tp-append") e.target.form.other.hidden = e.target.value !== "";
});
document.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    if (f.id === "tp-setup") { saveToken(f.token.value.trim()); state.me = null; await load(); return; }
    const m = state.mail, c = state.lookup?.customer;
    if (f.id === "tp-create") {
      const fd = new FormData(f);
      const r = await api("/api/v1/issues", { method: "POST", body: { project: fd.get("project"), type: fd.get("type"), summary: fd.get("summary"), description: fd.get("description"), priority: fd.get("priority"),
        ...(fd.get("mine") ? { assignee: state.me.user?.email } : {}), ...(c ? { customer: c.no || c.id } : {}), contact: { name: m.fromName || m.fromEmail, email: m.fromEmail, company: c?.name || "" },
        labels: ["outlook"], externalId: m.messageId ? `mail:${m.messageId}` : undefined } });
      const n = await uploadAttachments(r.issue.key, fd.getAll("att"));
      toast(`${r.issue.key} angelegt${n ? ` · ${n} Anhang${n > 1 ? "e" : ""}` : ""}`); state.existing = r.issue; render();
    }
    if (f.id === "tp-append") {
      const key = (f.key?.value || f.other.value || "").trim().toUpperCase(); if (!key) throw new Error("Bitte einen Vorgang wählen.");
      await api(`/api/v1/issues/${encodeURIComponent(key)}/comments`, { method: "POST", body: { text: `E-Mail von ${m.fromName || m.fromEmail} (${m.fromEmail}) – „${m.subject}“:\n\n${m.body}`, internal: true } });
      const n = f.withAtt?.checked ? await uploadAttachments(key, m.attachments.map((a) => a.id)) : 0;
      toast(`An ${key} angehängt${n ? ` · ${n} Anhang${n > 1 ? "e" : ""}` : ""}`); btn.disabled = false;
    }
  } catch (ex) { toast(ex.message); btn.disabled = false; }
});
Office.onReady(() => {
  try { Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, () => load()); } catch {} // angehefteter Bereich: neue Mail gewählt
  load();
});
