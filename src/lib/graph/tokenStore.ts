import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { refreshAccessToken, type TokenResponse } from "./oauth";

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // Token 5 Minuten vor Ablauf erneuern

export async function saveTokens(
  userId: string,
  tokens: TokenResponse,
  profile: { microsoftUserId: string; email: string; displayName: string }
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  return prisma.microsoftConnection.upsert({
    where: { userId },
    create: {
      userId,
      microsoftUserId: profile.microsoftUserId,
      email: profile.email,
      displayName: profile.displayName,
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: encrypt(tokens.refresh_token ?? ""),
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope,
    },
    update: {
      microsoftUserId: profile.microsoftUserId,
      email: profile.email,
      displayName: profile.displayName,
      accessTokenEncrypted: encrypt(tokens.access_token),
      ...(tokens.refresh_token ? { refreshTokenEncrypted: encrypt(tokens.refresh_token) } : {}),
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope,
    },
  });
}

/**
 * Liefert einen gültigen (ggf. per Refresh Token erneuerten) Access Token für
 * die Microsoft-Graph-Verbindung des Benutzers.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await prisma.microsoftConnection.findUnique({ where: { userId } });
  if (!connection) {
    throw new Error("Kein verbundenes Microsoft-Konto gefunden.");
  }

  const needsRefresh = connection.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
  if (!needsRefresh) {
    return decrypt(connection.accessTokenEncrypted);
  }

  const refreshToken = decrypt(connection.refreshTokenEncrypted);
  try {
    const tokens = await refreshAccessToken(refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.microsoftConnection.update({
      where: { userId },
      data: {
        accessTokenEncrypted: encrypt(tokens.access_token),
        ...(tokens.refresh_token ? { refreshTokenEncrypted: encrypt(tokens.refresh_token) } : {}),
        tokenExpiresAt: expiresAt,
      },
    });

    return tokens.access_token;
  } catch (error) {
    await prisma.microsoftConnection.update({
      where: { userId },
      data: {
        lastSyncStatus: "FEHLER",
        lastSyncError: error instanceof Error ? error.message : "Token-Aktualisierung fehlgeschlagen",
      },
    });
    throw error;
  }
}
