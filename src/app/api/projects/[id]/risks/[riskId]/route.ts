import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { updateRiskSchema } from "@/lib/validations/project";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; riskId: string }> }
) {
  try {
    await requireSession();
    const { riskId } = await params;
    const body = await request.json();
    const data = updateRiskSchema.parse(body);
    const risk = await prisma.projectRisk.update({
      where: { id: riskId },
      data: { ...data, description: data.description === "" ? null : data.description, mitigation: data.mitigation === "" ? null : data.mitigation },
    });
    return NextResponse.json({ risk });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; riskId: string }> }
) {
  try {
    await requireSession();
    const { riskId } = await params;
    await prisma.projectRisk.delete({ where: { id: riskId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
