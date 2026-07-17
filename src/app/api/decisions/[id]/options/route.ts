import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createOptionSchema } from "@/lib/validations/decision";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createOptionSchema.parse(body);

    const count = await prisma.decisionOption.count({ where: { decisionId: id } });
    const option = await prisma.decisionOption.create({
      data: {
        decisionId: id,
        title: data.title,
        pros: data.pros || null,
        cons: data.cons || null,
        position: count,
      },
    });

    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
