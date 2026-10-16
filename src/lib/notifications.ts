import { prisma } from "@/lib/prisma";
import { formatTicketNumber } from "@/lib/ticket";
import { scheduleNotificationEmails } from "@/lib/mail/notification-mailer";
import { findAbsence, formatAbsence, loadAbsences } from "@/lib/absences";
import type { NotificationType, Prisma } from "@prisma/client";

interface NotifyParams {
  userIds: (string | null | undefined)[];
  /** Auslösender Benutzer – erhält selbst keine Benachrichtigung. */
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message?: string | null;
  taskId?: string | null;
  link?: string | null;
}

/**
 * Legt Benachrichtigungen für die angegebenen Benutzer an. Fehler werden nur
 * protokolliert, damit die eigentliche Aktion (z. B. Ticket speichern) nie
 * an einer Benachrichtigung scheitert.
 */
export async function notify({ userIds, actorId, type, title, message, taskId, link }: NotifyParams) {
  const recipients = [...new Set(userIds.filter((id): id is string => !!id && id !== actorId))];
  if (recipients.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type,
        title,
        message: message ?? null,
        taskId: taskId ?? null,
        link: link ?? (taskId ? `/tasks/all?ticket=${taskId}` : null),
      })),
    });
    await scheduleNotificationEmails();
  } catch (error) {
    console.error("Benachrichtigung konnte nicht erstellt werden:", error);
  }
}

export function ticketLabel(task: { ticketNumber: number; title: string }) {
  return `${formatTicketNumber(task.ticketNumber)} · ${task.title}`;
}

const HOUR = 60 * 60 * 1000;
/** Vorwarnzeit für "Frist läuft bald ab". */
export const DUE_SOON_HOURS = 48;

let lastRun = 0;

/** Beginn des heutigen Tages in deutscher Zeit (unabhängig von der Server-Zeitzone). */
function berlinStartOfToday(now: number) {
  const wall = new Date(new Date(now).toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const offset = wall.getTime() - now;
  wall.setHours(0, 0, 0, 0);
  return wall.getTime() - offset;
}

/**
 * Prüft alle offenen Tickets auf anstehende/überschrittene Fristen und fällige
 * Erinnerungen und erzeugt dafür (idempotent über dedupeKey) Benachrichtigungen.
 * - Frist heute oder in den nächsten 48 h → Verantwortlicher
 * - Frist überschritten (ab Folgetag)     → Verantwortlicher + Ersteller (Eskalation)
 * - Erinnerung (reminderAt) fällig → Verantwortlicher bzw. Ersteller
 * - Verantwortlicher laut Factorial am Fälligkeitstag abwesend (nächste 7 Tage)
 *   → Ersteller, damit rechtzeitig eine Vertretung bestimmt wird
 *
 * Wird beim Abruf der Benachrichtigungen gedrosselt automatisch ausgeführt und
 * kann zusätzlich per Cron über /api/notifications/deadline-check angestoßen werden.
 */
export async function runDeadlineCheck({ force = false }: { force?: boolean } = {}) {
  const now = Date.now();
  if (!force && now - lastRun < 5 * 60 * 1000) return { skipped: true, created: 0 };
  lastRun = now;

  const soon = new Date(now + DUE_SOON_HOURS * HOUR);
  const todayStart = berlinStartOfToday(now);
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "ERLEDIGT" },
      OR: [{ dueDate: { lte: soon } }, { reminderAt: { lte: new Date(now) } }],
    },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      dueDate: true,
      reminderAt: true,
      assigneeId: true,
      createdById: true,
    },
  });

  const data: Prisma.NotificationCreateManyInput[] = [];

  // Vertretungsbedarf: Tickets der nächsten 7 Tage, deren Verantwortlicher abwesend ist
  const absenceHorizon = new Date(now + 7 * 24 * HOUR);
  const upcoming = await prisma.task.findMany({
    where: { status: { not: "ERLEDIGT" }, assigneeId: { not: null }, dueDate: { gte: new Date(todayStart), lte: absenceHorizon } },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      dueDate: true,
      assigneeId: true,
      createdById: true,
      assignee: { select: { name: true } },
    },
  });
  if (upcoming.length) {
    const absences = await loadAbsences(new Date(todayStart), absenceHorizon, [
      ...new Set(upcoming.map((t) => t.assigneeId!)),
    ]);
    for (const task of upcoming) {
      const absence = findAbsence(absences, task.assigneeId, task.dueDate!);
      if (!absence) continue;
      const recipients = new Set([task.createdById]);
      // Hat sich die abwesende Person das Ticket selbst angelegt, alle Geschäftsführer informieren
      if (task.createdById === task.assigneeId) {
        const managers = await prisma.user.findMany({
          where: { role: "GESCHAEFTSFUEHRER", isActive: true, id: { not: task.assigneeId! } },
          select: { id: true },
        });
        managers.forEach((m) => recipients.add(m.id));
        recipients.delete(task.assigneeId!);
      }
      for (const userId of recipients) {
        data.push({
          userId,
          type: "VERTRETUNG_NOETIG",
          title: `Vertretung nötig: ${ticketLabel(task)}`,
          message: `${task.assignee?.name} ist am Fälligkeitstag nicht da (${formatAbsence(absence)}). Bitte neu zuweisen oder die Frist anpassen.`,
          taskId: task.id,
          link: `/tasks/all?ticket=${task.id}`,
          dedupeKey: `absence:${task.id}:${userId}:${absence.id}:${task.dueDate!.toISOString()}`,
        });
      }
    }
  }

  for (const task of tasks) {
    const label = ticketLabel(task);
    const link = `/tasks/all?ticket=${task.id}`;
    const owner = task.assigneeId ?? task.createdById;

    if (task.dueDate) {
      const due = task.dueDate.getTime();
      const dueKey = task.dueDate.toISOString();
      if (due < todayStart) {
        const recipients = new Set([owner, task.createdById]);
        for (const userId of recipients) {
          data.push({
            userId,
            type: "UEBERFAELLIG",
            title: `Überfällig: ${label}`,
            message: task.assigneeId
              ? "Die Frist ist abgelaufen. Bitte erledigen, neu terminieren oder neu zuweisen."
              : "Die Frist ist abgelaufen und das Ticket ist niemandem zugewiesen.",
            taskId: task.id,
            link,
            dedupeKey: `overdue:${task.id}:${userId}:${dueKey}`,
          });
        }
      } else if (due <= soon.getTime()) {
        data.push({
          userId: owner,
          type: "FRIST_BALD",
          title: `Frist läuft bald ab: ${label}`,
          message: `Fällig am ${new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeZone: "Europe/Berlin" }).format(task.dueDate)}.`,
          taskId: task.id,
          link,
          dedupeKey: `due-soon:${task.id}:${owner}:${dueKey}`,
        });
      }
    }

    if (task.reminderAt && task.reminderAt.getTime() <= now) {
      data.push({
        userId: owner,
        type: "ERINNERUNG",
        title: `Erinnerung: ${label}`,
        taskId: task.id,
        link,
        dedupeKey: `reminder:${task.id}:${task.reminderAt.toISOString()}`,
      });
    }
  }

  const created = data.length ? (await prisma.notification.createMany({ data, skipDuplicates: true })).count : 0;
  // Auch liegengebliebene E-Mails (z. B. aus parallelen Läufen) regelmäßig nachsenden
  await scheduleNotificationEmails();
  return { skipped: false, created };
}
