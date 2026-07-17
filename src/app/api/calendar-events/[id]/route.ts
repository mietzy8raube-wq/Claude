import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateCalendarEventSchema } from "@/lib/validations/calendar";
import { getValidAccessToken } from "@/lib/graph/tokenStore";
import { updateEvent, deleteEvent } from "@/lib/graph/client";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateCalendarEventSchema.parse(body);

    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Termin nicht gefunden.");
    }

    let syncStatus = existing.syncStatus;
    let syncError = existing.syncError;

    if (existing.outlookEventId) {
      try {
        const accessToken = await getValidAccessToken(session.user.id);
        await updateEvent(accessToken, existing.outlookEventId, {
          subject: data.title,
          body: data.description ?? undefined,
          start: data.startTime ? new Date(data.startTime).toISOString() : undefined,
          end: data.endTime ? new Date(data.endTime).toISOString() : undefined,
          timeZone: data.timeZone ?? existing.timeZone,
          location: data.location ?? undefined,
        });
        syncStatus = "ERFOLGREICH";
        syncError = null;
      } catch (error) {
        syncStatus = "FEHLER";
        syncError = error instanceof Error ? error.message : "Synchronisierung mit Outlook fehlgeschlagen";
      }
    }

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...data,
        description: data.description === "" ? null : data.description,
        location: data.location === "" ? null : data.location,
        syncStatus,
        syncError,
        lastSyncedAt: existing.outlookEventId ? new Date() : existing.lastSyncedAt,
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) {
      throw new ApiError(404, "Termin nicht gefunden.");
    }

    if (event.outlookEventId) {
      try {
        const accessToken = await getValidAccessToken(session.user.id);
        await deleteEvent(accessToken, event.outlookEventId);
      } catch (error) {
        console.error("Outlook-Termin konnte nicht gelöscht werden:", error);
      }
    }

    await prisma.calendarEvent.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      entityType: "CalendarEvent",
      entityId: id,
      description: `Termin "${event.title}" wurde gelöscht`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
