// iCalendar (RFC 5545) – für Kalender-Abos (Outlook „Kalender abonnieren“) und
// Termin-Anhänge in E-Mails („In Kalender speichern“). Zeiten in UTC, damit
// Outlook, Google und Apple ohne Zeitzonen-Blöcke korrekt umrechnen.
const fold = (line) => { const out = []; let s = line; while (Buffer.byteLength(s) > 74) { let n = 74; while (Buffer.byteLength(s.slice(0, n)) > 74) n--; out.push(s.slice(0, n)); s = " " + s.slice(n); } out.push(s); return out.join("\r\n"); };
const text = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const day = (k) => String(k).slice(0, 10).replace(/-/g, "");
const nextDay = (k) => { const d = new Date(`${String(k).slice(0, 10)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };

/** Ein Termin: { uid, start, end | allDay (JJJJ-MM-TT) [+ allDayEnd], summary, description, location, url, alarmMinutes | alarmTrigger, status, categories, sequence } */
export function vevent(e) {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utc(e.stamp || Date.now())}`];
  if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${day(e.allDay)}`, `DTEND;VALUE=DATE:${nextDay(e.allDayEnd || e.allDay)}`, "TRANSP:TRANSPARENT");
  else lines.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`);
  lines.push(`SUMMARY:${text(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${text(e.description)}`);
  if (e.location) lines.push(`LOCATION:${text(e.location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  if (e.categories) lines.push(`CATEGORIES:${e.categories.map(text).join(",")}`);
  if (e.sequence != null) lines.push(`SEQUENCE:${e.sequence}`);
  lines.push(`STATUS:${e.status || "CONFIRMED"}`);
  const trigger = e.alarmTrigger || (e.alarmMinutes != null ? `-PT${Math.round(e.alarmMinutes)}M` : null);
  if (trigger) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${text(e.summary)}`, `TRIGGER:${trigger}`, "END:VALARM");
  lines.push("END:VEVENT");
  return lines;
}
/** Kalenderdatei mit mehreren Terminen. */
export function calendar(events, { name = "GF Tracker", method = "PUBLISH", refreshHours = 1 } = {}) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GF Tracker//DE", "CALSCALE:GREGORIAN", `METHOD:${method}`, `X-WR-CALNAME:${text(name)}`,
    `X-PUBLISHED-TTL:PT${refreshHours}H`, `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`, ...events.flatMap(vevent), "END:VCALENDAR"];
  return lines.map(fold).join("\r\n") + "\r\n";
}
