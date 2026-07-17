import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createRiskSchema } from "@/lib/validations/project";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createRiskSchema.parse(body);

    const risk = await prisma.projectRisk.create({
      data: {
        projectId: id,
        title: data.title,
        description: data.description || null,
        impact: data.impact,
        status: data.status,
        mitigation: data.mitigation || null,
      },
    });

    return NextResponse.json({ risk }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
