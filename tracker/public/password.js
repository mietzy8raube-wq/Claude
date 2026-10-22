"use strict";
// Passwort festlegen (Einladung oder Zurücksetzen per Link) bzw. Link anfordern
const $v = document.getElementById("view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const post = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-GFT": "1" }, body: JSON.stringify(body) }); const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error || "Das hat nicht geklappt."); return b; };
try { const th = localStorage.getItem("gft-theme"); if (th) document.documentElement.dataset.theme = th; } catch {}
const token = new URLSearchParams(location.search).get("t");
if (token) history.replaceState(null, "", "/password"); // Token nicht in Verlauf/Lesezeichen lassen
token ? setPassword(token) : forgot();

function forgot() {
  $v.innerHTML = `<h1>Passwort vergessen</h1><p class="muted" style="margin:0 0 18px">Geben Sie Ihre E-Mail-Adresse ein. Wir schicken Ihnen einen Link, mit dem Sie ein neues Passwort festlegen.</p>
    <form id="f" class="grid" style="gap:12px"><label class="f">E-Mail<input type="email" name="email" autocomplete="username" required autofocus></label>
    <div id="err" class="note err" hidden></div><button class="btn primary" type="submit" style="height:38px">Link anfordern</button></form>`;
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target; const btn = f.querySelector("button"); btn.disabled = true;
    try {
      const r = await post("/api/password/forgot", { email: f.email.value });
      $v.innerHTML = r.mail ? `<h1>E-Mail ist unterwegs</h1><p class="muted">Falls es zu <b>${esc(f.email.value)}</b> einen Zugang gibt, erhalten Sie in wenigen Minuten eine E-Mail mit einem Link. Er gilt 60 Minuten.</p><p class="small muted">Nichts angekommen? Bitte auch im Junk-E-Mail-Ordner nachsehen.</p>`
        : `<h1>Bitte an die Administration wenden</h1><p class="muted">Der E-Mail-Versand ist bei Ihnen noch nicht eingerichtet. Ihre Administration kann Ihnen unter <i>Einstellungen → Benutzer</i> einen Link zum Zurücksetzen erstellen.</p>`;
    } catch (ex) { const err = document.getElementById("err"); err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  });
}

async function setPassword(t) {
  let c; try { c = await (await fetch(`/api/password/check?t=${encodeURIComponent(t)}`)).json(); } catch { c = { valid: false, reason: "Keine Verbindung zum Server." }; }
  if (!c.valid) { $v.innerHTML = `<h1>Link nicht mehr gültig</h1><div class="note err" style="margin:10px 0">${esc(c.reason)}</div><p class="muted"><a href="/password">Neuen Link anfordern</a></p>`; return; }
  const invite = c.kind === "invite";
  $v.innerHTML = `<h1>${invite ? `Willkommen, ${esc(c.name.split(" ")[0])}!` : "Neues Passwort festlegen"}</h1>
    <p class="muted" style="margin:0 0 18px">${invite ? "Legen Sie Ihr Passwort fest – danach sind Sie direkt angemeldet." : "Wählen Sie ein neues Passwort. Danach werden Sie auf allen anderen Geräten abgemeldet."}</p>
    <form id="f" class="grid" style="gap:12px"><input type="email" name="email" value="${esc(c.email)}" autocomplete="username" hidden>
      <label class="f">Neues Passwort<input type="password" name="pw" autocomplete="new-password" minlength="10" required autofocus><div class="meter"><i id="meter"></i></div><span class="small muted">Mindestens 10 Zeichen – ein kurzer Satz lässt sich gut merken.</span></label>
      <label class="f">Passwort wiederholen<input type="password" name="pw2" autocomplete="new-password" required></label>
      <div id="err" class="note err" hidden></div><button class="btn primary" type="submit" style="height:38px">${invite ? "Passwort festlegen und loslegen" : "Passwort speichern"}</button></form>`;
  const f = document.getElementById("f"); const meter = document.getElementById("meter");
  f.pw.addEventListener("input", () => { const v = f.pw.value; const score = Math.min(4, (v.length >= 10) + (v.length >= 14) + (/[A-Z]/.test(v) && /[a-z]/.test(v)) + (/[\d\W]/.test(v))); meter.style.width = `${score * 25}%`; meter.style.background = ["#c9372c", "#c9372c", "#e2b203", "#22a06b", "#22a06b"][score]; });
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); const err = document.getElementById("err"); err.hidden = true;
    if (f.pw.value !== f.pw2.value) { err.textContent = "Die beiden Passwörter stimmen nicht überein."; err.hidden = false; return; }
    const btn = f.querySelector("button"); btn.disabled = true;
    try { await post("/api/password/set", { token: t, password: f.pw.value }); location.href = "/"; }
    catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  });
}
