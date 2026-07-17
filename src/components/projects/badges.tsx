import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus, RiskImpact, RiskStatus } from "@prisma/client";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  GEPLANT: "Geplant",
  LAUFEND: "Laufend",
  PAUSIERT: "Pausiert",
  ABGESCHLOSSEN: "Abgeschlossen",
  ABGEBROCHEN: "Abgebrochen",
};

const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  GEPLANT: "border-transparent bg-muted text-muted-foreground",
  LAUFEND: "border-transparent bg-chart-2/15 text-chart-2",
  PAUSIERT: "border-transparent bg-warning/20 text-warning-foreground",
  ABGESCHLOSSEN: "border-transparent bg-success/15 text-success",
  ABGEBROCHEN: "border-transparent bg-destructive/15 text-destructive",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge className={cn(PROJECT_STATUS_CLASS[status])}>{PROJECT_STATUS_LABEL[status]}</Badge>;
}

export const RISK_IMPACT_LABEL: Record<RiskImpact, string> = {
  NIEDRIG: "Niedrig",
  MITTEL: "Mittel",
  HOCH: "Hoch",
  KRITISCH: "Kritisch",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  OFFEN: "Offen",
  IN_BEOBACHTUNG: "In Beobachtung",
  GEMILDERT: "Gemildert",
  EINGETRETEN: "Eingetreten",
  GESCHLOSSEN: "Geschlossen",
};
