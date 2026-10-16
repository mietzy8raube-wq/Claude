import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { requireMailAccess } from "@/lib/mail/access";
import { listMessages } from "@/lib/graph/client";

const FOLDERS = new Set(["inbox", "sentitems", "archive"]);

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") ?? "inbox";
    if (!FOLDERS.has(folder)) throw new ApiError(400, "Unbekannter Ordner.");
    const q = searchParams.get("q")?.trim() || undefined;
    const skip = Math.max(0, Number(searchParams.get("skip") ?? 0) || 0);

    const token = await requireMailAccess(session.user.id);
    const result = await listMessages(token, { folder, search: q, skip, top: 25 });

    // Bereits aus E-Mails erstellte Tickets markieren
    const ids = result.value.map((m) => m.id);
    const tickets = ids.length
      ? await prisma.task.findMany({
          where: { sourceEmailId: { in: ids } },
          select: { id: true, ticketNumber: true, sourceEmailId: true, status: true },
        })
      : [];

    return NextResponse.json({
      messages: result.value.map((m) => ({
        ...m,
        tickets: tickets.filter((t) => t.sourceEmailId === m.id).map(({ id, ticketNumber, status }) => ({ id, ticketNumber, status })),
      })),
      hasMore: !q && Boolean(result["@odata.nextLink"]),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
