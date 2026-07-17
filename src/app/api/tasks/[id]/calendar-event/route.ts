import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { createEventFromTaskSchema } from "@/lib/validations/task-event";
import { getValidAccessToken } from "@/lib/graph/tokenStore";
import { createEvent } from "@/lib/graph/client";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createEventFromTaskSchema.parse(body);

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new ApiError(404, "Aufgabe nicht gefunden.");
    }

    let outlookEventId: string | null = null;
    let syncStatus: "NIE_SYNCHRONISIERT" | "ERFOLGREICH" | "FEHLER" = "NIE_SYNCHRONISIERT";
    let syncError: string | null = null;

    if (data.syncToOutlook) {
      try {
        const accessToken = await getValidAccessToken(session.user.id);
        const connection = await prisma.microsoftConnection.findUnique({ where: { userId: session.user.id } });
        const graphEvent = await createEvent(accessToken, connection?.selectedCalendarId ?? null, {
          subject: task.title,
          body: task.description ?? undefined,
          start: data.startTime.toISOString(),
          end: data.endTime.toISOString(),
          timeZone: "Europe/Berlin",
          location: data.location || undefined,
        });
        outlookEventId = graphEvent.id;
        syncStatus = "ERFOLGREICH";
      } catch (error) {
        syncStatus = "FEHLER";
        syncError = error instanceof Error ? error.message : "Synchronisierung mit Outlook fehlgeschlagen";
      }
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId: session.user.id,
        title: task.title,
        description: task.description,
        location: data.location || null,
        startTime: data.startTime,
        endTime: data.endTime,
        timeZone: "Europe/Berlin",
        organizer: session.user.email,
        source: outlookEventId ? "OUTLOOK" : "LOKAL",
        outlookEventId,
        syncStatus,
        syncError,
        lastSyncedAt: outlookEventId ? new Date() : null,
        taskId: task.id,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "CalendarEvent",
      entityId: event.id,
      description: `Termin aus Aufgabe "${task.title}" erstellt`,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
