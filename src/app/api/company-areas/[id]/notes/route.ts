import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createCompanyNoteSchema } from "@/lib/validations/company";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createCompanyNoteSchema.parse(body);

    const note = await prisma.companyNote.create({
      data: { companyAreaId: id, authorId: session.user.id, content: data.content },
      include: { author: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
