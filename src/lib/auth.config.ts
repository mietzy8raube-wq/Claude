import type { NextAuthConfig } from "next-auth";

/**
 * Edge-kompatible Basis-Konfiguration (kein Prisma/bcrypt).
 * Wird von der Middleware genutzt; die volle Konfiguration mit dem
 * Credentials-Provider liegt in `auth.ts` und läuft nur in der Node.js-Runtime.
 */
export default {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized: ({ auth }) => !!auth?.user,
  },
} satisfies NextAuthConfig;
