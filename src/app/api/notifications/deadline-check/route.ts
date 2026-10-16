import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireCronOrManager } from "@/lib/api-utils";
import { runDeadlineCheck } from "@/lib/notifications";
import { dispatchNotificationEmails } from "@/lib/mail/notification-mailer";

/**
 * Fristenprüfung (inkl. E-Mail-Versand) manuell oder per Cron auslösen.
 * Cron: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/notifications/deadline-check`
 */
export async function POST(request: NextRequest) {
  try {
    await requireCronOrManager(request);
    const result = await runDeadlineCheck({ force: true });
    const emails = await dispatchNotificationEmails();
    return NextResponse.json({ ...result, emails });
  } catch (error) {
    return handleApiError(error);
  }
}
