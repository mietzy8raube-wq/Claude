import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DecisionStatusBadge } from "@/components/decisions/badges";
import { formatDate, formatDateTime, initials, cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FolderKanban,
  Scale,
  AlertTriangle,
  CalendarClock,
  RefreshCw,
  FileSpreadsheet,
  XCircle,
  Activity,
  LineChart,
} from "lucide-react";

function WidgetTitle({ icon: Icon, tone = "default", children }: { icon: LucideIcon; tone?: "default" | "destructive"; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-[0.925rem]">
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          tone === "destructive" ? "bg-destructive/12 text-destructive" : "bg-accent text-accent-foreground"
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.25} />
      </span>
      {children}
    </CardTitle>
  );
}

export function TasksByAssigneeWidget({
  data,
}: {
  data: { userId: string; name: string; open: number; overdue: number; total: number }[];
}) {
  return (
    <Card>
      <CardHeader><WidgetTitle icon={Activity}>Aufgaben pro Geschäftsführer</WidgetTitle></CardHeader>
      <CardContent className="space-y-4">
        {data.map((d) => (
          <div key={d.userId}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Avatar className="size-6"><AvatarFallback className="bg-brand-gradient text-[10px] text-white">{initials(d.name)}</AvatarFallback></Avatar>
                {d.name}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {d.open} offen{d.overdue > 0 && <span className="text-destructive"> · {d.overdue} überfällig</span>}
              </span>
            </div>
            <Progress value={d.total ? (d.open / d.total) * 100 : 0} className="h-1.5" />
          </div>
        ))}
        {data.length === 0 && <p className="text-sm text-muted-foreground">Keine Daten.</p>}
      </CardContent>
    </Card>
  );
}

export function RunningProjectsWidget({
  projects,
}: {
  projects: { id: string; name: string; progress: number; status: string; targetDate: Date | null }[];
}) {
  return (
    <Card>
      <CardHeader><WidgetTitle icon={FolderKanban}>Laufende Projekte</WidgetTitle></CardHeader>
      <CardContent className="space-y-4">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-muted/60">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="tabular-nums text-xs text-muted-foreground">{p.progress}%</span>
            </div>
            <Progress value={p.progress} className="h-1.5" />
            {p.targetDate && <p className="mt-1 text-xs text-muted-foreground">Ziel: {formatDate(p.targetDate)}</p>}
          </Link>
        ))}
        {projects.length === 0 && <p className="text-sm text-muted-foreground">Keine laufenden Projekte.</p>}
      </CardContent>
    </Card>
  );
}

export function ImportantDecisionsWidget({
  decisions,
}: {
  decisions: { id: string; title: string; status: string; decisionDeadline: Date | null }[];
}) {
  return (
    <Card>
      <CardHeader><WidgetTitle icon={Scale}>Wichtige Entscheidungen</WidgetTitle></CardHeader>
      <CardContent className="space-y-2">
        {decisions.map((d) => (
          <Link key={d.id} href={`/decisions/${d.id}`} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 hover:border-accent-foreground/15">
            <span className="truncate font-medium">{d.title}</span>
            <div className="flex shrink-0 items-center gap-2">
              {d.decisionDeadline && <span className="text-xs text-muted-foreground">{formatDate(d.decisionDeadline)}</span>}
              <DecisionStatusBadge status={d.status as never} />
            </div>
          </Link>
        ))}
        {decisions.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Entscheidungen.</p>}
      </CardContent>
    </Card>
  );
}

export function CriticalAlertsWidget({
  overdueCount,
  criticalTaskCount,
  failedSyncCount,
}: {
  overdueCount: number;
  criticalTaskCount: number;
  failedSyncCount: number;
}) {
  const alerts = [
    overdueCount > 0 && `${overdueCount} überfällige Aufgabe(n)`,
    criticalTaskCount > 0 && `${criticalTaskCount} offene Aufgabe(n) mit kritischer Priorität`,
    failedSyncCount > 0 && `${failedSyncCount} fehlgeschlagene Synchronisierung(en)`,
  ].filter(Boolean) as string[];

  return (
    <Card className={alerts.length > 0 ? "border-destructive/30" : undefined}>
      <CardHeader><WidgetTitle icon={AlertTriangle} tone="destructive">Kritische Meldungen</WidgetTitle></CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine kritischen Meldungen.</p>
        ) : (
          alerts.map((a, i) => (
            <p key={i} className="rounded-md bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive">{a}</p>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function CalendarWidget({
  today,
  upcoming,
}: {
  today: { id: string; title: string; startTime: Date; endTime: Date; location: string | null }[];
  upcoming: { id: string; title: string; startTime: Date; endTime: Date; location: string | null }[];
}) {
  const fmtTime = (d: Date) => new Date(d).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <Card>
      <CardHeader><WidgetTitle icon={CalendarClock}>Termine</WidgetTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Heute</p>
          {today.length === 0 && <p className="text-sm text-muted-foreground">Keine Termine heute.</p>}
          <div className="space-y-1">
            {today.map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span>{e.title}</span>
                <span className="tabular-nums text-muted-foreground">{fmtTime(e.startTime)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bevorstehend</p>
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Keine bevorstehenden Termine.</p>}
          <div className="space-y-1">
            {upcoming.map((e) => (
              <div key={e.id} className="flex justify-between text-sm">
                <span>{e.title}</span>
                <span className="text-muted-foreground">{formatDate(e.startTime)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SyncStatusWidget({
  connections,
  recentImports,
  failedSyncs,
}: {
  connections: { name: string; lastSyncAt: Date | null; lastSyncStatus: string }[];
  recentImports: { fileName: string; entity: string; createdAt: Date; successCount: number; errorCount: number }[];
  failedSyncs: { message: string | null; createdAt: Date }[];
}) {
  return (
    <Card>
      <CardHeader><WidgetTitle icon={RefreshCw}>Synchronisierung &amp; Import</WidgetTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Zuletzt synchronisiert</p>
          {connections.length === 0 && <p className="text-sm text-muted-foreground">Kein Microsoft-Konto verbunden.</p>}
          {connections.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{c.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : "nie"}
                <Badge className={c.lastSyncStatus === "ERFOLGREICH" ? "border-transparent bg-success/15 text-success" : "border-transparent bg-destructive/15 text-destructive"}>
                  {c.lastSyncStatus}
                </Badge>
              </span>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <FileSpreadsheet className="size-3.5" /> Zuletzt importierte Excel-Dateien
          </p>
          {recentImports.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Importe.</p>}
          {recentImports.map((imp, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="truncate">{imp.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(imp.createdAt)} · {imp.successCount} ok{imp.errorCount > 0 && `, ${imp.errorCount} Fehler`}
              </span>
            </div>
          ))}
        </div>

        {failedSyncs.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-destructive uppercase">
              <XCircle className="size-3.5" /> Fehlgeschlagene Synchronisierungen
            </p>
            {failedSyncs.map((s, i) => (
              <p key={i} className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}: {s.message}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompanyKpiWidget({
  metrics,
}: {
  metrics: { id: string; areaName: string; name: string; value: number; unit: string | null; period: string }[];
}) {
  return (
    <Card>
      <CardHeader><WidgetTitle icon={LineChart}>Unternehmenskennzahlen</WidgetTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.id} className="rounded-lg bg-muted/60 p-3 transition-colors hover:bg-muted">
            <p className="truncate text-xs text-muted-foreground">{m.areaName} · {m.name}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {m.value.toLocaleString("de-DE")} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span>
            </p>
          </div>
        ))}
        {metrics.length === 0 && <p className="text-sm text-muted-foreground">Keine Kennzahlen erfasst.</p>}
      </CardContent>
    </Card>
  );
}

export function ActivityFeedWidget({
  activities,
}: {
  activities: { id: string; description: string; userName: string | null; createdAt: Date }[];
}) {
  return (
    <Card>
      <CardHeader><WidgetTitle icon={Activity}>Aktivitäten der letzten Tage</WidgetTitle></CardHeader>
      <CardContent className="space-y-0.5">
        {activities.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-3 rounded-md px-1 py-1.5 text-sm transition-colors hover:bg-muted/50">
            <span className="text-muted-foreground">{a.description}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</span>
          </div>
        ))}
        {activities.length === 0 && <p className="text-sm text-muted-foreground">Keine Aktivitäten.</p>}
      </CardContent>
    </Card>
  );
}
