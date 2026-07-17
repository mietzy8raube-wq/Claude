"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { DecisionStatusBadge } from "./badges";
import { DecisionFormDialog } from "./decision-form-dialog";
import { formatDate, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { SelectOption, SelectUser } from "@/types/task";
import type { DecisionWithRelations } from "@/types/decision";

interface DecisionsListViewProps {
  decisions: DecisionWithRelations[];
  users: SelectUser[];
  projects: SelectOption[];
}

export function DecisionsListView({ decisions, users, projects }: DecisionsListViewProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Entscheidung erfassen
        </Button>
      </div>

      {decisions.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Noch keine Entscheidungen erfasst"
          description="Erfassen Sie anstehende Entscheidungen mit Handlungsoptionen, Vor- und Nachteilen."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Entscheidung erfassen</Button>}
        />
      ) : (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <Link key={decision.id} href={`/decisions/${decision.id}`}>
              <Card className="p-4 transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{decision.title}</p>
                    {decision.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{decision.description}</p>
                    )}
                  </div>
                  <DecisionStatusBadge status={decision.status} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[9px]">{initials(decision.responsible.name)}</AvatarFallback>
                    </Avatar>
                    <span>{decision.responsible.name}</span>
                    {decision.project && <span>· {decision.project.name}</span>}
                  </div>
                  {decision.decisionDeadline && <span>Frist: {formatDate(decision.decisionDeadline)}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <DecisionFormDialog open={formOpen} onOpenChange={setFormOpen} users={users} projects={projects} />
    </div>
  );
}
