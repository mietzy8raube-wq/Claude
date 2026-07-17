import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createResolutionSchema } from "@/lib/validations/meeting";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createResolutionSchema.parse(body);

    const resolution = await prisma.meetingResolution.create({
      data: {
        meetingId: id,
        title: data.title,
        description: data.description || null,
        responsibleId: data.responsibleId || null,
        dueDate: data.dueDate ?? null,
      },
      include: { responsible: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ resolution }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
