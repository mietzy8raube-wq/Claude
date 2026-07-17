import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createCommentSchema } from "@/lib/validations/task";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createCommentSchema.parse(body);

    const comment = await prisma.taskComment.create({
      data: { taskId: id, authorId: session.user.id, content: data.content },
      include: { author: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
