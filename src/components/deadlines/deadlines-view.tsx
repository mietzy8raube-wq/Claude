"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlarmClock,
  Check,
  CalendarClock,
  CalendarCheck2,
  Flag,
  Scale,
  Ticket,
  ChevronDown,
  PartyPopper,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { TaskDetailSheet } from "@/components/tasks/task-detail-sheet";
import { BUCKET_LABEL, BUCKET_ORDER, deadlineBucket, relativeDue, type DeadlineBucket } from "@/lib/deadlines";
import { formatTicketNumber } from "@/lib/ticket";
import { cn, formatDate } from "@/lib/utils";
import type { Priority, TaskStatus } from "@prisma/client";

interface Person {
  id: string;
  name: string;
}

export type DeadlineItem =
  | {
      kind: "task";
      id: string;
      ticketNumber: number;
      title: string;
      dueDate: string;
      priority: Priority;
      status: TaskStatus;
      assignee: Person | null;
      context: string | null;
    }
  | {
      kind: "milestone" | "decision";
      id: string;
      title: string;
      dueDate: string;
      assignee: Person | null;
      context: string | null;
      href: string;
    };

interface DeadlinesViewProps {
  items: DeadlineItem[];
  users: Person[];
  currentUserId: string;
  withoutDueDate: number;
}

const BUCKET_TONE: Record<DeadlineBucket, string> = {
  overdue: "text-destructive",
  today: "text-warning-foreground",
  tomorrow: "text-foreground",
  thisWeek: "text-foreground",
  nextWeek: "text-muted-foreground",
  later: "text-muted-foreground",
};

const UNASSIGNED = "__none__";

function shiftDate(iso: string, days: number) {
  // Verschieben relativ zu heute, falls bereits überfällig – sonst relativ zur bisherigen Frist
  const base = new Date(iso);
  const today = new Date();
  today.setHours(base.getHours(), base.getMinutes(), 0, 0);
  const from = base < today ? today : base;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function DeadlinesView({ items, users, currentUserId, withoutDueDate }: DeadlinesViewProps) {
  const router = useRouter();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (scope === "mine" ? items.filter((i) => i.assignee?.id === currentUserId) : items),
    [items, scope, currentUserId]
  );

  const grouped = useMemo(() => {
    const now = new Date();
    const map = new Map<DeadlineBucket, DeadlineItem[]>();
    for (const item of filtered) {
      const bucket = deadlineBucket(new Date(item.dueDate), now);
      map.set(bucket, [...(map.get(bucket) ?? []), item]);
    }
    return map;
  }, [filtered]);

  async function patchTask(id: string, data: Record<string, unknown>, success: string) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success(success);
      router.refresh();
    } catch {
      toast.error("Änderung konnte nicht gespeichert werden");
    } finally {
      setPendingId(null);
    }
  }

  const overdueCount = grouped.get("overdue")?.length ?? 0;
  const todayCount = grouped.get("today")?.length ?? 0;
  const weekCount =
    (grouped.get("tomorrow")?.length ?? 0) + (grouped.get("thisWeek")?.length ?? 0) + todayCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
          <TabsList>
            <TabsTrigger value="mine">Meine Fristen</TabsTrigger>
            <TabsTrigger value="all">Alle Fristen</TabsTrigger>
          </TabsList>
        </Tabs>
        {withoutDueDate > 0 && (
          <p className="text-sm text-muted-foreground">
            {withoutDueDate} offene{withoutDueDate === 1 ? "s Ticket" : " Tickets"} ohne Frist –{" "}
            <Link href="/tasks/all" className="font-medium text-foreground underline-offset-4 hover:underline">
              jetzt terminieren
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile label="Überfällig" value={overdueCount} icon={AlarmClock} tone={overdueCount ? "destructive" : "default"} />
        <SummaryTile label="Heute fällig" value={todayCount} icon={CalendarClock} tone={todayCount ? "warning" : "default"} />
        <SummaryTile label="Bis Ende der Woche" value={weekCount} icon={CalendarCheck2} tone="default" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="Keine offenen Fristen"
          description={scope === "mine" ? "Ihnen sind aktuell keine Tickets mit Frist zugewiesen." : "Es gibt keine offenen Fristen."}
        />
      ) : (
        BUCKET_ORDER.filter((b) => grouped.has(b)).map((bucket) => (
          <section key={bucket}>
            <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", BUCKET_TONE[bucket])}>
              {BUCKET_LABEL[bucket]}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {grouped.get(bucket)!.length}
              </span>
            </h2>
            <Card className={cn("gap-0 divide-y divide-border overflow-hidden p-0", bucket === "overdue" && "border-destructive/40")}>
              {grouped.get(bucket)!.map((item) => (
                <DeadlineRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  bucket={bucket}
                  users={users}
                  pending={pendingId === item.id}
                  onOpen={() => item.kind === "task" && setSelectedTaskId(item.id)}
                  onDone={() => patchTask(item.id, { status: "ERLEDIGT" }, "Ticket erledigt")}
                  onPostpone={(days) =>
                    patchTask(item.id, { dueDate: shiftDate(item.dueDate, days) }, "Frist verschoben")
                  }
                  onAssign={(userId) =>
                    patchTask(item.id, { assigneeId: userId === UNASSIGNED ? null : userId }, "Ticket neu zugewiesen")
                  }
                />
              ))}
            </Card>
          </section>
        ))
      )}

      <TaskDetailSheet
        taskId={selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onChanged={() => router.refresh()}
        onEdit={() => {
          if (selectedTaskId) router.push(`/tasks/all?ticket=${selectedTaskId}`);
        }}
      />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof AlarmClock;
  tone: "default" | "warning" | "destructive";
}) {
  return (
    <Card className="flex flex-row items-center gap-3.5 p-4">
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          tone === "destructive" && "bg-destructive/12 text-destructive",
          tone === "warning" && "bg-warning/20 text-warning-foreground",
          tone === "default" && "bg-accent text-accent-foreground"
        )}
      >
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

const KIND_META = {
  task: { icon: Ticket, label: "Ticket" },
  milestone: { icon: Flag, label: "Meilenstein" },
  decision: { icon: Scale, label: "Entscheidung" },
} as const;

function DeadlineRow({
  item,
  bucket,
  users,
  pending,
  onOpen,
  onDone,
  onPostpone,
  onAssign,
}: {
  item: DeadlineItem;
  bucket: DeadlineBucket;
  users: Person[];
  pending: boolean;
  onOpen: () => void;
  onDone: () => void;
  onPostpone: (days: number) => void;
  onAssign: (userId: string) => void;
}) {
  const Meta = KIND_META[item.kind];
  const due = new Date(item.dueDate);

  const titleBlock = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {item.kind === "task" ? (
          <span className="font-mono text-xs text-muted-foreground">{formatTicketNumber(item.ticketNumber)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{Meta.label}</span>
        )}
        <span className="truncate font-medium">{item.title}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className={cn(bucket === "overdue" && "font-medium text-destructive")}>
          {formatDate(due)} · {relativeDue(due)}
        </span>
        {item.context && <span className="truncate">{item.context}</span>}
        {item.kind !== "task" && item.assignee && <span>{item.assignee.name}</span>}
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center", pending && "opacity-60")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Meta.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        {item.kind === "task" ? (
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left hover:opacity-80">
            {titleBlock}
          </button>
        ) : (
          <Link href={item.href} className="min-w-0 flex-1 hover:opacity-80">
            {titleBlock}
          </Link>
        )}
      </div>

      {item.kind === "task" && (
        <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
          <Select value={item.assignee?.id ?? UNASSIGNED} onValueChange={onAssign} disabled={pending}>
            <SelectTrigger size="sm" className="w-40" aria-label="Verantwortlich">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Nicht zugewiesen</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={pending}>
                Verschieben <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onPostpone(1)}>+1 Tag</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPostpone(3)}>+3 Tage</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPostpone(7)}>+1 Woche</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPostpone(14)}>+2 Wochen</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={onDone} disabled={pending}>
            <Check /> Erledigt
          </Button>
        </div>
      )}
    </div>
  );
}
