"use client";

import { useEffect, useState, useCallback } from "react";
import { List, LayoutGrid, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskTable } from "./task-table";
import { TaskKanban } from "./task-kanban";
import { TaskFiltersBar, EMPTY_FILTERS, type TaskFilters } from "./task-filters-bar";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import { ExcelExportButton } from "@/components/excel/excel-export-button";
import { ExcelImportDialog } from "@/components/excel/excel-import-dialog";
import type { SelectOption, SelectUser, TaskWithRelations } from "@/types/task";

interface TasksViewProps {
  scope: "mine" | "all";
  users: SelectUser[];
  projects: SelectOption[];
  departments: SelectOption[];
  companyAreas: SelectOption[];
}

export function TasksView({ scope, users, projects, departments, companyAreas }: TasksViewProps) {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const body = await res.json();
      setTasks(body.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }, [scope, filters]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, reloadToken]);

  function refresh() {
    setReloadToken((t) => t + 1);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
          <TabsList>
            <TabsTrigger value="list"><List className="size-4" /> Liste</TabsTrigger>
            <TabsTrigger value="kanban"><LayoutGrid className="size-4" /> Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelImportDialog entity="tasks" />
          <ExcelExportButton entity="tasks" filters={{ ...filters, scope }} />
          <Button
            onClick={() => {
              setEditingTask(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Aufgabe erstellen
          </Button>
        </div>
      </div>

      <TaskFiltersBar
        filters={filters}
        onChange={setFilters}
        users={users}
        projects={projects}
        departments={departments}
        showVisibility={scope === "all"}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === "list" ? (
        <TaskTable tasks={tasks} onSelect={(task) => setSelectedTaskId(task.id)} />
      ) : (
        <TaskKanban tasks={tasks} onSelect={(task) => setSelectedTaskId(task.id)} onChanged={refresh} />
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) refresh();
        }}
        users={users}
        projects={projects}
        departments={departments}
        companyAreas={companyAreas}
        task={editingTask}
      />

      <TaskDetailSheet
        taskId={selectedTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
          }
        }}
        onChanged={refresh}
        onEdit={() => {
          const task = tasks.find((t) => t.id === selectedTaskId);
          if (task) {
            setEditingTask(task);
            setSelectedTaskId(null);
            setFormOpen(true);
          }
        }}
      />
    </div>
  );
}
