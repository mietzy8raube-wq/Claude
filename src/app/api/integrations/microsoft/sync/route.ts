import { NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { syncUserCalendar } from "@/lib/graph/sync";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const session = await requireSession();

    try {
      const result = await syncUserCalendar(session.user.id);

      await logAudit({
        userId: session.user.id,
        action: "SYNC",
        entityType: "MicrosoftConnection",
        description: `Outlook-Kalender synchronisiert (${result.itemsSynced} Termine)`,
      });

      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      throw new ApiError(502, error instanceof Error ? error.message : "Synchronisierung fehlgeschlagen");
    }
  } catch (error) {
    return handleApiError(error);
  }
}
