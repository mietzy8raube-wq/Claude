import { prisma } from "@/lib/prisma";

export interface AbsenceLike {
  userId: string | null;
  startOn: Date | string;
  finishOn: Date | string | null;
  approved: boolean | null;
  leaveTypeName: string | null;
  halfDay?: string | null;
}

/** Kalendertag (YYYY-MM-DD) in deutscher Zeit. */
export function dayKey(date: Date | string) {
  return new Date(date).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

/** Abwesenheiten werden als reine Kalendertage (UTC-Mitternacht) gespeichert. */
function absenceDayKey(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function absenceCovers(absence: AbsenceLike, date: Date | string) {
  const key = dayKey(date);
  const start = absenceDayKey(absence.startOn);
  const end = absence.finishOn ? absenceDayKey(absence.finishOn) : "9999-12-31";
  return start <= key && key <= end;
}

/** Genehmigte Abwesenheit der Person am angegebenen Tag (ausstehende zählen nicht). */
export function findAbsence<T extends AbsenceLike>(absences: T[], userId: string | null | undefined, date: Date | string) {
  if (!userId) return null;
  return absences.find((a) => a.userId === userId && a.approved === true && absenceCovers(a, date)) ?? null;
}

/** Lädt alle Abwesenheiten, die das Zeitfenster [from, to] berühren. */
export function loadAbsences(from: Date, to: Date, userIds?: string[]) {
  return prisma.absence.findMany({
    where: {
      userId: userIds ? { in: userIds } : { not: null },
      startOn: { lte: to },
      OR: [{ finishOn: null }, { finishOn: { gte: from } }],
    },
    select: {
      id: true,
      userId: true,
      startOn: true,
      finishOn: true,
      approved: true,
      leaveTypeName: true,
      halfDay: true,
    },
    orderBy: { startOn: "asc" },
  });
}

export function formatAbsence(a: AbsenceLike) {
  const fmt = (d: Date | string) =>
    new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(d));
  const type = a.leaveTypeName || "Abwesend";
  if (!a.finishOn) return `${type} ab ${fmt(a.startOn)}`;
  if (absenceDayKey(a.startOn) === absenceDayKey(a.finishOn)) return `${type} am ${fmt(a.startOn)}`;
  return `${type} ${fmt(a.startOn)}–${fmt(a.finishOn)}`;
}
