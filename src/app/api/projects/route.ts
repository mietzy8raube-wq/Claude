import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createProjectSchema } from "@/lib/validations/project";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const projects = await prisma.project.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true } } } },
        milestones: { orderBy: { position: "asc" } },
        risks: true,
        _count: { select: { tasks: true, files: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ projects });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description || null,
        status: data.status,
        progress: data.progress,
        startDate: data.startDate ?? null,
        targetDate: data.targetDate ?? null,
        ownerId: data.ownerId,
        budget: data.budget ?? null,
        budgetSpent: data.budgetSpent ?? null,
        participants: data.participantIds?.length
          ? { create: data.participantIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Project",
      entityId: project.id,
      description: `Projekt "${project.name}" wurde erstellt`,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
