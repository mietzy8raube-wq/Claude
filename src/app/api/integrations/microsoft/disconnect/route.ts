import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const session = await requireSession();

    await prisma.microsoftConnection.delete({ where: { userId: session.user.id } }).catch(() => null);

    await logAudit({
      userId: session.user.id,
      action: "DISCONNECT_INTEGRATION",
      entityType: "MicrosoftConnection",
      description: "Microsoft-365-Konto getrennt",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
