import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DecisionStatus } from "@prisma/client";

export const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  VORBEREITUNG: "Vorbereitung",
  DISKUSSION: "Diskussion",
  ENTSCHEIDUNG_ERFORDERLICH: "Entscheidung erforderlich",
  ENTSCHIEDEN: "Entschieden",
  ZURUECKGESTELLT: "Zurückgestellt",
};

const DECISION_STATUS_CLASS: Record<DecisionStatus, string> = {
  VORBEREITUNG: "border-transparent bg-muted text-muted-foreground",
  DISKUSSION: "border-transparent bg-chart-2/15 text-chart-2",
  ENTSCHEIDUNG_ERFORDERLICH: "border-transparent bg-warning/20 text-warning-foreground",
  ENTSCHIEDEN: "border-transparent bg-success/15 text-success",
  ZURUECKGESTELLT: "border-transparent bg-muted text-muted-foreground",
};

export function DecisionStatusBadge({ status }: { status: DecisionStatus }) {
  return <Badge className={cn(DECISION_STATUS_CLASS[status])}>{DECISION_STATUS_LABEL[status]}</Badge>;
}
