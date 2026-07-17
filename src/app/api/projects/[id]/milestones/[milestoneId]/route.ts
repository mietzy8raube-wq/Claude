import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { updateMilestoneSchema } from "@/lib/validations/project";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    await requireSession();
    const { milestoneId } = await params;
    const body = await request.json();
    const data = updateMilestoneSchema.parse(body);
    const milestone = await prisma.projectMilestone.update({ where: { id: milestoneId }, data });
    return NextResponse.json({ milestone });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  try {
    await requireSession();
    const { milestoneId } = await params;
    await prisma.projectMilestone.delete({ where: { id: milestoneId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
