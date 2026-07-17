import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/lib/auth.config";

// Eigene, Edge-kompatible Auth-Instanz nur für die Middleware (kein Prisma/bcrypt).
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isPublic = PUBLIC_PATHS.some((path) => nextUrl.pathname.startsWith(path));
  const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

  if (isPublic || isAuthApi) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
