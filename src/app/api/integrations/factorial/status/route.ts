import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { isFactorialConfigured } from "@/lib/factorial/client";

export async function GET() {
  try {
    await requireSession();
    const [logs, linkedUsers, upcomingAbsences] = await Promise.all([
      prisma.factorialSyncLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.user.count({ where: { factorialEmployeeId: { not: null } } }),
      prisma.absence.count({ where: { OR: [{ finishOn: null }, { finishOn: { gte: new Date() } }] } }),
    ]);
    return NextResponse.json({ configured: isFactorialConfigured(), logs, linkedUsers, upcomingAbsences });
  } catch (error) {
    return handleApiError(error);
  }
}
