import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { z } from "zod";

export async function GET() {
  try {
    await requireSession();
    const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ departments });
  } catch (error) {
    return handleApiError(error);
  }
}

const createDepartmentSchema = z.object({ name: z.string().min(1).max(100) });

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const body = await request.json();
    const data = createDepartmentSchema.parse(body);
    const department = await prisma.department.create({ data });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
