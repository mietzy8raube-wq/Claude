import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateMeetingSchema } from "@/lib/validations/meeting";
import { logAudit } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        attendees: { include: { user: { select: { id: true, name: true } } } },
        agendaItems: { orderBy: { position: "asc" } },
        resolutions: {
          include: { responsible: { select: { id: true, name: true } }, generatedTask: { select: { id: true } } },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
      },
    });

    if (!meeting) {
      throw new ApiError(404, "Meeting nicht gefunden.");
    }

    return NextResponse.json({ meeting });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateMeetingSchema.parse(body);

    const meeting = await prisma.meeting.update({
      where: { id },
      data: { ...data, location: data.location === "" ? null : data.location, notes: data.notes === "" ? null : data.notes },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Meeting",
      entityId: meeting.id,
      description: `Meeting "${meeting.title}" wurde aktualisiert`,
    });

    return NextResponse.json({ meeting });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) {
      throw new ApiError(404, "Meeting nicht gefunden.");
    }

    await prisma.meeting.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      entityType: "Meeting",
      entityId: id,
      description: `Meeting "${meeting.title}" wurde gelöscht`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
