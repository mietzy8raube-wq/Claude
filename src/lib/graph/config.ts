export const GRAPH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "MailboxSettings.Read",
  "Mail.Read",
  "Mail.Send",
];

/** Scopes, die für die Postfach-Funktionen (Lesen/Antworten) vorhanden sein müssen. */
export const MAIL_SCOPES = ["Mail.Read", "Mail.Send"];

export function hasScopes(granted: string | null | undefined, required: string[]) {
  const set = new Set((granted ?? "").split(/\s+/).map((s) => s.toLowerCase()));
  return required.every((scope) => set.has(scope.toLowerCase()));
}

/** Anmelde-Host (für nationale Clouds überschreibbar, z. B. login.microsoftonline.us). */
export function getLoginHost() {
  return (process.env.MICROSOFT_LOGIN_HOST || "https://login.microsoftonline.com").replace(/\/$/, "");
}

/** Graph-Basis-URL (für nationale Clouds überschreibbar, z. B. https://graph.microsoft.us/v1.0). */
export function getGraphBaseUrl() {
  return (process.env.MICROSOFT_GRAPH_BASE_URL || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
}

/**
 * Systemversand von E-Mails (Benachrichtigungen) über ein zentrales Postfach,
 * z. B. tickets@firma.de. Benötigt die Anwendungsberechtigung Mail.Send
 * (Admin-Consent) – unabhängig von verbundenen Benutzerkonten.
 */
export function getMailSender(): string | null {
  return process.env.MICROSOFT_MAIL_SENDER?.trim() || null;
}

export function isSystemMailConfigured() {
  return Boolean(
    getMailSender() &&
      process.env.MICROSOFT_TENANT_ID &&
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET
  );
}

export function isMicrosoftGraphConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_TENANT_ID &&
      process.env.MICROSOFT_CLIENT_ID &&
      process.env.MICROSOFT_CLIENT_SECRET &&
      process.env.MICROSOFT_REDIRECT_URI
  );
}

export function getMicrosoftEnv() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

  if (!tenantId || !clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Microsoft Graph ist nicht konfiguriert. Bitte MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, " +
        "MICROSOFT_CLIENT_SECRET und MICROSOFT_REDIRECT_URI in der .env-Datei hinterlegen."
    );
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    authority: `${getLoginHost()}/${tenantId}`,
  };
}
