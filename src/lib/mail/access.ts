import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-utils";
import { MAIL_SCOPES, hasScopes, isMicrosoftGraphConfigured } from "@/lib/graph/config";
import { getValidAccessToken } from "@/lib/graph/tokenStore";

/** Liefert einen Access Token mit Postfachrechten oder einen verständlichen Fehler. */
export async function requireMailAccess(userId: string) {
  if (!isMicrosoftGraphConfigured()) {
    throw new ApiError(409, "Microsoft 365 ist nicht konfiguriert. Bitte die Zugangsdaten in der .env hinterlegen.");
  }
  const connection = await prisma.microsoftConnection.findUnique({ where: { userId }, select: { scopes: true } });
  if (!connection) {
    throw new ApiError(409, "Kein Microsoft-365-Konto verbunden. Bitte unter „Integrationen“ verbinden.");
  }
  if (!hasScopes(connection.scopes, MAIL_SCOPES)) {
    throw new ApiError(
      409,
      "Für das Postfach fehlen Berechtigungen. Bitte die Microsoft-Verbindung unter „Integrationen“ trennen und neu verbinden."
    );
  }
  try {
    return await getValidAccessToken(userId);
  } catch {
    throw new ApiError(502, "Die Microsoft-Anmeldung ist abgelaufen. Bitte unter „Integrationen“ neu verbinden.");
  }
}

/** Wandelt einen HTML-Mailtext in lesbaren Klartext um (für Ticketbeschreibungen). */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
