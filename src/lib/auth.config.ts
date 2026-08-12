import type { NextAuthConfig } from "next-auth";

/**
 * Edge-kompatible Basis-Konfiguration (kein Prisma/bcrypt).
 * Wird von der Middleware genutzt; die volle Konfiguration mit dem
 * Credentials-Provider liegt in `auth.ts` und läuft nur in der Node.js-Runtime.
 */
export default {
  // Außerhalb von Vercel (z. B. eigener Server/Docker) muss Auth.js dem
  // Host-Header explizit vertrauen, sonst schlägt die Anmeldung mit
  // "UntrustedHost" fehl.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized: ({ auth }) => !!auth?.user,
  },
} satisfies NextAuthConfig;
