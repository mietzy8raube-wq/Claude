"use strict";
document.getElementById("login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; const err = document.getElementById("err"); const btn = f.querySelector("button");
  err.hidden = true; btn.disabled = true;
  try {
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json", "X-GFT": "1" }, body: JSON.stringify({ email: f.email.value, password: f.password.value }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Anmeldung fehlgeschlagen.");
    location.href = "/" + (location.hash || "");
  } catch (ex) { err.textContent = ex.message; err.hidden = false; f.password.select(); }
  finally { btn.disabled = false; }
});
try { const th = localStorage.getItem("gft-theme"); if (th) document.documentElement.dataset.theme = th; } catch {}
// Anmeldung mit Microsoft anbieten, wenn eingerichtet; Fehlermeldung aus der Rückleitung anzeigen
fetch("/api/auth/config").then((r) => r.json()).then((c) => { if (c.microsoft) document.getElementById("sso").hidden = false; }).catch(() => {});
{ const msg = new URLSearchParams(location.search).get("sso"); if (msg) { const err = document.getElementById("err"); err.textContent = msg; err.hidden = false; } }
