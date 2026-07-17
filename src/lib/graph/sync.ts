import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "./tokenStore";
import { listEvents, type GraphEvent } from "./client";

function mapAttendees(event: GraphEvent) {
  return (event.attendees ?? []).map((a) => ({
    name: a.emailAddress.name,
    email: a.emailAddress.address,
    response: a.type ?? null,
  }));
}

/**
 * Synchronisiert die Outlook-Termine eines Benutzers in die lokale
 * CalendarEvent-Tabelle. Läuft manuell (Button) oder periodisch (Cron/Trigger).
 */
export async function syncUserCalendar(userId: string) {
  const startedAt = Date.now();
  const connection = await prisma.microsoftConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new Error("Kein verbundenes Microsoft-Konto gefunden.");
  }

  let itemsSynced = 0;
  let itemsFailed = 0;

  try {
    const accessToken = await getValidAccessToken(userId);

    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    to.setDate(to.getDate() + 90);

    const { value: events } = await listEvents(
      accessToken,
      connection.selectedCalendarId,
      from.toISOString(),
      to.toISOString()
    );

    for (const event of events) {
      try {
        await prisma.calendarEvent.upsert({
          where: { outlookEventId: event.id },
          create: {
            userId,
            title: event.subject || "(Ohne Titel)",
            description: event.bodyPreview ?? null,
            location: event.location?.displayName ?? null,
            // Graph liefert dateTime im per "Prefer: outlook.timezone" angeforderten
            // Zeitzonen-Kontext ohne Offset zurück; wir fordern konsistent Europe/Berlin an.
            startTime: new Date(event.start.dateTime),
            endTime: new Date(event.end.dateTime),
            timeZone: event.start.timeZone || "Europe/Berlin",
            organizer: event.organizer?.emailAddress?.address ?? null,
            attendees: mapAttendees(event),
            teamsLink: event.onlineMeeting?.joinUrl ?? null,
            source: "OUTLOOK",
            outlookEventId: event.id,
            syncStatus: "ERFOLGREICH",
            lastSyncedAt: new Date(),
          },
          update: {
            title: event.subject || "(Ohne Titel)",
            description: event.bodyPreview ?? null,
            location: event.location?.displayName ?? null,
            startTime: new Date(event.start.dateTime),
            endTime: new Date(event.end.dateTime),
            timeZone: event.start.timeZone || "Europe/Berlin",
            organizer: event.organizer?.emailAddress?.address ?? null,
            attendees: mapAttendees(event),
            teamsLink: event.onlineMeeting?.joinUrl ?? null,
            syncStatus: "ERFOLGREICH",
            lastSyncedAt: new Date(),
            syncError: null,
          },
        });
        itemsSynced++;
      } catch (itemError) {
        itemsFailed++;
        console.error("Sync-Fehler für Termin", event.id, itemError);
      }
    }

    await prisma.microsoftConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date(), lastSyncStatus: "ERFOLGREICH", lastSyncError: null },
    });

    await prisma.syncLog.create({
      data: {
        connectionId: connection.id,
        status: "ERFOLGREICH",
        message: `${itemsSynced} Termine synchronisiert${itemsFailed ? `, ${itemsFailed} fehlgeschlagen` : ""}`,
        itemsSynced,
        itemsFailed,
        durationMs: Date.now() - startedAt,
      },
    });

    return { itemsSynced, itemsFailed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Synchronisierungsfehler";

    await prisma.microsoftConnection.update({
      where: { userId },
      data: { lastSyncAt: new Date(), lastSyncStatus: "FEHLER", lastSyncError: message },
    });

    await prisma.syncLog.create({
      data: {
        connectionId: connection.id,
        status: "FEHLER",
        message,
        itemsSynced,
        itemsFailed,
        durationMs: Date.now() - startedAt,
      },
    });

    throw error;
  }
}
