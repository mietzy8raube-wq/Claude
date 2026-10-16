import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { requireMailAccess, htmlToText } from "@/lib/mail/access";
import { getMessage } from "@/lib/graph/client";
import { priorityEnum } from "@/lib/validations/task";
import { notify, ticketLabel } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  assigneeId: z.string().optional().nullable(),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().optional().nullable(),
  projectId: z.string().optional().nullable(),
  note: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const data = schema.parse(await request.json().catch(() => ({})));
    const token = await requireMailAccess(session.user.id);
    const message = await getMessage(token, id);

    const from = message.from?.emailAddress;
    const fromLabel = from ? (from.name && from.name !== from.address ? `${from.name} <${from.address}>` : from.address) : null;
    const bodyText = message.body
      ? message.body.contentType === "html"
        ? htmlToText(message.body.content)
        : message.body.content.trim()
      : message.bodyPreview;
    const header = [
      fromLabel ? `Von: ${fromLabel}` : null,
      `Eingang: ${new Date(message.receivedDateTime).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
    ]
      .filter(Boolean)
      .join("\n");
    const description = [data.note?.trim(), header, bodyText].filter(Boolean).join("\n\n");

    const priority = data.priority ?? (message.importance === "high" ? "HOCH" : "MITTEL");

    const task = await prisma.task.create({
      data: {
        title: (data.title ?? message.subject ?? "E-Mail ohne Betreff").slice(0, 200),
        description: description.slice(0, 5000),
        assigneeId: data.assigneeId || null,
        createdById: session.user.id,
        priority,
        dueDate: data.dueDate ?? null,
        projectId: data.projectId || null,
        category: "E-Mail",
        sourceEmailId: message.id,
        sourceEmailLink: message.webLink ?? null,
        sourceEmailFrom: fromLabel,
        activities: { create: { userId: session.user.id, action: "AUS_EMAIL_ERSTELLT" } },
      },
    });

    await notify({
      userIds: [task.assigneeId],
      actorId: session.user.id,
      type: "ZUGEWIESEN",
      title: `Neues Ticket für Sie: ${ticketLabel(task)}`,
      message: `${session.user.name} hat aus einer E-Mail${fromLabel ? ` von ${fromLabel}` : ""} ein Ticket für Sie erstellt.`,
      taskId: task.id,
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Task",
      entityId: task.id,
      description: `Ticket "${task.title}" aus E-Mail erstellt`,
    });

    return NextResponse.json({ task: { id: task.id, ticketNumber: task.ticketNumber, title: task.title } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
