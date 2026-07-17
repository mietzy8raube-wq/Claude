import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireSession();
    const areas = await prisma.companyArea.findMany({
      include: {
        responsible: { select: { id: true, name: true } },
        _count: { select: { metrics: true, notes: true, documents: true, tasks: true, contacts: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ areas });
  } catch (error) {
    return handleApiError(error);
  }
}
