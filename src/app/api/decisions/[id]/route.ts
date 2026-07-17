import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateDecisionSchema } from "@/lib/validations/decision";
import { logAudit } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;

    const decision = await prisma.decision.findUnique({
      where: { id },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        options: { orderBy: { position: "asc" } },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        linkedTasks: { include: { assignee: { select: { id: true, name: true } } } },
      },
    });

    if (!decision) {
      throw new ApiError(404, "Entscheidung nicht gefunden.");
    }

    return NextResponse.json({ decision });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateDecisionSchema.parse(body);

    const decision = await prisma.decision.update({
      where: { id },
      data: {
        ...data,
        description: data.description === "" ? null : data.description,
        background: data.background === "" ? null : data.background,
        finalDecision: data.finalDecision === "" ? null : data.finalDecision,
      },
      include: { responsible: { select: { id: true, name: true } }, options: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Decision",
      entityId: decision.id,
      description: `Entscheidung "${decision.title}" wurde aktualisiert`,
    });

    return NextResponse.json({ decision });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const decision = await prisma.decision.findUnique({ where: { id } });
    if (!decision) {
      throw new ApiError(404, "Entscheidung nicht gefunden.");
    }

    await prisma.decision.delete({ where: { id } });

    await logAudit({
      userId: session.user.id,
      action: "DELETE",
      entityType: "Decision",
      entityId: id,
      description: `Entscheidung "${decision.title}" wurde gelöscht`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
