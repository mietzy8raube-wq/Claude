import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createMilestoneSchema } from "@/lib/validations/project";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createMilestoneSchema.parse(body);

    const count = await prisma.projectMilestone.count({ where: { projectId: id } });
    const milestone = await prisma.projectMilestone.create({
      data: { projectId: id, title: data.title, dueDate: data.dueDate ?? null, position: count },
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
