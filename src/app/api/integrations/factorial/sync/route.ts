import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireCronOrManager, ApiError } from "@/lib/api-utils";
import { isFactorialConfigured } from "@/lib/factorial/client";
import { runFactorialSync } from "@/lib/factorial/sync";
import { runDeadlineCheck } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const schema = z.object({ createMissingUsers: z.boolean().optional().default(false) });

/**
 * Factorial-Abgleich manuell (Geschäftsführung/Administration) oder per Cron:
 * `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/integrations/factorial/sync`
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireCronOrManager(request);
    if (!isFactorialConfigured()) {
      throw new ApiError(409, "Factorial ist nicht konfiguriert. Bitte FACTORIAL_API_KEY in der .env-Datei hinterlegen.");
    }
    const body = await request.json().catch(() => ({}));
    const { createMissingUsers } = schema.parse(body ?? {});
    if (createMissingUsers && session && session.user.role !== "ADMINISTRATOR") {
      throw new ApiError(403, "Nur Administratoren dürfen Benutzerkonten anlegen lassen.");
    }

    let result;
    try {
      result = await runFactorialSync({ createMissingUsers });
    } catch (error) {
      throw new ApiError(502, error instanceof Error ? error.message : "Factorial-Abgleich fehlgeschlagen.");
    }

    // Neue Abwesenheiten können sofort Vertretungsbedarf auslösen
    await runDeadlineCheck({ force: true }).catch((e) => console.error("Fristenprüfung fehlgeschlagen:", e));

    await logAudit({
      userId: session?.user.id ?? null,
      action: "SYNC",
      entityType: "Factorial",
      description: `Factorial-Abgleich: ${result.absencesSynced} Abwesenheiten, ${result.employeesMatched} Mitarbeiter verknüpft`,
      metadata: { ...result, unmatched: result.unmatched.length },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
