import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createMeetingSchema } from "@/lib/validations/meeting";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const meetings = await prisma.meeting.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        attendees: true,
        agendaItems: { orderBy: { position: "asc" } },
        resolutions: true,
        _count: { select: { attachments: true } },
      },
      orderBy: { meetingDate: "desc" },
    });
    return NextResponse.json({ meetings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createMeetingSchema.parse(body);

    const attendeeUsers = data.attendeeUserIds?.length
      ? await prisma.user.findMany({ where: { id: { in: data.attendeeUserIds } } })
      : [];

    const meeting = await prisma.meeting.create({
      data: {
        title: data.title,
        meetingDate: data.meetingDate,
        location: data.location || null,
        notes: data.notes || null,
        createdById: session.user.id,
        attendees: {
          create: [
            ...attendeeUsers.map((u) => ({ userId: u.id, name: u.name, email: u.email })),
            ...(data.externalAttendees ?? []).map((a) => ({ name: a.name, email: a.email || null })),
          ],
        },
        agendaItems: {
          create: (data.agendaItems ?? []).map((title, index) => ({ title, position: index })),
        },
      },
      include: { attendees: true, agendaItems: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Meeting",
      entityId: meeting.id,
      description: `Meeting "${meeting.title}" wurde erstellt`,
    });

    return NextResponse.json({ meeting }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
