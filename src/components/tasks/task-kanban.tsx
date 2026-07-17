"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "./badges";
import { formatDate, initials, cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";
import type { TaskWithRelations } from "@/types/task";
import type { TaskStatus } from "@prisma/client";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "OFFEN", label: "Offen" },
  { status: "IN_BEARBEITUNG", label: "In Bearbeitung" },
  { status: "BLOCKIERT", label: "Blockiert" },
  { status: "ZUR_PRUEFUNG", label: "Zur Prüfung" },
  { status: "ERLEDIGT", label: "Erledigt" },
];

interface TaskKanbanProps {
  tasks: TaskWithRelations[];
  onSelect: (task: TaskWithRelations) => void;
  onChanged: () => void;
}

export function TaskKanban({ tasks, onSelect, onChanged }: TaskKanbanProps) {
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function moveTask(taskId: string, status: TaskStatus) {
    setPendingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status konnte nicht aktualisiert werden");
      onChanged();
    } catch {
      toast.error("Status konnte nicht aktualisiert werden");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(col.status);
            }}
            onDragLeave={() => setDragOverStatus(null)}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData("text/task-id");
              setDragOverStatus(null);
              if (taskId) moveTask(taskId, col.status);
            }}
            className={cn(
              "flex min-h-[200px] flex-col gap-2 rounded-xl border border-border bg-muted/30 p-2 transition-colors",
              dragOverStatus === col.status && "border-primary bg-accent/40"
            )}
          >
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-sm font-medium">{col.label}</span>
              <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
                  onClick={() => onSelect(task)}
                  className={cn(
                    "cursor-pointer gap-2 p-3 shadow-sm transition-opacity hover:shadow-md",
                    pendingId === task.id && "opacity-50"
                  )}
                >
                  <p className="text-sm font-medium leading-snug">{task.title}</p>
                  <div className="flex items-center justify-between">
                    <PriorityBadge priority={task.priority} />
                    {task.assignee && (
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {initials(task.assignee.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={cn(task.dueDate && task.status !== "ERLEDIGT" && new Date(task.dueDate) < new Date() && "font-medium text-destructive")}>
                      {formatDate(task.dueDate)}
                    </span>
                    {task.checklistItems.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ClipboardList className="size-3" />
                        {task.checklistItems.filter((c) => c.isDone).length}/{task.checklistItems.length}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
