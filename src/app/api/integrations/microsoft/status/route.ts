import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { isMicrosoftGraphConfigured } from "@/lib/graph/config";

export async function GET() {
  try {
    const session = await requireSession();

    const connection = await prisma.microsoftConnection.findUnique({
      where: { userId: session.user.id },
      include: { syncLogs: { orderBy: { createdAt: "desc" }, take: 10 } },
    });

    return NextResponse.json({
      configured: isMicrosoftGraphConfigured(),
      connection: connection
        ? {
            email: connection.email,
            displayName: connection.displayName,
            selectedCalendarId: connection.selectedCalendarId,
            selectedCalendarName: connection.selectedCalendarName,
            syncIntervalMinutes: connection.syncIntervalMinutes,
            autoSyncEnabled: connection.autoSyncEnabled,
            lastSyncAt: connection.lastSyncAt,
            lastSyncStatus: connection.lastSyncStatus,
            lastSyncError: connection.lastSyncError,
            scopes: connection.scopes,
            syncLogs: connection.syncLogs,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
