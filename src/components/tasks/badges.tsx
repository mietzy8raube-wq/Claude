import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority, TaskStatus } from "@prisma/client";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  BLOCKIERT: "Blockiert",
  ZUR_PRUEFUNG: "Zur Prüfung",
  ERLEDIGT: "Erledigt",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  NIEDRIG: "Niedrig",
  MITTEL: "Mittel",
  HOCH: "Hoch",
  KRITISCH: "Kritisch",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  NIEDRIG: "border-transparent bg-muted text-muted-foreground",
  MITTEL: "border-transparent bg-chart-2/15 text-chart-2",
  HOCH: "border-transparent bg-warning/20 text-warning-foreground",
  KRITISCH: "border-transparent bg-destructive/15 text-destructive",
};

const STATUS_CLASS: Record<TaskStatus, string> = {
  OFFEN: "border-transparent bg-muted text-muted-foreground",
  IN_BEARBEITUNG: "border-transparent bg-chart-2/15 text-chart-2",
  BLOCKIERT: "border-transparent bg-destructive/15 text-destructive",
  ZUR_PRUEFUNG: "border-transparent bg-warning/20 text-warning-foreground",
  ERLEDIGT: "border-transparent bg-success/15 text-success",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={cn(PRIORITY_CLASS[priority])}>{PRIORITY_LABEL[priority]}</Badge>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={cn(STATUS_CLASS[status])}>{STATUS_LABEL[status]}</Badge>;
}
