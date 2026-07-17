import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateProjectSchema } from "@/lib/validations/project";
import { logAudit } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        milestones: { orderBy: { position: "asc" } },
        risks: { orderBy: { createdAt: "desc" } },
        files: { include: { uploadedBy: { select: { id: true, name: true } } } },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        decisions: { select: { id: true, title: true, status: true } },
      },
    });

    if (!project) {
      throw new ApiError(404, "Projekt nicht gefunden.");
    }

    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateProjectSchema.parse(body);
    const { participantIds, ...rest } = data;

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...rest,
        description: rest.description === "" ? null : rest.description,
        ...(participantIds
          ? { participants: { deleteMany: {}, create: participantIds.map((userId) => ({ userId })) } }
          : {}),
      },
      include: { owner: { select: { id: true, name: true } } },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Project",
      entityId: project.id,
      description: `Projekt "${project.name}" wurde aktualisiert`,
    });

    return NextResponse.json({ project });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new ApiError(404, "Projekt nicht gefunden.");
    }

    await prisma.project.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      entityType: "Project",
      entityId: id,
      description: `Projekt "${project.name}" wurde gelöscht`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
