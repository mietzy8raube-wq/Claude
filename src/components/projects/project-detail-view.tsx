"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AlertDialog } from "@/components/shared/alert-dialog";
import { ProjectFormDialog } from "./project-form-dialog";
import { ProjectStatusBadge, RISK_IMPACT_LABEL, RISK_STATUS_LABEL } from "./badges";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { formatCurrency, formatDate, formatDateTime, initials } from "@/lib/utils";
import type { SelectUser } from "@/types/task";
import type { ProjectDetail } from "@/types/project-detail";

export function ProjectDetailView({ project, users }: { project: ProjectDetail; users: SelectUser[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newMilestone, setNewMilestone] = useState("");
  const [newRiskTitle, setNewRiskTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function addMilestone() {
    if (!newMilestone.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newMilestone.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewMilestone("");
      router.refresh();
    } catch {
      toast.error("Meilenstein konnte nicht hinzugefügt werden");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMilestone(id: string, isDone: boolean) {
    await fetch(`/api/projects/${project.id}/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone }),
    });
    router.refresh();
  }

  async function addRisk() {
    if (!newRiskTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/risks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newRiskTitle.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewRiskTitle("");
      router.refresh();
    } catch {
      toast.error("Risiko konnte nicht hinzugefügt werden");
    } finally {
      setBusy(false);
    }
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewComment("");
      router.refresh();
    } catch {
      toast.error("Kommentar konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject() {
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Projekt gelöscht");
      router.push("/projects");
      router.refresh();
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  return (
    <div>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück zu Projekten
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil /> Bearbeiten
          </Button>
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="text-destructive" /> Löschen
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Verantwortlicher</p>
          <p className="mt-1 font-medium">{project.owner.name}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Zeitraum</p>
          <p className="mt-1 font-medium">{formatDate(project.startDate)} – {formatDate(project.targetDate)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Budget</p>
          <p className="mt-1 font-medium">
            {project.budget
              ? `${formatCurrency(project.budgetSpent ?? 0)} / ${formatCurrency(project.budget)}`
              : "-"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Fortschritt</p>
          <Progress value={project.progress} />
          <p className="mt-1 text-xs text-muted-foreground">{project.progress}%</p>
        </Card>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Aufgaben ({project.tasks.length})</TabsTrigger>
          <TabsTrigger value="milestones">Meilensteine ({project.milestones.length})</TabsTrigger>
          <TabsTrigger value="risks">Risiken ({project.risks.length})</TabsTrigger>
          <TabsTrigger value="comments">Kommentare ({project.comments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {project.tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Aufgaben für dieses Projekt.</p>
          ) : (
            <div className="space-y-2">
              {project.tasks.map((task) => (
                <Card key={task.id} className="flex flex-row items-center justify-between gap-2 p-3">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.assignee?.name ?? "Nicht zugewiesen"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="milestones" className="mt-4 space-y-3">
          {project.milestones.map((m) => (
            <label key={m.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox checked={m.isDone} onCheckedChange={(v) => toggleMilestone(m.id, !!v)} />
              <span className={m.isDone ? "flex-1 text-muted-foreground line-through" : "flex-1"}>{m.title}</span>
              {m.dueDate && <span className="text-xs text-muted-foreground">{formatDate(m.dueDate)}</span>}
            </label>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Neuer Meilenstein"
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMilestone()}
            />
            <Button type="button" variant="outline" size="icon" disabled={busy} onClick={addMilestone}>
              <Plus className="size-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="risks" className="mt-4 space-y-3">
          {project.risks.map((risk) => (
            <Card key={risk.id} className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{risk.title}</p>
                <div className="flex gap-1">
                  <span className="text-xs text-muted-foreground">{RISK_IMPACT_LABEL[risk.impact]}</span>
                  <span className="text-xs text-muted-foreground">· {RISK_STATUS_LABEL[risk.status]}</span>
                </div>
              </div>
              {risk.description && <p className="mt-1 text-sm text-muted-foreground">{risk.description}</p>}
              {risk.mitigation && <p className="mt-1 text-xs text-muted-foreground">Gegenmaßnahme: {risk.mitigation}</p>}
            </Card>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Neues Risiko"
              value={newRiskTitle}
              onChange={(e) => setNewRiskTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRisk()}
            />
            <Button type="button" variant="outline" size="icon" disabled={busy} onClick={addRisk}>
              <Plus className="size-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-3">
          {project.comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.author.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{c.content}</p>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex gap-2">
            <Textarea
              placeholder="Kommentar hinzufügen…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-9"
            />
            <Button type="button" size="icon" disabled={busy} onClick={submitComment}>
              <Send className="size-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} users={users} project={project as never} />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Projekt löschen?"
        description="Alle verknüpften Meilensteine und Risiken werden ebenfalls gelöscht."
        confirmLabel="Löschen"
        destructive
        onConfirm={deleteProject}
      />
    </div>
  );
}
