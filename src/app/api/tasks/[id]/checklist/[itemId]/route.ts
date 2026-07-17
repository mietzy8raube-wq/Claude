import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { updateChecklistItemSchema } from "@/lib/validations/task";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requireSession();
    const { itemId } = await params;
    const body = await request.json();
    const data = updateChecklistItemSchema.parse(body);

    const item = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data,
    });

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await requireSession();
    const { itemId } = await params;
    await prisma.taskChecklistItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
