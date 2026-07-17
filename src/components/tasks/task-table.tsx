"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge } from "./badges";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, initials, cn } from "@/lib/utils";
import { ClipboardList, MessageSquare, Paperclip } from "lucide-react";
import type { TaskWithRelations } from "@/types/task";

interface TaskTableProps {
  tasks: TaskWithRelations[];
  onSelect: (task: TaskWithRelations) => void;
}

function isOverdue(task: TaskWithRelations) {
  return task.dueDate && task.status !== "ERLEDIGT" && new Date(task.dueDate) < new Date();
}

export function TaskTable({ tasks, onSelect }: TaskTableProps) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Keine Aufgaben gefunden"
        description="Passen Sie die Filter an oder erstellen Sie eine neue Aufgabe."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Verantwortlich</TableHead>
            <TableHead>Priorität</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Fällig</TableHead>
            <TableHead>Projekt</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="cursor-pointer" onClick={() => onSelect(task)}>
              <TableCell className="max-w-xs">
                <div className="truncate font-medium">{task.title}</div>
                {task.category && <div className="text-xs text-muted-foreground">{task.category}</div>}
              </TableCell>
              <TableCell>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">{initials(task.assignee.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{task.assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Nicht zugewiesen</span>
                )}
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                <span className={cn(isOverdue(task) && "font-medium text-destructive")}>
                  {formatDate(task.dueDate)}
                </span>
              </TableCell>
              <TableCell className="max-w-[10rem] truncate text-sm text-muted-foreground">
                {task.project?.name ?? "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {task.checklistItems.length > 0 && (
                    <span className="flex items-center gap-1 text-xs">
                      <ClipboardList className="size-3.5" />
                      {task.checklistItems.filter((c) => c.isDone).length}/{task.checklistItems.length}
                    </span>
                  )}
                  {task._count.comments > 0 && (
                    <span className="flex items-center gap-1 text-xs">
                      <MessageSquare className="size-3.5" />
                      {task._count.comments}
                    </span>
                  )}
                  {task._count.attachments > 0 && (
                    <span className="flex items-center gap-1 text-xs">
                      <Paperclip className="size-3.5" />
                      {task._count.attachments}
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
