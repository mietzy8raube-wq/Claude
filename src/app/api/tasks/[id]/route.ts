import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateTaskSchema } from "@/lib/validations/task";
import { logAudit } from "@/lib/audit";
import { notify, ticketLabel } from "@/lib/notifications";
import { STATUS_LABEL } from "@/components/tasks/badges";

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

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { participants: { select: { userId: true } } },
    });
    if (!existing) {
      throw new ApiError(404, "Aufgabe nicht gefunden.");
    }

    const statusChanged = data.status !== undefined && data.status !== existing.status;
    const { participantIds, checklistItems, ...rest } = data;
    void checklistItems;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...rest,
        description: rest.description === "" ? null : rest.description,
        ...(statusChanged ? { completedAt: data.status === "ERLEDIGT" ? new Date() : null } : {}),
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

    const label = ticketLabel(task);
    const actorId = session.user.id;

    // Neu zugewiesen → neuer Verantwortlicher wird benachrichtigt
    if (data.assigneeId !== undefined && data.assigneeId && data.assigneeId !== existing.assigneeId) {
      await notify({
        userIds: [data.assigneeId],
        actorId,
        type: "ZUGEWIESEN",
        title: `Ticket zugewiesen: ${label}`,
        message: `${session.user.name} hat Ihnen dieses Ticket zugewiesen${
          task.dueDate ? ` (fällig am ${task.dueDate.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})` : ""
        }.`,
        taskId: task.id,
      });
    }

    // Statuswechsel → Ersteller, Verantwortlicher und Beteiligte informieren
    if (statusChanged && data.status) {
      await notify({
        userIds: [existing.createdById, task.assigneeId, ...existing.participants.map((p) => p.userId)],
        actorId,
        type: "STATUS_GEAENDERT",
        title: `${STATUS_LABEL[data.status]}: ${label}`,
        message: `${session.user.name} hat den Status von „${STATUS_LABEL[existing.status]}“ auf „${STATUS_LABEL[data.status]}“ geändert.`,
        taskId: task.id,
      });
    }

    // Frist verschoben → Verantwortlicher informieren
    if (
      data.dueDate !== undefined &&
      (data.dueDate?.getTime() ?? null) !== (existing.dueDate?.getTime() ?? null) &&
      !(data.assigneeId && data.assigneeId !== existing.assigneeId)
    ) {
      await notify({
        userIds: [task.assigneeId],
        actorId,
        type: "STATUS_GEAENDERT",
        title: `Frist geändert: ${label}`,
        message: task.dueDate
          ? `Neue Frist: ${task.dueDate.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}.`
          : "Die Frist wurde entfernt.",
        taskId: task.id,
      });
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
