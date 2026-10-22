// Workflow-Automatik: Regeln für automatische Zuweisung, Eskalation und Erinnerungen (Wiedervorlage).
// Regeln liegen als JSON in meta.automationRules; was eine Regel schon ausgelöst hat, steht in automation_log,
// damit jede Regel je Vorgang (und Anlass) genau einmal greift.

export const RULE_KINDS = { assign: "Automatisch zuweisen", escalate: "Eskalieren", remind: "Erinnern / Wiedervorlage" };
export const TRIGGERS = { sla: "SLA verletzt", overdue: "Fälligkeit überschritten", nofirst: "Keine Reaktion", unassigned: "Niemand zugewiesen" };
const PRIO_UP = { LOWEST: "LOW", LOW: "MEDIUM", MEDIUM: "HIGH", HIGH: "HIGHEST", HIGHEST: "HIGHEST" };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function createAutomation({ store, S, projectById, userById, issueKey, createNotification, log }) {
  const q = (sql) => store.db.prepare(sql);
  const s = {
    fired: q("SELECT 1 FROM automation_log WHERE rule_id = ? AND issue_id = ? AND key = ?"),
    fire: q("INSERT OR IGNORE INTO automation_log (rule_id, issue_id, key, at, action) VALUES (?, ?, ?, ?, ?)"),
    recent: q("SELECT rule_id, issue_id, at, action FROM automation_log ORDER BY at DESC LIMIT ?"),
    cleanup: q("DELETE FROM automation_log WHERE at < ?"),
  };
  const rules = () => { try { return JSON.parse(store.meta("automationRules") || "[]"); } catch { return []; } };

  /** Regeln prüfen und speichern (nur Administration). */
  function save(list) {
    if (!Array.isArray(list) || list.length > 100) throw new Error("Ungültige Regelliste.");
    const out = list.map((r) => {
      if (!r || !ID_RE.test(String(r.id)) || !RULE_KINDS[r.kind]) throw new Error("Ungültige Regel.");
      const name = String(r.name || "").trim().slice(0, 120) || RULE_KINDS[r.kind];
      const projectId = r.projectId && projectById(r.projectId) ? r.projectId : null;
      const base = { id: r.id, kind: r.kind, name, enabled: r.enabled !== false, projectId };
      if (r.kind === "assign") {
        if (!projectId) throw new Error(`„${name}“: Bitte ein Projekt wählen.`);
        return { ...base, method: r.method === "load" ? "load" : "round", teamId: r.teamId ? String(r.teamId) : null, types: Array.isArray(r.types) ? r.types.filter((t) => S.TYPES[t]).slice(0, 20) : [] };
      }
      if (r.kind === "escalate") {
        if (!TRIGGERS[r.trigger]) throw new Error(`„${name}“: Unbekannter Auslöser.`);
        return { ...base, trigger: r.trigger, hours: Math.min(24 * 90, Math.max(0, Number(r.hours) || 0)), minPriority: S.PRIOS[r.minPriority] ? r.minPriority : null,
          raise: !!r.raise, label: !!r.label, notifyLead: r.notifyLead !== false, notifyUserId: r.notifyUserId && userById(r.notifyUserId) ? r.notifyUserId : null };
      }
      return { ...base, status: String(r.status || "").slice(0, 40) || null, days: Math.min(365, Math.max(1, Number(r.days) || 3)), repeat: !!r.repeat, comment: String(r.comment || "").slice(0, 500) };
    });
    store.meta("automationRules", JSON.stringify(out)); return out;
  }

  const isDone = (i, p) => S.statusInfo(p, i.status).cat === "done";
  const absentToday = (userId, t) => store.all("absences").some((a) => a.userId === userId && a.start <= t && a.end >= t);
  const hist = (i, field, to, ruleName) => i.history.unshift({ id: S.uid(), at: new Date().toISOString(), userId: null, by: `Automatik: ${ruleName}`, field, from: "", to });

  /** Bei neuen Vorgängen ohne Verantwortliche: passende Zuweisungsregel anwenden. Ändert `issue` direkt. */
  function onCreate(issue) {
    if (issue.assigneeId) return false;
    const p = projectById(issue.projectId); if (!p || isDone(issue, p)) return false;
    const r = rules().find((x) => x.enabled && x.kind === "assign" && x.projectId === issue.projectId && (!x.types.length || x.types.includes(issue.type)));
    if (!r) return false;
    const team = store.get("teams", r.teamId || issue.teamId || p.teamId); const t = S.today();
    const pool = (team ? team.memberIds : []).map((id) => userById(id)).filter((u) => u && u.active && !absentToday(u.id, t));
    if (!pool.length) { log(`Automatik „${r.name}“: niemand verfügbar für ${issueKey(issue)}`); return false; }
    let pick;
    if (r.method === "load") {
      const load = new Map(pool.map((u) => [u.id, 0]));
      for (const i of store.all("issues")) if (load.has(i.assigneeId)) { const ip = projectById(i.projectId); if (ip && !isDone(i, ip)) load.set(i.assigneeId, load.get(i.assigneeId) + 1); }
      pick = pool.reduce((a, b) => (load.get(b.id) < load.get(a.id) ? b : a));
    } else {
      const last = store.meta(`rr:${r.id}`); const ids = pool.map((u) => u.id).sort();
      pick = userById(ids[(ids.indexOf(last) + 1) % ids.length] || ids[0]); store.meta(`rr:${r.id}`, pick.id);
    }
    issue.assigneeId = pick.id; hist(issue, "Verantwortlich", pick.name, r.name);
    s.fire.run(r.id, issue.id, "assign", Date.now(), `zugewiesen an ${pick.name}`);
    createNotification(pick.id, "assign", `Ihnen zugewiesen: ${issueKey(issue)}`, `${issue.summary} (automatisch, ${r.name})`, issue.id);
    return true;
  }

  /** Letzter Statuswechsel (für Wiedervorlage „seit X Tagen in Status …“). */
  const statusSince = (i) => (i.history.find((h) => h.field === "Status")?.at) || i.createdAt;
  const reacted = (i) => i.comments.some((c) => c.userId && !c.internal) || !!i.firstResponseAt;

  function check(r, i, p, now) {
    if (r.kind === "escalate") {
      if (r.minPriority && S.PRIOS[i.priority].rank < S.PRIOS[r.minPriority].rank) return null;
      const h = r.hours * 36e5;
      if (r.trigger === "sla") { const x = S.slaCompute(i, p, "resolve"); const f = S.slaCompute(i, p, "first"); return (x && !x.stopped && x.breached) || (f && !f.stopped && f.breached) ? "sla" : null; }
      if (r.trigger === "overdue") return i.dueDate && now - new Date(`${i.dueDate}T23:59:59`).getTime() > h ? `due:${i.dueDate}` : null;
      if (r.trigger === "nofirst") return !reacted(i) && now - new Date(i.createdAt).getTime() > h ? "nofirst" : null;
      if (r.trigger === "unassigned") return !i.assigneeId && now - new Date(i.createdAt).getTime() > h ? "unassigned" : null;
      return null;
    }
    if (r.kind === "remind") {
      if (r.status && i.status !== r.status) return null;
      const since = r.status ? statusSince(i) : i.updatedAt; const age = now - new Date(since).getTime(); const d = r.days * 864e5;
      if (age < d) return null;
      return r.repeat ? `${since}:${Math.floor(age / d)}` : since; // bei Wiederholung alle X Tage erneut
    }
    return null;
  }

  function act(r, i, p) {
    const key = issueKey(i); const notify = new Set();
    if (r.kind === "escalate") {
      const changes = [];
      if (r.raise && i.priority !== "HIGHEST") { const to = PRIO_UP[i.priority]; changes.push(`Priorität ${S.PRIOS[i.priority].label} → ${S.PRIOS[to].label}`); i.priority = to; }
      if (r.label && !i.labels.includes("eskaliert")) { i.labels = [...i.labels, "eskaliert"]; changes.push("Label „eskaliert“"); }
      hist(i, "Eskalation", `${TRIGGERS[r.trigger]}${changes.length ? ` · ${changes.join(", ")}` : ""}`, r.name);
      if (r.notifyLead) { if (p.leadId) notify.add(p.leadId); const t = store.get("teams", i.teamId || p.teamId); if (t?.leadId) notify.add(t.leadId); }
      if (r.notifyUserId) notify.add(r.notifyUserId); if (i.assigneeId) notify.add(i.assigneeId);
      for (const u of notify) createNotification(u, "sla", `Eskaliert: ${key} – ${TRIGGERS[r.trigger]}`, `${i.summary} (${r.name})`, i.id);
      return `eskaliert (${TRIGGERS[r.trigger]})${changes.length ? `: ${changes.join(", ")}` : ""}`;
    }
    const who = i.assigneeId || i.reporterId || p.leadId; const st = S.statusInfo(p, i.status).name;
    if (r.comment) i.comments.push({ id: S.uid(), userId: null, author: "Automatik", text: r.comment, at: new Date().toISOString(), internal: true });
    hist(i, "Erinnerung", r.status ? `seit ${r.days} Tagen „${st}“` : `seit ${r.days} Tagen unverändert`, r.name);
    if (who) createNotification(who, "due", `Wiedervorlage: ${key}`, `${r.status ? `Seit ${r.days} Tagen „${st}“` : `Seit ${r.days} Tagen keine Änderung`} – ${i.summary}`, i.id);
    return `erinnert${who ? ` (${userById(who)?.name || "?"})` : ""}`;
  }

  /** Läuft jede Minute: Eskalationen und Erinnerungen. Gibt die geänderten Vorgänge zurück. */
  function job() {
    const list = rules().filter((r) => r.enabled && (r.kind === "escalate" || r.kind === "remind")); if (!list.length) return [];
    const now = Date.now(); const changed = [];
    store.tx(() => {
      for (const cur of store.all("issues")) {
        const p = projectById(cur.projectId); if (!p || cur.type === "EPIC" || isDone(cur, p)) continue;
        let i = null;
        for (const r of list) {
          if (r.projectId && r.projectId !== cur.projectId) continue;
          const k = check(r, i || cur, p, now); if (!k || s.fired.get(r.id, cur.id, k)) continue;
          i ||= store.get("issues", cur.id);
          const what = act(r, i, p); s.fire.run(r.id, cur.id, k, now, what);
        }
        if (i) { i.updatedAt = new Date().toISOString(); store.put("issues", i); changed.push(i); }
      }
    });
    return changed;
  }

  const recent = (n = 50) => s.recent.all(n).map((x) => { const i = store.get("issues", x.issue_id); return { ...x, rule: rules().find((r) => r.id === x.rule_id)?.name || "(gelöschte Regel)", key: i ? issueKey(i) : null, summary: i?.summary || null }; });
  const cleanup = () => s.cleanup.run(Date.now() - 365 * 864e5);
  return { rules, save, onCreate, job, recent, cleanup };
}
