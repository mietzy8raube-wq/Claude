export const GRAPH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
  "MailboxSettings.Read",
];

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
    authority: `https://login.microsoftonline.com/${tenantId}`,
  };
}
