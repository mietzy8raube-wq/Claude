"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "./badges";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { ClipboardList, FolderOpen, MessagesSquare } from "lucide-react";
import type { ProjectWithRelations } from "@/types/project";

export function ProjectCard({ project }: { project: ProjectWithRelations }) {
  const milestonesDone = project.milestones.filter((m) => m.isDone).length;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <p className="font-semibold leading-snug">{project.name}</p>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <ProjectStatusBadge status={project.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Fortschritt</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(project.startDate)} – {formatDate(project.targetDate)}</span>
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">{initials(project.owner.name)}</AvatarFallback>
            </Avatar>
          </div>

          {project.budget && (
            <p className="text-xs text-muted-foreground">
              Budget: {formatCurrency(project.budgetSpent ?? 0)} / {formatCurrency(project.budget)}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ClipboardList className="size-3.5" /> {project._count.tasks} Aufgaben
            </span>
            <span className="flex items-center gap-1">
              <FolderOpen className="size-3.5" /> {milestonesDone}/{project.milestones.length} Meilensteine
            </span>
            <span className="flex items-center gap-1">
              <MessagesSquare className="size-3.5" /> {project._count.comments}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
