"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Inbox, ArrowRight, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/tasks/badges";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { formatTicketNumber } from "@/lib/ticket";
import { cn, formatDate, initials } from "@/lib/utils";
import type { Priority } from "@prisma/client";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  open: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  dueThisWeek: number;
  critical: number;
  load: number;
  completed30: number;
  onTimeRate: number | null;
  next: { id: string; ticketNumber: number; title: string; dueDate: string | null; priority: Priority }[];
}

export interface QueueTicket {
  id: string;
  ticketNumber: number;
  title: string;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  createdBy: string;
  project: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  GESCHAEFTSFUEHRER: "Geschäftsführung",
  ADMINISTRATOR: "Administrator",
  MITARBEITER: "Mitarbeiter",
};

/** Orientierungswert: ab dieser Punktzahl gilt eine Person als voll ausgelastet. */
const CAPACITY = 20;

function loadLevel(load: number) {
  const ratio = load / CAPACITY;
  if (ratio >= 1) return { label: "Überlastet", bar: "bg-destructive", text: "text-destructive" };
  if (ratio >= 0.7) return { label: "Hoch", bar: "bg-warning", text: "text-warning-foreground" };
  if (ratio > 0) return { label: "Normal", bar: "bg-success", text: "text-success" };
  return { label: "Frei", bar: "bg-muted-foreground/30", text: "text-muted-foreground" };
}

export function TeamWorkloadView({ members, queue }: { members: TeamMember[]; queue: QueueTicket[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const byLoad = [...members].sort((a, b) => a.load - b.load);

  async function assign(taskId: string, userId: string) {
    setPendingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: userId }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Zugewiesen an ${members.find((m) => m.id === userId)?.name}`);
      router.refresh();
    } catch {
      toast.error("Zuweisung fehlgeschlagen");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="size-4" /> Nicht zugewiesene Tickets
            <Badge variant="outline" className="tabular-nums">{queue.length}</Badge>
          </CardTitle>
          <CardDescription>
            Jedes Ticket braucht einen Verantwortlichen. Die Auswahl ist nach aktueller Auslastung sortiert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">Alle offenen Tickets sind zugewiesen. 👍</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {queue.map((t) => {
                const overdue = t.dueDate && new Date(t.dueDate) < startOfToday();
                return (
                  <div
                    key={t.id}
                    className={cn("flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center", pendingId === t.id && "opacity-60")}
                  >
                    <button type="button" className="min-w-0 flex-1 text-left hover:opacity-80" onClick={() => setSelectedTaskId(t.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{formatTicketNumber(t.ticketNumber)}</span>
                        <span className="truncate text-sm font-medium">{t.title}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Erstellt von {t.createdBy} am {formatDate(t.createdAt)}
                        {t.project && ` · ${t.project}`}
                        {t.dueDate && (
                          <span className={cn(overdue && "font-medium text-destructive")}> · fällig {formatDate(t.dueDate)}</span>
                        )}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={t.priority} />
                      <Select onValueChange={(v) => assign(t.id, v)} disabled={pendingId === t.id}>
                        <SelectTrigger size="sm" className="w-52">
                          <SelectValue placeholder="Zuweisen an…" />
                        </SelectTrigger>
                        <SelectContent>
                          {byLoad.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name} · {loadLevel(m.load).label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {members.length === 0 ? (
        <EmptyState icon={Users} title="Noch keine Teammitglieder" description="Administratoren können unter Einstellungen Benutzer anlegen." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => {
            const level = loadLevel(m.load);
            const total = m.open + m.inProgress + m.blocked;
            return (
              <Card key={m.id} className="gap-4">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base">{m.name}</CardTitle>
                    <CardDescription>{ROLE_LABEL[m.role] ?? m.role}</CardDescription>
                  </div>
                  {m.overdue > 0 && (
                    <Badge className="border-transparent bg-destructive/15 text-destructive">
                      <AlertTriangle className="size-3" /> {m.overdue} überfällig
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Auslastung</span>
                      <span className={cn("font-medium", level.text)}>{level.label}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-all", level.bar)}
                        style={{ width: `${Math.min(100, (m.load / CAPACITY) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Stat label="Offen" value={total} />
                    <Stat label="In Arbeit" value={m.inProgress} />
                    <Stat label="Woche" value={m.dueThisWeek} />
                    <Stat label="Hoch/Krit." value={m.critical} />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {m.completed30} erledigt in 30 Tagen
                    {m.onTimeRate !== null && (
                      <>
                        {" · "}
                        <span
                          className={cn(
                            "font-medium",
                            m.onTimeRate >= 90 ? "text-success" : m.onTimeRate >= 70 ? "text-warning-foreground" : "text-destructive"
                          )}
                        >
                          {m.onTimeRate}% termingerecht
                        </span>
                      </>
                    )}
                    {m.blocked > 0 && ` · ${m.blocked} blockiert`}
                  </p>

                  {m.next.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Als Nächstes</p>
                      {m.next.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTaskId(t.id)}
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-mono text-[11px] text-muted-foreground">{formatTicketNumber(t.ticketNumber)}</span>
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          <span
                            className={cn(
                              "shrink-0 text-xs text-muted-foreground",
                              t.dueDate && new Date(t.dueDate) < startOfToday() && "font-medium text-destructive"
                            )}
                          >
                            {t.dueDate ? formatDate(t.dueDate) : "ohne Frist"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/tasks/all?assignee=${m.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Alle Tickets von {m.name.split(" ")[0]} <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TaskDetailSheet
        taskId={selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onChanged={() => router.refresh()}
        onEdit={() => selectedTaskId && router.push(`/tasks/all?ticket=${selectedTaskId}`)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-1 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
