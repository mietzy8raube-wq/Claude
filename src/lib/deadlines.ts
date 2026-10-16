export type DeadlineBucket = "overdue" | "today" | "tomorrow" | "thisWeek" | "nextWeek" | "later";

export const BUCKET_LABEL: Record<DeadlineBucket, string> = {
  overdue: "Überfällig",
  today: "Heute",
  tomorrow: "Morgen",
  thisWeek: "Diese Woche",
  nextWeek: "Nächste Woche",
  later: "Später",
};

export const BUCKET_ORDER: DeadlineBucket[] = ["overdue", "today", "tomorrow", "thisWeek", "nextWeek", "later"];

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, days: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

/** Ordnet ein Fälligkeitsdatum einer Zeitgruppe zu (Wochen beginnen montags). */
export function deadlineBucket(due: Date, now = new Date()): DeadlineBucket {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);
  const weekday = (today.getDay() + 6) % 7; // Mo = 0
  const nextMonday = addDays(today, 7 - weekday);
  const mondayAfter = addDays(nextMonday, 7);

  // Fristen gelten tagesgenau: überfällig erst ab dem Folgetag (wie im Dashboard)
  if (due < today) return "overdue";
  if (due < tomorrow) return "today";
  if (due < dayAfter) return "tomorrow";
  if (due < nextMonday) return "thisWeek";
  if (due < mondayAfter) return "nextWeek";
  return "later";
}

export function relativeDue(due: Date, now = new Date()) {
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "seit gestern";
  if (days < 0) return `seit ${-days} Tagen`;
  return `in ${days} Tagen`;
}
