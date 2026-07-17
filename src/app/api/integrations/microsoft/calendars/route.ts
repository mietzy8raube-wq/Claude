import { NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { getValidAccessToken } from "@/lib/graph/tokenStore";
import { listCalendars } from "@/lib/graph/client";

export async function GET() {
  try {
    const session = await requireSession();

    try {
      const accessToken = await getValidAccessToken(session.user.id);
      const { value } = await listCalendars(accessToken);
      return NextResponse.json({ calendars: value });
    } catch (error) {
      throw new ApiError(502, error instanceof Error ? error.message : "Kalender konnten nicht geladen werden");
    }
  } catch (error) {
    return handleApiError(error);
  }
}
