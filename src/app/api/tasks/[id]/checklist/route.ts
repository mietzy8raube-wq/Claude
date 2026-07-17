import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createChecklistItemSchema } from "@/lib/validations/task";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createChecklistItemSchema.parse(body);

    const count = await prisma.taskChecklistItem.count({ where: { taskId: id } });

    const item = await prisma.taskChecklistItem.create({
      data: { taskId: id, title: data.title, position: count },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
