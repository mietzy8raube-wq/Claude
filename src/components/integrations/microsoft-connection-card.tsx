"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, RefreshCw, Unplug, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog } from "@/components/shared/alert-dialog";
import { formatDateTime } from "@/lib/utils";
import type { ConnectionStatus } from "@/types/integration";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Outlook-Integration ist noch nicht konfiguriert. Bitte MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET und MICROSOFT_REDIRECT_URI in der .env-Datei hinterlegen.",
  denied: "Die Anmeldung bei Microsoft wurde abgebrochen.",
  invalid_state: "Die Anmeldeanfrage konnte nicht verifiziert werden. Bitte erneut versuchen.",
  exchange_failed: "Der Token-Austausch mit Microsoft ist fehlgeschlagen.",
};

export function MicrosoftConnectionCard({
  configured,
  initialConnection,
}: {
  configured: boolean;
  initialConnection: ConnectionStatus | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState(initialConnection);
  const [calendars, setCalendars] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    const error = searchParams.get("error");
    const connected = searchParams.get("connected");
    if (error) {
      toast.error(ERROR_MESSAGES[error] ?? "Verbindung fehlgeschlagen.");
      router.replace("/integrations");
    } else if (connected) {
      toast.success("Microsoft-365-Konto erfolgreich verbunden.");
      router.replace("/integrations");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCalendars = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/microsoft/calendars");
      if (res.ok) {
        const body = await res.json();
        setCalendars(body.calendars ?? []);
      }
    } catch {
      // still show connection state even if calendar list can't load
    }
  }, []);

  useEffect(() => {
    if (connection) {
      loadCalendars();
    }
  }, [connection, loadCalendars]);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/microsoft/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.success(`${body.itemsSynced} Termine synchronisiert`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synchronisierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await fetch("/api/integrations/microsoft/disconnect", { method: "POST" });
    setConnection(null);
    toast.success("Verbindung getrennt");
    router.refresh();
  }

  async function updateCalendar(calendarId: string) {
    const cal = calendars.find((c) => c.id === calendarId);
    await fetch("/api/integrations/microsoft/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedCalendarId: calendarId, selectedCalendarName: cal?.name }),
    });
    router.refresh();
  }

  async function updateInterval(minutes: string) {
    await fetch("/api/integrations/microsoft/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncIntervalMinutes: Number(minutes) }),
    });
    router.refresh();
  }

  async function toggleAutoSync(enabled: boolean) {
    await fetch("/api/integrations/microsoft/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSyncEnabled: enabled }),
    });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" /> Microsoft Outlook / Microsoft 365
        </CardTitle>
        <CardDescription>
          Persönliches Microsoft-365-Konto verbinden, um Outlook-Kalender zu synchronisieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configured && (
          <p className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
            {ERROR_MESSAGES.not_configured}
          </p>
        )}

        {connection ? (
          <>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">{connection.displayName}</p>
                <p className="text-xs text-muted-foreground">{connection.email}</p>
              </div>
              <Badge className="border-transparent bg-success/15 text-success">Verbunden</Badge>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Kalender</p>
                <Select value={connection.selectedCalendarId ?? ""} onValueChange={updateCalendar}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Standardkalender" /></SelectTrigger>
                  <SelectContent>
                    {calendars.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Synchronisierungsintervall</p>
                <Select value={String(connection.syncIntervalMinutes)} onValueChange={updateInterval}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Minuten</SelectItem>
                    <SelectItem value="15">15 Minuten</SelectItem>
                    <SelectItem value="30">30 Minuten</SelectItem>
                    <SelectItem value="60">60 Minuten</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">Automatische Synchronisierung</span>
              <Switch checked={connection.autoSyncEnabled} onCheckedChange={toggleAutoSync} />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              Letzte Synchronisierung: {connection.lastSyncAt ? formatDateTime(connection.lastSyncAt) : "nie"}
              {connection.lastSyncStatus === "ERFOLGREICH" && <CheckCircle2 className="size-3.5 text-success" />}
              {connection.lastSyncStatus === "FEHLER" && <XCircle className="size-3.5 text-destructive" />}
            </div>
            {connection.lastSyncError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {connection.lastSyncError}
              </p>
            )}

            {connection.syncLogs.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Synchronisierungsprotokoll</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {connection.syncLogs.map((log) => (
                    <p key={log.id}>
                      {formatDateTime(log.createdAt)} · {log.status} · {log.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={sync} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Jetzt synchronisieren
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDisconnectOpen(true)}>
                <Unplug /> Verbindung trennen
              </Button>
            </div>
          </>
        ) : (
          <Button asChild disabled={!configured}>
            <a href="/api/integrations/microsoft/connect">
              <Mail /> Microsoft-Konto verbinden
            </a>
          </Button>
        )}
      </CardContent>

      <AlertDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Verbindung trennen?"
        description="Der Zugriff auf Ihr Microsoft-365-Konto wird entfernt. Bereits synchronisierte Termine bleiben lokal erhalten."
        confirmLabel="Trennen"
        destructive
        onConfirm={disconnect}
      />
    </Card>
  );
}
