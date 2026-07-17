import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createCalendarEventSchema } from "@/lib/validations/calendar";
import { getValidAccessToken } from "@/lib/graph/tokenStore";
import { createEvent } from "@/lib/graph/client";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: session.user.id,
        ...(from || to
          ? {
              startTime: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        meeting: { select: { id: true, title: true } },
        decision: { select: { id: true, title: true } },
      },
      orderBy: { startTime: "asc" },
    });

    return NextResponse.json({ events });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createCalendarEventSchema.parse(body);

    let outlookEventId: string | null = null;
    let syncStatus: "NIE_SYNCHRONISIERT" | "ERFOLGREICH" | "FEHLER" = "NIE_SYNCHRONISIERT";
    let syncError: string | null = null;

    if (data.syncToOutlook) {
      try {
        const accessToken = await getValidAccessToken(session.user.id);
        const connection = await prisma.microsoftConnection.findUnique({ where: { userId: session.user.id } });
        const graphEvent = await createEvent(accessToken, connection?.selectedCalendarId ?? null, {
          subject: data.title,
          body: data.description || undefined,
          start: data.startTime.toISOString(),
          end: data.endTime.toISOString(),
          timeZone: data.timeZone,
          location: data.location || undefined,
          attendees: data.attendees,
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
        title: data.title,
        description: data.description || null,
        location: data.location || null,
        startTime: data.startTime,
        endTime: data.endTime,
        timeZone: data.timeZone,
        attendees: data.attendees,
        organizer: session.user.email,
        source: outlookEventId ? "OUTLOOK" : "LOKAL",
        outlookEventId,
        syncStatus,
        syncError,
        lastSyncedAt: outlookEventId ? new Date() : null,
        projectId: data.projectId || null,
        meetingId: data.meetingId || null,
        decisionId: data.decisionId || null,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "CalendarEvent",
      entityId: event.id,
      description: `Termin "${event.title}" wurde erstellt`,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
