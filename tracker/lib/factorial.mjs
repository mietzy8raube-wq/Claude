// Factorial-HR-Anbindung (https://api.factorialhr.com) mit Firmen-API-Schlüssel
// (Header x-api-key). Gleicht Mitarbeiter mit den Personen im GF Tracker ab
// (Zuordnung über die E-Mail-Adresse) und übernimmt Abwesenheiten (Urlaub,
// Krankheit, …) für Einsatzplanung und Teamansicht. Läuft stündlich.
export const DEFAULT_FACTORIAL_API_VERSION = "2026-10-01";

export function createFactorial(ctx) {
  const { store, S, env, ilog, broadcast } = ctx;
  const apiKey = env.FACTORIAL_API_KEY; const base = (env.FACTORIAL_BASE_URL || "https://api.factorialhr.com").replace(/\/$/, "");
  const version = env.FACTORIAL_API_VERSION || DEFAULT_FACTORIAL_API_VERSION;
  const configured = Boolean(apiKey);

  async function request(path, query = {}, retries = 3) {
    const q = new URLSearchParams(); for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) q.set(k, String(v));
    const url = `${base}/api/${version}/resources/${path}${q.size ? `?${q}` : ""}`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { "x-api-key": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(20e3) });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) { await new Promise((r) => setTimeout(r, (Number(res.headers.get("Retry-After")) || 2 ** attempt) * 1000)); continue; }
      if (!res.ok) {
        const hint = res.status === 401 || res.status === 403 ? " – API-Schlüssel ungültig oder ohne Berechtigung" : res.status === 404 ? ` – Endpunkt nicht gefunden (API-Version ${version} prüfen)` : "";
        throw new Error(`Factorial ${res.status}${hint}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      }
      return res.json();
    }
  }
  async function listAll(path, query, max = 5000) {
    const items = []; let after;
    do { const page = await request(path, { ...query, limit: 100, after_id: after }); items.push(...(page.data || [])); after = page.meta?.has_next_page ? page.meta.end_cursor : undefined; } while (after && items.length < max);
    return items;
  }
  const mapGet = (localId) => store.db.prepare("SELECT remote_id FROM sync_map WHERE kind = 'factorial' AND local_id = ?").get(localId)?.remote_id;
  const mapSet = (localId, remote) => store.db.prepare("INSERT INTO sync_map (kind, local_id, remote_id) VALUES ('factorial', ?, ?) ON CONFLICT(kind, local_id) DO UPDATE SET remote_id = excluded.remote_id").run(localId, String(remote));

  let running = false;
  async function sync() {
    if (!configured) throw new Error("Factorial ist nicht eingerichtet (FACTORIAL_API_KEY).");
    if (running) return { busy: true }; running = true;
    try {
      const createUsers = store.meta("factorialCreateUsers") !== "0";
      const employees = (await listAll("employees/employees", { only_active: true, only_managers: false })).filter((e) => e.active !== false);
      const users = store.all("users"); const empToUser = new Map(); let linked = 0, created = 0; const unmatched = [];
      store.tx(() => {
        for (const e of employees) {
          const email = String(e.login_email || e.email || e.communications_email || "").trim().toLowerCase();
          const name = String(e.full_name || `${e.first_name || ""} ${e.last_name || ""}`).trim();
          let u = users.find((x) => mapGet(x.id) === String(e.id)) || (email && users.find((x) => x.email.toLowerCase() === email));
          if (!u && email && createUsers) { u = { id: S.uid(), name: name || email, email, role: "MEMBER", active: true, color: S.hashColor(email), notifyEmail: true }; store.put("users", u); users.push(u); created++; }
          if (!u) { unmatched.push(name || String(e.id)); continue; }
          if (mapGet(u.id) !== String(e.id)) { mapSet(u.id, e.id); linked++; }
          empToUser.set(String(e.id), u.id);
        }
      });
      // Abwesenheiten der letzten 30 und nächsten 120 Tage
      const t = S.today(); const from = S.addDays(t, -30), to = S.addDays(t, 120);
      const leaves = (await listAll("timeoff/leaves", { from, to, include_pending: true, include_deleted_leaves: false, include_leave_type: true })).filter((l) => !l.deleted_at && l.approved !== false);
      const wanted = new Map();
      for (const l of leaves) {
        const userId = empToUser.get(String(l.employee_id)); if (!userId || !l.start_on) continue;
        wanted.set(`f${l.id}`, { id: `f${l.id}`, userId, start: l.start_on.slice(0, 10), end: (l.finish_on || l.start_on).slice(0, 10), type: l.leave_type_name || l.leave_type?.name || "Abwesend",
          source: "factorial", note: [l.half_day ? "halber Tag" : "", l.approved == null ? "beantragt" : "", l.description || ""].filter(Boolean).join(" · ") });
      }
      let changed = 0, removed = 0;
      store.tx(() => {
        for (const a of store.all("absences").filter((x) => x.source === "factorial")) if (!wanted.has(a.id) && a.end >= from) { store.del("absences", a.id); removed++; }
        for (const a of wanted.values()) { const cur = store.get("absences", a.id); if (!cur || JSON.stringify(cur) !== JSON.stringify(a)) { store.put("absences", a); changed++; } }
      });
      const now = new Date().toISOString(); store.meta("factorialLastSync", now);
      const summary = { employees: employees.length, linked, created, unmatched, absences: wanted.size, changed, removed, at: now };
      store.meta("factorialLastResult", JSON.stringify(summary));
      ilog("factorial", unmatched.length ? "warn" : "info", `Abgleich: ${employees.length} Mitarbeiter (${created} neu angelegt${unmatched.length ? `, ${unmatched.length} ohne E-Mail nicht zugeordnet` : ""}), ${wanted.size} Abwesenheiten (${changed} geändert, ${removed} entfernt)`);
      if (created || changed || removed) broadcast();
      return summary;
    } catch (e) { ilog("factorial", "error", `Abgleich fehlgeschlagen: ${e.message}`); throw e; }
    finally { running = false; }
  }
  const status = () => ({ configured, version, lastSync: store.meta("factorialLastSync"), lastResult: (() => { try { return JSON.parse(store.meta("factorialLastResult") || "null"); } catch { return null; } })(), createUsers: store.meta("factorialCreateUsers") !== "0" });
  return { configured, sync, status };
}
