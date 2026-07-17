import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";

const settingsSchema = z.object({
  selectedCalendarId: z.string().optional().nullable(),
  selectedCalendarName: z.string().optional().nullable(),
  syncIntervalMinutes: z.coerce.number().int().min(5).max(1440).optional(),
  autoSyncEnabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = settingsSchema.parse(body);

    const connection = await prisma.microsoftConnection.update({
      where: { userId: session.user.id },
      data,
    });

    return NextResponse.json({ connection });
  } catch (error) {
    return handleApiError(error);
  }
}
