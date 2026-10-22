"use strict";
// GF Tracker in Microsoft Teams: Reiter (persönlich und im Kanal), Kanal-Konfiguration und Anmelde-Popup.
// In Teams läuft die App in einem Rahmen auf teams.microsoft.com – dort sind Cookies oft gesperrt. Deshalb meldet sich
// die App hier mit einem eigenen Token an (gespeichert im Browser, gesendet im Kopf X-GFT-Token).
const KEY = "gft-teams-token";
const $t = document.getElementById("t");
const T = window.microsoftTeams; let inTeams = false;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const store = { get: () => { try { return localStorage.getItem(KEY); } catch { return null; } }, set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch {} } };
const api = (path, opts = {}) => fetch(path, { ...opts, headers: { "Content-Type": "application/json", "X-GFT": "1", ...(store.get() ? { "X-GFT-Token": store.get() } : {}), ...(opts.headers || {}) } });
const params = new URLSearchParams(location.search);

async function init() {
  if (T) { try { await Promise.race([T.app.initialize(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]); inTeams = true; } catch { inTeams = false; } }
  try { if (inTeams) { const ctx = await T.app.getContext(); const theme = ctx.app?.theme; if (theme === "dark" || theme === "contrast") document.documentElement.dataset.theme = "dark"; T.app.registerOnThemeChangeHandler?.((th) => { document.documentElement.dataset.theme = th === "default" ? "light" : "dark"; }); } } catch {}
  const path = location.pathname;
  if (path === "/teams/auth-end") return authEnd();
  if (path === "/teams/config") return config();
  return tab();
}

/** Reiter: angemeldet → App öffnen, sonst Anmelden anbieten. */
async function tab() {
  const view = params.get("view") || "your-work";
  const ok = store.get() && (await api("/api/me").then((r) => r.ok).catch(() => false));
  if (ok) { if (inTeams) T.app.notifySuccess?.(); location.replace(`/teams/app#/${view.replace(/^#?\/?/, "")}`); return; }
  store.set(null); if (inTeams) T.app.notifySuccess?.();
  $t.innerHTML = `<div class="logo" data-brand-logo="app"><span class="mark"><img src="/favicon.svg" alt="" width="28" height="28"></span>GF Tracker</div>
    <h1>In Teams anmelden</h1><p class="muted" style="margin:0">Einmal anmelden – danach öffnet sich der Tracker hier direkt, auf allen Ihren Teams-Geräten wie gewohnt.</p>
    <div id="err" class="note err" hidden></div><button class="btn primary" id="login" style="height:38px">Anmelden</button>
    <p class="small muted" style="margin:0">Es öffnet sich ein kleines Fenster mit der Anmeldung (E-Mail und Passwort bzw. „Mit Microsoft anmelden“).</p>`;
  document.getElementById("login").addEventListener("click", login);
  // Logo/Name nach dem Neuzeichnen erneut setzen
  const s = document.createElement("script"); s.src = "/brand.js"; document.body.appendChild(s);
}
async function login() {
  const err = document.getElementById("err"); err.hidden = true;
  try {
    const token = inTeams ? await T.authentication.authenticate({ url: `${location.origin}/teams/auth-start`, width: 520, height: 680 }) : await popupFallback();
    store.set(token); tab();
  } catch (e) { if (String(e?.message || e) !== "CancelledByUser") { err.textContent = `Anmeldung nicht abgeschlossen: ${e?.message || e}`; err.hidden = false; } }
}
/** Außerhalb von Teams (z. B. zum Testen im Browser): normales Popup mit Nachricht zurück. */
function popupFallback() {
  return new Promise((resolve, reject) => {
    const w = window.open("/teams/auth-start", "gft-teams-login", "width=520,height=680"); if (!w) return reject(new Error("Popup wurde blockiert."));
    const on = (e) => { if (e.origin !== location.origin || !e.data?.gftToken) return; window.removeEventListener("message", on); resolve(e.data.gftToken); };
    window.addEventListener("message", on);
  });
}
/** Ende des Anmelde-Popups: hier gilt das normale Cookie → Teams-Token holen und zurückgeben. */
async function authEnd() {
  $t.innerHTML = '<p class="muted">Anmeldung wird abgeschlossen …</p>';
  try {
    const r = await fetch("/api/teams/token", { method: "POST", headers: { "Content-Type": "application/json", "X-GFT": "1" } }); const b = await r.json();
    if (!r.ok) throw new Error(b.error || "Nicht angemeldet");
    if (inTeams) T.authentication.notifySuccess(b.token); else if (window.opener) { window.opener.postMessage({ gftToken: b.token }, location.origin); window.close(); }
    $t.innerHTML = '<p>✓ Angemeldet. Dieses Fenster kann geschlossen werden.</p>';
  } catch (e) { if (inTeams) T.authentication.notifyFailure(e.message); $t.innerHTML = `<div class="note err">${esc(e.message)}</div><p><a href="/teams/auth-start">Erneut versuchen</a></p>`; }
}
/** Kanal-Reiter einrichten: welche Ansicht soll der Reiter zeigen? */
async function config() {
  let projects = []; try { const r = await api("/api/state?part=base"); if (r.ok) projects = (await r.json()).projects || []; } catch {}
  const views = [["your-work", "Mein Tag"], ["filters?state=open", "Suche (offene Vorgänge)"], ["dashboard", "Dashboard"], ["teams", "Teams-Übersicht"], ["customers", "Kunden & Anlagen"],
    ...projects.flatMap((p) => p.type === "service" ? [[`p/${p.key}/queue`, `${p.key} – Warteschlange`], [`p/${p.key}/dispatch`, `${p.key} – Einsatzplanung`]] : [[`p/${p.key}/board`, `${p.key} – Board`], [`p/${p.key}/backlog`, `${p.key} – Backlog`]])];
  $t.innerHTML = `<div class="logo" data-brand-logo="app"><span class="mark"><img src="/favicon.svg" alt="" width="28" height="28"></span>GF Tracker</div><h1>Reiter einrichten</h1>
    <label class="f">Was soll der Reiter zeigen?<select id="view">${views.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label>
    <label class="f">Name des Reiters<input type="text" id="name" value="${esc(views[0][1])}" maxlength="40"></label>
    ${projects.length ? "" : '<p class="small muted" style="margin:0">Tipp: Nach der ersten Anmeldung im Reiter stehen hier auch die einzelnen Projekt-Boards zur Auswahl.</p>'}
    ${inTeams ? "" : '<div class="note warn">Diese Seite wird von Teams beim Hinzufügen eines Reiters geöffnet.</div>'}`;
  const sel = document.getElementById("view"), name = document.getElementById("name"); let touched = false;
  name.addEventListener("input", () => { touched = true; });
  const save = () => { if (!touched) name.value = sel.selectedOptions[0].textContent; if (inTeams) T.pages.config.setValidityState(true); };
  sel.addEventListener("change", save); save();
  if (inTeams) T.pages.config.registerOnSaveHandler((ev) => {
    const v = sel.value; T.pages.config.setConfig({ entityId: `gft-${v.replace(/[^A-Za-z0-9]/g, "-")}`, contentUrl: `${location.origin}/teams/tab?view=${encodeURIComponent(v)}`, websiteUrl: `${location.origin}/#/${v}`, suggestedDisplayName: name.value.trim() || "GF Tracker" }).then(() => ev.notifySuccess()).catch((e) => ev.notifyFailure(String(e)));
  });
}
init();
