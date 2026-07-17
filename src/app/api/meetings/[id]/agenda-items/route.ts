import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createAgendaItemSchema } from "@/lib/validations/meeting";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createAgendaItemSchema.parse(body);

    const count = await prisma.meetingAgendaItem.count({ where: { meetingId: id } });
    const item = await prisma.meetingAgendaItem.create({
      data: { meetingId: id, title: data.title, position: count },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
