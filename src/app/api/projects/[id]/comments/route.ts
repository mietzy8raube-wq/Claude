import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createProjectCommentSchema } from "@/lib/validations/project";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createProjectCommentSchema.parse(body);

    const comment = await prisma.projectComment.create({
      data: { projectId: id, authorId: session.user.id, content: data.content },
      include: { author: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
