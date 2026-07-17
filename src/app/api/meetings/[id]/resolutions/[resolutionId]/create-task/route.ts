import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; resolutionId: string }> }
) {
  try {
    const session = await requireSession();
    const { resolutionId } = await params;

    const resolution = await prisma.meetingResolution.findUnique({
      where: { id: resolutionId },
      include: { generatedTask: true, meeting: { select: { title: true } } },
    });

    if (!resolution) {
      throw new ApiError(404, "Beschluss nicht gefunden.");
    }
    if (resolution.generatedTask) {
      throw new ApiError(409, "Für diesen Beschluss wurde bereits eine Aufgabe erstellt.");
    }

    const task = await prisma.task.create({
      data: {
        title: resolution.title,
        description: resolution.description
          ? `${resolution.description}\n\n(Aus Meeting: ${resolution.meeting.title})`
          : `Aus Meeting: ${resolution.meeting.title}`,
        assigneeId: resolution.responsibleId,
        createdById: session.user.id,
        dueDate: resolution.dueDate,
        meetingResolutionId: resolution.id,
        activities: { create: { userId: session.user.id, action: "AUS_MEETING_ERSTELLT" } },
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Task",
      entityId: task.id,
      description: `Aufgabe "${task.title}" aus Meetingbeschluss erstellt`,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
