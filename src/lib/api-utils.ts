import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new ApiError(401, "Nicht angemeldet.");
  }
  return session;
}

/** Aufruf durch einen Cron-Job mit `Authorization: Bearer $CRON_SECRET`. */
export function isCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Erlaubt Cron-Aufrufe oder angemeldete Geschäftsführer/Administratoren. */
export async function requireCronOrManager(request: Request) {
  if (isCronRequest(request)) return null;
  const session = await requireSession();
  if (session.user.role === "MITARBEITER") {
    throw new ApiError(403, "Keine Berechtigung.");
  }
  return session;
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: error.flatten() },
      { status: 400 }
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
}
