import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createDecisionCommentSchema } from "@/lib/validations/decision";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createDecisionCommentSchema.parse(body);

    const comment = await prisma.decisionComment.create({
      data: { decisionId: id, authorId: session.user.id, content: data.content },
      include: { author: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
