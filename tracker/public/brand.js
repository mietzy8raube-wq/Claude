"use strict";
// Erscheinungsbild (Firmenfarbe, Logo, App-Name) für Anmeldung, Passwort-Seite und Kundenportal.
(function () {
  fetch("/api/brand").then((r) => (r.ok ? r.json() : null)).then((b) => {
    if (!b) return; const st = document.documentElement.style;
    if (b.color && b.color !== "#0c66e4") {
      const rgb = [1, 3, 5].map((k) => parseInt(b.color.slice(k, k + 2), 16)); const dk = rgb.map((v) => Math.round(v * 0.85).toString(16).padStart(2, "0")).join("");
      st.setProperty("--primary", b.color); st.setProperty("--primary-hover", `#${dk}`); st.setProperty("--brand-2", `#${dk}`);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", b.color);
    }
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    document.querySelectorAll("[data-brand-logo]").forEach((el) => { el.innerHTML = `${b.logo ? `<img src="${esc(b.logo)}" alt="" style="height:30px;width:auto;max-width:180px;object-fit:contain">` : `<span class="mark"><img src="/favicon.svg" alt="" width="28" height="28"></span>`}${esc(el.dataset.brandLogo === "company" ? b.company : b.appName)}`; });
    if (document.title.includes("GF Tracker")) document.title = document.title.replace("GF Tracker", b.appName);
  }).catch(() => {});
})();
