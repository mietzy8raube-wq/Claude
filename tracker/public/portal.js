"use strict";
/* Öffentliches Kundenportal: Anfrage stellen und über einen persönlichen Link verfolgen. */
const { TYPES } = TrackerShared;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDT = (iso) => new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
const ICON = { alert: '<path d="M12 3 2 21h20zM12 10v5M12 18h.01"/>', wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>', help: '<path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V14M12 18h.01"/>', send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>' };
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ""}</svg>`;
const state = { cfg: null, type: null, project: new URLSearchParams(location.search).get("p") };
function toast(msg) { const el = document.createElement("div"); el.className = "toast"; el.textContent = msg; $("#toasts").appendChild(el); setTimeout(() => el.remove(), 5000); }
async function api(path, opts = {}) {
  const res = await fetch(path, { method: opts.method || "GET", headers: { "Content-Type": "application/json", "X-GFT": "1" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}
const tokenFromPath = () => (location.pathname.match(/^\/portal\/r\/([A-Za-z0-9_-]{20,64})$/) || [])[1];

function hero() {
  return `<div class="portal-hero"><h1>${esc(state.cfg.company)} – Service-Portal</h1><p style="margin:6px 0 0;opacity:.9">Störung melden, Wartung anfragen oder den Stand Ihrer Anfrage verfolgen – rund um die Uhr.</p></div>`;
}
function renderHome() {
  const c = state.cfg; const projects = c.projects;
  if (!projects.length) { $("#portal").innerHTML = hero() + `<div class="empty">Das Service-Portal ist derzeit nicht verfügbar.</div>`; return; }
  const pkey = projects.some((p) => p.key === state.project) ? state.project : projects[0].key;
  const rt = c.requestTypes.find((r) => r.id === state.type);
  $("#portal").innerHTML = hero() + `
    ${projects.length > 1 ? `<label class="f" style="max-width:320px;margin-bottom:14px">Bereich<select id="proj">${projects.map((p) => `<option value="${p.key}" ${p.key === pkey ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
    <h2 style="font-size:17px;margin-bottom:10px">Wobei können wir helfen?</h2>
    <div class="grid g3" style="margin-bottom:18px">${c.requestTypes.map((r) => `<button type="button" class="card rtype ${state.type === r.id ? "on" : ""}" data-type="${r.id}" style="text-align:left;font:inherit;color:inherit"><span class="ic" style="background:${r.color}">${icon(r.icon)}</span><span><span class="b" style="display:block">${esc(r.name)}</span><span class="small muted">${esc(r.desc)}</span></span></button>`).join("")}</div>
    ${rt ? `<div class="card pad"><h2 style="font-size:17px;margin-bottom:12px">${esc(rt.name)}</h2>
      <form id="req" class="grid g2" style="gap:12px" data-project="${pkey}">
        <label class="f">Ihr Name <span class="req">*</span><input type="text" name="name" required maxlength="120" autocomplete="name"></label>
        <label class="f">Firma <span class="req">*</span><input type="text" name="company" required maxlength="160" autocomplete="organization"></label>
        <label class="f">E-Mail <span class="req">*</span><input type="email" name="email" required maxlength="200" autocomplete="email"></label>
        <label class="f">Telefon für Rückfragen<input type="tel" name="phone" maxlength="60" autocomplete="tel"></label>
        <label class="f" style="grid-column:1/-1">Betreff <span class="req">*</span><input type="text" name="summary" required maxlength="200" placeholder="${rt.id === "INCIDENT" ? "z. B. Kompressor zeigt Fehler E42" : rt.id === "MAINT" ? "z. B. Jahreswartung Schraubenkompressor" : "z. B. Angebot Ersatzfilter"}"></label>
        <label class="f">Anlage / Standort<input type="text" name="asset" maxlength="200" placeholder="z. B. GA 37 VSD, Halle B"></label>
        <label class="f">Dringlichkeit<select name="urgency">${c.urgency.map((u) => `<option value="${u.id}" ${u.id === (rt.id === "INCIDENT" ? "HIGH" : "MEDIUM") ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select></label>
        <label class="f" style="grid-column:1/-1">Beschreibung <span class="req">*</span><textarea name="description" rows="5" required maxlength="8000" placeholder="${rt.id === "INCIDENT" ? "Was ist passiert? Fehlercode, seit wann, Auswirkungen …" : "Ihre Anfrage …"}"></textarea></label>
        <label class="hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>
        <p class="small muted" style="grid-column:1/-1;margin:0">Ihre Angaben verwenden wir ausschließlich zur Bearbeitung dieser Anfrage.</p>
        <div style="grid-column:1/-1" class="row"><button class="btn primary" type="submit">${icon("send")} Anfrage senden</button><button type="button" class="btn subtle" data-type="">Abbrechen</button></div>
      </form></div>` : `<p class="muted">Bereits eine Anfrage gestellt? Den Bearbeitungsstand sehen Sie über den Link in Ihrer Bestätigungs-E-Mail.</p>`}`;
}
function renderDone(r) {
  $("#portal").innerHTML = hero() + `<div class="card ok-box"><div class="big">✓</div><h2 style="font-size:20px;margin:8px 0">Vielen Dank – Ihre Anfrage ${esc(r.key)} ist eingegangen.</h2>
    <p class="muted">${r.mailSent ? "Sie erhalten in Kürze eine Bestätigung per E-Mail mit einem Link zu Ihrer Anfrage." : "Bitte speichern Sie sich diesen Link, um den Bearbeitungsstand zu verfolgen:"}</p>
    <p><a href="${esc(r.url)}">${esc(r.url)}</a></p><a class="btn primary" href="${esc(new URL(r.url).pathname)}">Anfrage ansehen</a></div>`;
}
async function renderRequest(token) {
  let v;
  try { v = await api(`/api/portal/requests/${token}`); } catch (e) { $("#portal").innerHTML = hero() + `<div class="note err">${esc(e.message)}</div><p><a href="/portal">Neue Anfrage stellen</a></p>`; return; }
  const cat = { todo: "cat-todo", progress: "cat-progress", done: "cat-done" }[v.statusCat];
  $("#portal").innerHTML = hero() + `<a href="/portal">← Neue Anfrage stellen</a>
    <div class="card pad" style="margin-top:12px"><div class="row"><span class="key">${esc(v.key)}</span><span class="lozenge ${cat}">${esc(v.status)}</span><span class="small muted">${esc(TYPES[v.type]?.label || "")}</span><span class="sp"></span><span class="small muted">gemeldet ${fmtDT(v.createdAt)}</span></div>
      <h1 style="font-size:20px;margin:8px 0">${esc(v.summary)}</h1><div class="desc-view" style="cursor:default">${esc(v.description)}</div>
      <h3 style="font-size:15px;margin:18px 0 6px">Verlauf</h3>
      ${v.comments.map((c) => `<div class="comment"><span class="avatar" style="background:${c.fromCustomer ? "#5b6b8a" : "#0c66e4"}">${c.fromCustomer ? "Sie" : "S"}</span><div class="body"><div class="small"><b>${esc(c.fromCustomer ? "Sie" : c.author)}</b> · <span class="muted">${fmtDT(c.at)}</span></div><div class="text">${esc(c.text)}</div></div></div>`).join("") || '<p class="muted small">Noch keine Nachrichten – wir melden uns schnellstmöglich.</p>'}
      ${v.closed ? '<p class="note info">Diese Anfrage ist abgeschlossen. Für ein neues Anliegen stellen Sie bitte eine neue Anfrage.</p>' : `<form id="reply" class="grid" style="gap:8px;margin-top:10px"><label class="f">Nachricht an den Service<textarea name="text" rows="3" required maxlength="8000"></textarea></label><div><button class="btn primary" type="submit">${icon("send")} Senden</button></div></form>`}
    </div><p class="small muted">Diese Seite ist über Ihren persönlichen Link erreichbar. Bitte geben Sie den Link nicht weiter.</p>`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-type]"); if (!t) return;
  state.type = t.dataset.type || null; renderHome();
  if (state.type) setTimeout(() => $("#req input")?.focus(), 0);
});
document.addEventListener("change", (e) => { if (e.target.id === "proj") { state.project = e.target.value; renderHome(); } });
document.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    if (f.id === "req") {
      const d = Object.fromEntries(new FormData(f)); d.type = state.type; d.projectKey = f.dataset.project;
      renderDone(await api("/api/portal/requests", { method: "POST", body: d }));
    }
    if (f.id === "reply") {
      await api(`/api/portal/requests/${tokenFromPath()}/comments`, { method: "POST", body: { text: f.text.value } });
      toast("Ihre Nachricht wurde gesendet."); await renderRequest(tokenFromPath());
    }
  } catch (ex) { toast(ex.message); btn.disabled = false; }
});
(async () => {
  try { state.cfg = await api("/api/portal/config"); document.title = `Service-Portal · ${state.cfg.company}`; }
  catch (e) { $("#portal").innerHTML = `<div class="note err">Das Portal ist nicht erreichbar: ${esc(e.message)}</div>`; return; }
  const token = tokenFromPath(); if (token) renderRequest(token); else renderHome();
})();
