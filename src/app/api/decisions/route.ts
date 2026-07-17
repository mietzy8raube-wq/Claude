import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createDecisionSchema } from "@/lib/validations/decision";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const decisions = await prisma.decision.findMany({
      include: {
        responsible: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        options: { orderBy: { position: "asc" } },
        _count: { select: { comments: true, linkedTasks: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ decisions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createDecisionSchema.parse(body);

    const decision = await prisma.decision.create({
      data: {
        title: data.title,
        description: data.description || null,
        background: data.background || null,
        responsibleId: data.responsibleId,
        decisionDeadline: data.decisionDeadline ?? null,
        status: data.status,
        finalDecision: data.finalDecision || null,
        decisionDate: data.decisionDate ?? null,
        projectId: data.projectId || null,
        options: data.options?.length
          ? {
              create: data.options.map((option, index) => ({
                title: option.title,
                pros: option.pros || null,
                cons: option.cons || null,
                position: index,
              })),
            }
          : undefined,
      },
      include: { responsible: { select: { id: true, name: true } }, options: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Decision",
      entityId: decision.id,
      description: `Entscheidung "${decision.title}" wurde erstellt`,
    });

    return NextResponse.json({ decision }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
