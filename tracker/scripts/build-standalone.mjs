#!/usr/bin/env node
// Baut die Einzeldatei-Version des GF Trackers (ohne Server, Daten im Browser).
// Aufruf: node scripts/build-standalone.mjs  →  ../standalone/gf-suite-tracker.html
// Nutzt dieselben Dateien wie die Server-Version (public/*) – nach Änderungen an
// der App einfach neu bauen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const OUT = path.resolve(ROOT, process.argv[2] || "../standalone/gf-suite-tracker.html");

/** Ersetzt genau die erwarteten Stellen – bricht ab, wenn sich der Quelltext geändert hat. */
function patch(name, src, rules) {
  for (const [from, to, count = 1] of rules) {
    const n = src.split(from).length - 1;
    if (n !== count) throw new Error(`${name}: "${from}" ${n}× gefunden, erwartet ${count}×`);
    src = src.split(from).join(to);
  }
  return src;
}

const app = patch("app.js", read("public/app.js"), [
  ['const LOGIN_URL = TEAMS ? "/teams/tab" : "/login";', 'const LOGIN_URL = "?login";'],
  ['href="/portal"', 'href="?portal"', 3],
  ["/portal?p=${p.key}", "?portal&p=${p.key}", 2],
  ["${esc(location.origin)}/portal?embed=1", "${esc(GFTLocal.BASE)}?portal&embed=1"],
  ["${esc(location.origin)}/portal", "${esc(GFTLocal.BASE)}?portal", 2],
  ['location.href = authUrl("/api/admin/export")', 'api("/api/admin/export")'],
  ['if ("serviceWorker" in navigator && !TEAMS)', "if (false)"],
  ['src="/icons/icon-64.png"', `src="data:image/png;base64,${fs.readFileSync(path.join(ROOT, "public/icons/icon-64.png")).toString("base64")}"`, 2],
]);
const portal = patch("portal.js", read("public/portal.js"), [
  ['(location.pathname.match(/^\\/portal\\/r\\/([A-Za-z0-9_-]{20,64})$/) || [])[1]', '(/^[A-Za-z0-9_-]{20,64}$/.test(params.get("r") || "") ? params.get("r") : null)'],
  ['href="/portal"', 'href="?portal"', 2],
  ["${esc(new URL(r.url).pathname)}", "${esc(r.url)}"],
]);
const portalCss = read("public/portal.html").match(/<style>([\s\S]*?)<\/style>/)[1];
const favicon = "data:image/svg+xml," + encodeURIComponent(read("public/favicon.svg").trim());
// Skripte als Text einbetten; "</script" darf darin nicht vorkommen.
const embed = (id, js) => `<script type="text/plain" id="${id}">${js.replace(/<\/(script)/gi, "<\\/$1")}</script>`;

const loader = `
(() => {
  const q = new URLSearchParams(location.search);
  const mode = q.has("portal") ? "portal" : q.has("login") || !GFTLocal.current() ? "login" : "app";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  // Quelltexte sichern, bevor der Seiteninhalt ersetzt wird
  const src = Object.fromEntries(["src-app", "src-portal", "portal-css", "app-body"].map((id) => [id, document.getElementById(id)[id === "app-body" ? "innerHTML" : "textContent"]]));
  const text = (id) => src[id];
  const run = (id) => { const s = document.createElement("script"); s.textContent = text(id); document.body.appendChild(s); };
  try { const th = localStorage.getItem("gft-theme"); if (th) document.documentElement.dataset.theme = th; } catch {}
  if (mode === "portal") {
    document.title = "Service-Portal";
    document.body.innerHTML = '<main class="portal" id="portal"><p class="muted">Lade…</p></main><div class="toasts" id="toasts" role="status" aria-live="polite"></div>';
    const st = document.createElement("style"); st.textContent = text("portal-css"); document.head.appendChild(st);
    return run("src-portal");
  }
  if (mode === "login") {
    const ROLE = { ADMIN: "Administrator", MEMBER: "Mitarbeiter", AGENT: "Service-Techniker", VIEWER: "Nur lesen" };
    const ini = (n) => n.split(/\\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    document.title = "Anmelden · GF Tracker";
    document.body.innerHTML = \`<main class="sa-login"><div class="card pad">
      <div class="row" style="gap:10px;margin-bottom:6px"><span class="sa-logo">⚡</span><h1 style="font-size:20px;margin:0">GF Tracker</h1></div>
      <p class="muted small" style="margin:0 0 16px">Wer arbeitet gerade? Person wählen – jeder Tab kann als andere Person angemeldet sein (z. B. Disponent und Techniker nebeneinander).</p>
      <div class="sa-users">\${GFTLocal.users().map((u) => \`<button class="sa-user" data-id="\${esc(u.id)}"><span class="avatar" style="background:\${esc(u.color || "#2436e8")}">\${esc(ini(u.name))}</span><span><b>\${esc(u.name)}</b><br><span class="small muted">\${esc(ROLE[u.role] || u.role)}</span></span></button>\`).join("")}</div>
      <div class="row" style="margin-top:18px;justify-content:space-between"><a href="?portal" target="_blank" rel="noopener">Kundenportal öffnen ↗</a><button class="btn subtle sm" id="sa-reset">Beispieldaten zurücksetzen</button></div>
      <p class="small muted" style="margin:16px 0 0">Einzeldatei-Version: Alle Daten bleiben in diesem Browser auf diesem Gerät. Für mehrere Arbeitsplätze, Anmeldung mit Passwort und E-Mail-Versand die Server-Version verwenden. Sicherung: Einstellungen → Export.</p>
    </div></main>\`;
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".sa-user"); if (b) { GFTLocal.login(b.dataset.id); location.href = GFTLocal.BASE; return; }
      if (e.target.id === "sa-reset" && confirm("Alle Daten in diesem Browser löschen und Beispieldaten neu anlegen?")) { GFTLocal.reset(); location.reload(); }
    });
    return;
  }
  document.body.innerHTML = src["app-body"];
  run("src-app");
})();`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GF Tracker</title>
<meta name="description" content="Vorgangs- und Projektverfolgung mit Service-Desk – Einzeldatei-Version.">
<meta name="theme-color" content="#2436e8">
<link rel="icon" href="${favicon}" type="image/svg+xml">
<style>
${read("public/app.css")}
.sa-login { max-width: 520px; margin: 8vh auto; padding: 0 16px; }
.sa-logo { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; background: var(--primary); color: #fff; }
.sa-users { display: grid; gap: 8px; }
.sa-user { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.sa-user:hover { border-color: var(--primary); background: var(--primary-soft); }
.sa-user .avatar { width: 34px; height: 34px; font-size: 13px; flex: none; }
</style>
</head>
<body>
<template id="app-body"><header class="topnav" id="topnav"></header>
<div class="layout"><aside class="psidebar" id="psidebar" hidden></aside><main class="content" id="view"><p class="muted">Lade Daten…</p></main></div>
<div class="overlay" id="overlay"></div>
<div class="modal" id="modal" role="dialog" aria-modal="true"></div>
<div class="pop" id="notifs"></div>
<div class="toasts" id="toasts" role="status" aria-live="polite"></div>
<div id="tip"></div></template>
<script type="text/plain" id="portal-css">${portalCss}</script>
${embed("src-app", app)}
${embed("src-portal", portal)}
<script>
${read("public/shared.js")}
</script>
<script>
${read("public/xlsx.js")}
</script>
<script>
${read("public/importer.js")}
</script>
<script>
${read("public/qr.js")}
</script>
<script>
${read("standalone/backend.js")}
</script>
<script>${loader}</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`Geschrieben: ${path.relative(process.cwd(), OUT)} (${Math.round(html.length / 1024)} KB)`);
