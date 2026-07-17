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
