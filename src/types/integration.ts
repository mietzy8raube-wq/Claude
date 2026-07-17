export interface ConnectionStatus {
  email: string;
  displayName: string;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
  syncIntervalMinutes: number;
  autoSyncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: "NIE_SYNCHRONISIERT" | "AUSSTEHEND" | "ERFOLGREICH" | "FEHLER";
  lastSyncError: string | null;
  scopes: string;
  syncLogs: {
    id: string;
    status: string;
    message: string | null;
    itemsSynced: number;
    itemsFailed: number;
    createdAt: string;
  }[];
}
