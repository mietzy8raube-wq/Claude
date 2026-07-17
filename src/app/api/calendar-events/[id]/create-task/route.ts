import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const event = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) {
      throw new ApiError(404, "Termin nicht gefunden.");
    }

    const task = await prisma.task.create({
      data: {
        title: event.title,
        description: event.description,
        assigneeId: session.user.id,
        createdById: session.user.id,
        dueDate: event.startTime,
        calendarEvent: { connect: { id: event.id } },
        activities: { create: { userId: session.user.id, action: "AUS_TERMIN_ERSTELLT" } },
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Task",
      entityId: task.id,
      description: `Aufgabe "${task.title}" aus Outlook-Termin erstellt`,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
