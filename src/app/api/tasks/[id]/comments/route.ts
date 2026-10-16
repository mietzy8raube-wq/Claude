import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { createCommentSchema } from "@/lib/validations/task";
import { notify, ticketLabel } from "@/lib/notifications";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createCommentSchema.parse(body);

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, ticketNumber: true, title: true, assigneeId: true, createdById: true, participants: { select: { userId: true } } },
    });
    if (!task) throw new ApiError(404, "Aufgabe nicht gefunden.");

    const comment = await prisma.taskComment.create({
      data: { taskId: id, authorId: session.user.id, content: data.content },
      include: { author: { select: { id: true, name: true } } },
    });

    await notify({
      userIds: [task.assigneeId, task.createdById, ...task.participants.map((p) => p.userId)],
      actorId: session.user.id,
      type: "KOMMENTAR",
      title: `Neuer Kommentar: ${ticketLabel(task)}`,
      message: `${session.user.name}: ${data.content.length > 160 ? data.content.slice(0, 157) + "…" : data.content}`,
      taskId: task.id,
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
