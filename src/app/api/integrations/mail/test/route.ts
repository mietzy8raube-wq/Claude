import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { getMailSender, hasScopes, isSystemMailConfigured } from "@/lib/graph/config";
import { getAppOnlyAccessToken } from "@/lib/graph/oauth";
import { getValidAccessToken } from "@/lib/graph/tokenStore";
import { sendMailAsMe, sendMailAsUser } from "@/lib/graph/client";
import { renderNotificationEmail } from "@/lib/mail/notification-mailer";

/** Sendet eine Test-Benachrichtigung an den angemeldeten Benutzer. */
export async function POST() {
  try {
    const session = await requireSession();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, microsoftConnection: { select: { scopes: true } } },
    });
    const { subject, html } = renderNotificationEmail(
      { title: "Test: E-Mail-Benachrichtigungen funktionieren", message: "Diese Nachricht wurde über Microsoft 365 versendet.", link: "/settings" },
      user.name
    );
    const mail = { to: [{ name: user.name, email: user.email }], subject, html };

    try {
      if (isSystemMailConfigured()) {
        await sendMailAsUser(await getAppOnlyAccessToken(), getMailSender()!, mail);
        return NextResponse.json({ via: "system", sender: getMailSender() });
      }
      if (user.microsoftConnection && hasScopes(user.microsoftConnection.scopes, ["Mail.Send"])) {
        await sendMailAsMe(await getValidAccessToken(user.id), mail);
        return NextResponse.json({ via: "own-mailbox" });
      }
    } catch (error) {
      throw new ApiError(502, error instanceof Error ? error.message : "Versand fehlgeschlagen.");
    }
    throw new ApiError(
      409,
      "Kein Versandweg verfügbar: MICROSOFT_MAIL_SENDER konfigurieren oder das eigene Microsoft-Konto (mit Mail.Send) verbinden."
    );
  } catch (error) {
    return handleApiError(error);
  }
}
