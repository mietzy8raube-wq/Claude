import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { runDeadlineCheck } from "@/lib/notifications";

/**
 * Fristenprüfung manuell oder per Cron auslösen.
 * Cron: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/notifications/deadline-check`
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    const viaCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    if (!viaCron) {
      const session = await requireSession();
      if (session.user.role === "MITARBEITER") {
        throw new ApiError(403, "Keine Berechtigung.");
      }
    }
    const result = await runDeadlineCheck({ force: true });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
