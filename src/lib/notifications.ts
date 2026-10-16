import { prisma } from "@/lib/prisma";
import { formatTicketNumber } from "@/lib/ticket";
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

  if (data.length === 0) return { skipped: false, created: 0 };
  const result = await prisma.notification.createMany({ data, skipDuplicates: true });
  return { skipped: false, created: result.count };
}
