import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateTaskSchema } from "@/lib/validations/task";
import { logAudit } from "@/lib/audit";

function nextRecurrenceDate(from: Date, frequency: string, interval: number): Date {
  const next = new Date(from);
  switch (frequency) {
    case "TAEGLICH":
      next.setDate(next.getDate() + interval);
      break;
    case "WOECHENTLICH":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "MONATLICH":
      next.setMonth(next.getMonth() + interval);
      break;
    case "JAEHRLICH":
      next.setFullYear(next.getFullYear() + interval);
      break;
  }
  return next;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        project: { select: { id: true, name: true } },
        department: true,
        companyArea: true,
        decision: { select: { id: true, title: true } },
        checklistItems: { orderBy: { position: "asc" } },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        attachments: { include: { uploadedBy: { select: { id: true, name: true } } } },
        activities: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        calendarEvent: true,
      },
    });

    if (!task) {
      throw new ApiError(404, "Aufgabe nicht gefunden.");
    }

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateTaskSchema.parse(body);

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Aufgabe nicht gefunden.");
    }

    const { participantIds, checklistItems, ...rest } = data;
    void checklistItems;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...rest,
        description: rest.description === "" ? null : rest.description,
        ...(participantIds
          ? {
              participants: {
                deleteMany: {},
                create: participantIds.map((userId) => ({ userId })),
              },
            }
          : {}),
        activities: {
          create: {
            userId: session.user.id,
            action: "AKTUALISIERT",
            details: { changed: Object.keys(rest) },
          },
        },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        checklistItems: true,
      },
    });

    // Wiederkehrende Aufgabe: bei Erledigung automatisch nächste Instanz anlegen
    if (
      data.status === "ERLEDIGT" &&
      existing.status !== "ERLEDIGT" &&
      existing.isRecurring &&
      existing.recurrenceFrequency
    ) {
      const baseDate = existing.dueDate ?? new Date();
      const nextDue = nextRecurrenceDate(
        baseDate,
        existing.recurrenceFrequency,
        existing.recurrenceInterval ?? 1
      );
      const withinRange = !existing.recurrenceEndDate || nextDue <= existing.recurrenceEndDate;
      if (withinRange) {
        await prisma.task.create({
          data: {
            title: existing.title,
            description: existing.description,
            assigneeId: existing.assigneeId,
            createdById: existing.createdById,
            priority: existing.priority,
            status: "OFFEN",
            visibility: existing.visibility,
            dueDate: nextDue,
            projectId: existing.projectId,
            departmentId: existing.departmentId,
            companyAreaId: existing.companyAreaId,
            category: existing.category,
            isRecurring: true,
            recurrenceFrequency: existing.recurrenceFrequency,
            recurrenceInterval: existing.recurrenceInterval,
            recurrenceEndDate: existing.recurrenceEndDate,
          },
        });
      }
    }

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Task",
      entityId: task.id,
      description: `Aufgabe "${task.title}" wurde aktualisiert`,
    });

    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new ApiError(404, "Aufgabe nicht gefunden.");
    }

    await prisma.task.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      entityType: "Task",
      entityId: id,
      description: `Aufgabe "${task.title}" wurde gelöscht`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
