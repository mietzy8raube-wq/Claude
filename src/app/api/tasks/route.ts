import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createTaskSchema } from "@/lib/validations/task";
import { logAudit } from "@/lib/audit";
import type { Prisma, TaskStatus, Priority, TaskVisibility } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get("scope") ?? "all";
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const projectId = searchParams.get("projectId");
    const departmentId = searchParams.get("departmentId");
    const companyAreaId = searchParams.get("companyAreaId");
    const visibility = searchParams.get("visibility");
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");
    const q = searchParams.get("q");

    const where: Prisma.TaskWhereInput = {};

    if (scope === "mine") {
      where.OR = [{ assigneeId: userId }, { participants: { some: { userId } } }];
    } else {
      where.OR = [{ visibility: "GEMEINSAM" }, { assigneeId: userId }, { createdById: userId }];
    }

    if (status) where.status = status as TaskStatus;
    if (priority) where.priority = priority as Priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (projectId) where.projectId = projectId;
    if (departmentId) where.departmentId = departmentId;
    if (companyAreaId) where.companyAreaId = companyAreaId;
    if (visibility) where.visibility = visibility as TaskVisibility;
    if (dueFrom || dueTo) {
      where.dueDate = {
        ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
        ...(dueTo ? { lte: new Date(dueTo) } : {}),
      };
    }
    if (q) {
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        companyArea: { select: { id: true, name: true, type: true } },
        checklistItems: true,
        _count: { select: { comments: true, attachments: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createTaskSchema.parse(body);

    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description || null,
        assigneeId: data.assigneeId || null,
        createdById: session.user.id,
        priority: data.priority,
        status: data.status,
        visibility: data.visibility,
        dueDate: data.dueDate ?? null,
        projectId: data.projectId || null,
        departmentId: data.departmentId || null,
        companyAreaId: data.companyAreaId || null,
        decisionId: data.decisionId || null,
        category: data.category || null,
        isRecurring: data.isRecurring,
        recurrenceFrequency: data.recurrenceFrequency ?? null,
        recurrenceInterval: data.recurrenceInterval ?? null,
        recurrenceEndDate: data.recurrenceEndDate ?? null,
        reminderAt: data.reminderAt ?? null,
        participants: data.participantIds?.length
          ? { create: data.participantIds.map((userId) => ({ userId })) }
          : undefined,
        checklistItems: data.checklistItems?.length
          ? {
              create: data.checklistItems.map((title, index) => ({
                title,
                position: index,
              })),
            }
          : undefined,
        activities: {
          create: {
            userId: session.user.id,
            action: "ERSTELLT",
          },
        },
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        checklistItems: true,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Task",
      entityId: task.id,
      description: `Aufgabe "${task.title}" wurde erstellt`,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
