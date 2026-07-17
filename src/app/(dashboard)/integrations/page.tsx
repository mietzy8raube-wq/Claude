import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { MicrosoftConnectionCard } from "@/components/integrations/microsoft-connection-card";
import { OneDriveCard } from "@/components/integrations/onedrive-card";
import { PermissionsCard } from "@/components/integrations/permissions-card";
import { isMicrosoftGraphConfigured } from "@/lib/graph/config";
import type { ConnectionStatus } from "@/types/integration";

export default async function IntegrationsPage() {
  const session = await auth();
  const configured = isMicrosoftGraphConfigured();

  const connection = session?.user
    ? await prisma.microsoftConnection.findUnique({
        where: { userId: session.user.id },
        include: { syncLogs: { orderBy: { createdAt: "desc" }, take: 10 } },
      })
    : null;

  const initialConnection: ConnectionStatus | null = connection
    ? {
        email: connection.email,
        displayName: connection.displayName,
        selectedCalendarId: connection.selectedCalendarId,
        selectedCalendarName: connection.selectedCalendarName,
        syncIntervalMinutes: connection.syncIntervalMinutes,
        autoSyncEnabled: connection.autoSyncEnabled,
        lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
        lastSyncStatus: connection.lastSyncStatus,
        lastSyncError: connection.lastSyncError,
        scopes: connection.scopes,
        syncLogs: connection.syncLogs.map((l) => ({
          id: l.id,
          status: l.status,
          message: l.message,
          itemsSynced: l.itemsSynced,
          itemsFailed: l.itemsFailed,
          createdAt: l.createdAt.toISOString(),
        })),
      }
    : null;

  return (
    <div>
      <PageHeader
        title="Integrationen"
        description="Microsoft 365 / Outlook, OneDrive & SharePoint sowie Excel-Import und -Export verwalten."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense>
          <MicrosoftConnectionCard configured={configured} initialConnection={initialConnection} />
        </Suspense>
        <OneDriveCard />
        <PermissionsCard />
      </div>
    </div>
  );
}
