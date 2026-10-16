import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { runDeadlineCheck } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get("take") ?? 30) || 30, 100);

    // Fristen gedrosselt prüfen, damit Benachrichtigungen auch ohne Cron entstehen
    await runDeadlineCheck().catch((error) => console.error("Fristenprüfung fehlgeschlagen:", error));

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, type: true, title: true, message: true, link: true, isRead: true, createdAt: true, taskId: true },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

const markReadSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string()).min(1) }),
]);

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const data = markReadSchema.parse(await request.json());
    const where = "all" in data ? { userId: session.user.id } : { userId: session.user.id, id: { in: data.ids } };
    await prisma.notification.updateMany({ where: { ...where, isRead: false }, data: { isRead: true } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
