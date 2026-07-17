import { NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { getAuthorizationUrl } from "@/lib/graph/oauth";
import { isMicrosoftGraphConfigured } from "@/lib/graph/config";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }

  if (!isMicrosoftGraphConfigured()) {
    const url = new URL("/integrations", process.env.NEXTAUTH_URL);
    url.searchParams.set("error", "not_configured");
    return NextResponse.redirect(url);
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const state = `${session.user.id}.${nonce}`;

  const authUrl = getAuthorizationUrl(state);
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
