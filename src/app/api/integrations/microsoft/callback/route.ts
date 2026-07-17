import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/graph/oauth";
import { getMe } from "@/lib/graph/client";
import { saveTokens } from "@/lib/graph/tokenStore";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
  const redirectTo = (params: Record<string, string>) => {
    const url = new URL("/integrations", baseUrl);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return NextResponse.redirect(url);
  };

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");
  const storedState = request.cookies.get("ms_oauth_state")?.value;

  if (errorParam) {
    return redirectTo({ error: "denied" });
  }

  if (!code || !state || !storedState || state !== storedState) {
    return redirectTo({ error: "invalid_state" });
  }

  const [expectedUserId] = state.split(".");
  if (expectedUserId !== session.user.id) {
    return redirectTo({ error: "invalid_state" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getMe(tokens.access_token);

    await saveTokens(session.user.id, tokens, {
      microsoftUserId: profile.id,
      email: profile.mail || profile.userPrincipalName,
      displayName: profile.displayName,
    });

    await logAudit({
      userId: session.user.id,
      action: "CONNECT_INTEGRATION",
      entityType: "MicrosoftConnection",
      description: `Microsoft-365-Konto (${profile.mail || profile.userPrincipalName}) verbunden`,
    });

    const response = redirectTo({ connected: "1" });
    response.cookies.delete("ms_oauth_state");
    return response;
  } catch (error) {
    console.error("Microsoft OAuth Callback Fehler:", error);
    return redirectTo({ error: "exchange_failed" });
  }
}
