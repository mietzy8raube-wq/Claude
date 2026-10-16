"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, RefreshCw, Loader2, CheckCircle2, XCircle, CalendarOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDateTime } from "@/lib/utils";

export interface FactorialStatus {
  configured: boolean;
  isAdmin: boolean;
  canSync: boolean;
  linkedUsers: number;
  upcomingAbsences: number;
  logs: {
    id: string;
    status: string;
    message: string | null;
    createdAt: string;
    unmatched: { id: string; name: string; email: string | null }[] | null;
  }[];
}

export function FactorialCard({ status }: { status: FactorialStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);
  const last = status.logs[0];
  const unmatched = status.logs.find((l) => l.status === "ERFOLGREICH")?.unmatched ?? [];

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/factorial/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createMissingUsers: createMissing }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Abgleich fehlgeschlagen");
      toast.success(
        `Abgleich erfolgreich: ${body.employeesMatched} Mitarbeiter verknüpft, ${body.absencesSynced} Abwesenheiten übernommen`
      );
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" /> Factorial HR
          {status.configured ? (
            <Badge className="border-transparent bg-success/15 text-success">Konfiguriert</Badge>
          ) : (
            <Badge variant="outline">Nicht konfiguriert</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Mitarbeiter und Abwesenheiten (Urlaub, Krankheit …) aus Factorial übernehmen. Abwesenheiten erscheinen in
          „Team & Auslastung“ und bei Fristen; bei Tickets, die während einer Abwesenheit fällig werden, wird rechtzeitig
          eine Vertretung angefordert.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status.configured ? (
          <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
            In Factorial unter <span className="font-medium">Einstellungen → API-Schlüssel</span> einen Schlüssel erzeugen
            und als <code className="font-mono text-xs">FACTORIAL_API_KEY</code> in der .env hinterlegen. Danach den Server
            neu starten.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-2xl font-semibold tabular-nums">{status.linkedUsers}</p>
                <p className="text-xs text-muted-foreground">verknüpfte Benutzer</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 text-2xl font-semibold tabular-nums">
                  {status.upcomingAbsences} <CalendarOff className="size-4 text-muted-foreground" />
                </p>
                <p className="text-xs text-muted-foreground">aktuelle/kommende Abwesenheiten</p>
              </div>
            </div>

            {last && (
              <div className="flex items-start gap-2 text-sm">
                {last.status === "ERFOLGREICH" ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div>
                  <p>Letzter Abgleich: {formatDateTime(last.createdAt)}</p>
                  {last.message && <p className="text-xs break-words text-muted-foreground">{last.message}</p>}
                </div>
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                <p className="font-medium">{unmatched.length} Factorial-Mitarbeiter ohne Konto in der GF-Suite</p>
                <p className="mb-2 text-xs text-muted-foreground">
                  Zuordnung erfolgt über die E-Mail-Adresse. Konto mit gleicher E-Mail anlegen oder beim Abgleich automatisch
                  anlegen lassen.
                </p>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                  {unmatched.map((u) => (
                    <li key={u.id}>
                      {u.name} <span className="text-muted-foreground">{u.email ?? "(keine E-Mail)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status.canSync && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {status.isAdmin ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={createMissing} onCheckedChange={(v) => setCreateMissing(!!v)} />
                    Fehlende Mitarbeiter-Konten anlegen
                  </label>
                ) : (
                  <span />
                )}
                <Button onClick={sync} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Jetzt abgleichen
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Automatischer Abgleich: Cron-Aufruf von <code className="font-mono">POST /api/integrations/factorial/sync</code>{" "}
              mit <code className="font-mono">CRON_SECRET</code> (siehe README).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
