import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createMetricSchema } from "@/lib/validations/company";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createMetricSchema.parse(body);

    const metric = await prisma.companyMetric.create({
      data: {
        companyAreaId: id,
        name: data.name,
        value: data.value,
        unit: data.unit || null,
        target: data.target ?? null,
        period: data.period,
      },
    });

    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
