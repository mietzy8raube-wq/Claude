import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { updateOptionSchema } from "@/lib/validations/decision";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    await requireSession();
    const { id, optionId } = await params;
    const body = await request.json();
    const data = updateOptionSchema.parse(body);

    if (data.isChosen) {
      await prisma.decisionOption.updateMany({
        where: { decisionId: id, NOT: { id: optionId } },
        data: { isChosen: false },
      });
    }

    const option = await prisma.decisionOption.update({
      where: { id: optionId },
      data: {
        ...data,
        pros: data.pros === "" ? null : data.pros,
        cons: data.cons === "" ? null : data.cons,
      },
    });

    return NextResponse.json({ option });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> }
) {
  try {
    await requireSession();
    const { optionId } = await params;
    await prisma.decisionOption.delete({ where: { id: optionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
