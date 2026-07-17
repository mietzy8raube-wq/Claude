"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Plus, Send } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PriorityBadge, StatusBadge } from "./badges";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
} from "@/components/shared/alert-dialog";

interface TaskDetailSheetProps {
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onChanged: () => void;
}

interface DetailData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  category: string | null;
  assignee: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  project: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  companyArea: { id: string; name: string } | null;
  checklistItems: { id: string; title: string; isDone: boolean }[];
  comments: { id: string; content: string; createdAt: string; author: { id: string; name: string } }[];
  activities: { id: string; action: string; createdAt: string; user: { id: string; name: string } }[];
}

export function TaskDetailSheet({ taskId, onOpenChange, onEdit, onChanged }: TaskDetailSheetProps) {
  const [task, setTask] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadTask = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setTask(body.task);
    } catch {
      toast.error("Aufgabe konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
    } else {
      setTask(null);
    }
  }, [taskId, loadTask]);

  async function toggleChecklistItem(itemId: string, isDone: boolean) {
    if (!task) return;
    setTask({
      ...task,
      checklistItems: task.checklistItems.map((c) => (c.id === itemId ? { ...c, isDone } : c)),
    });
    await fetch(`/api/tasks/${task.id}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone }),
    });
    onChanged();
  }

  async function addChecklistItem() {
    if (!task || !newChecklistItem.trim()) return;
    const res = await fetch(`/api/tasks/${task.id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newChecklistItem.trim() }),
    });
    if (res.ok) {
      const body = await res.json();
      setTask({ ...task, checklistItems: [...task.checklistItems, body.item] });
      setNewChecklistItem("");
      onChanged();
    }
  }

  async function submitComment() {
    if (!task || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error();
      const body = await res.json();
      setTask({ ...task, comments: [...task.comments, body.comment] });
      setNewComment("");
    } catch {
      toast.error("Kommentar konnte nicht gespeichert werden");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function deleteTask() {
    if (!task) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Aufgabe gelöscht");
      onOpenChange(false);
      onChanged();
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  return (
    <>
      <Sheet open={!!taskId} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {loading || !task ? (
            <div className="flex flex-1 items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-lg">{task.title}</SheetTitle>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Bearbeiten">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(true)}
                      aria-label="Löschen"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority as never} />
                  <StatusBadge status={task.status as never} />
                  {task.dueDate && <span>Fällig: {formatDate(task.dueDate)}</span>}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-6">
                {task.description && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Verantwortlich</p>
                    <p>{task.assignee?.name ?? "Nicht zugewiesen"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Erstellt von</p>
                    <p>{task.createdBy.name}</p>
                  </div>
                  {task.project && (
                    <div>
                      <p className="text-xs text-muted-foreground">Projekt</p>
                      <p>{task.project.name}</p>
                    </div>
                  )}
                  {task.department && (
                    <div>
                      <p className="text-xs text-muted-foreground">Abteilung</p>
                      <p>{task.department.name}</p>
                    </div>
                  )}
                  {task.companyArea && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bereich</p>
                      <p>{task.companyArea.name}</p>
                    </div>
                  )}
                  {task.category && (
                    <div>
                      <p className="text-xs text-muted-foreground">Kategorie</p>
                      <p>{task.category}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-medium">Checkliste</p>
                  <div className="space-y-1.5">
                    {task.checklistItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={item.isDone}
                          onCheckedChange={(v) => toggleChecklistItem(item.id, !!v)}
                        />
                        <span className={item.isDone ? "text-muted-foreground line-through" : ""}>
                          {item.title}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="Punkt hinzufügen"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addChecklistItem}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-medium">Kommentare</p>
                  <div className="space-y-3">
                    {task.comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[10px]">
                            {initials(comment.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{comment.author.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {task.comments.length === 0 && (
                      <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Textarea
                      placeholder="Kommentar hinzufügen…"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-9"
                    />
                    <Button
                      type="button"
                      size="icon"
                      disabled={submittingComment}
                      onClick={submitComment}
                    >
                      {submittingComment ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="mb-2 text-sm font-medium">Aktivitätsverlauf</p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {task.activities.map((a) => (
                      <p key={a.id}>
                        {formatDateTime(a.createdAt)} · {a.user.name} · {a.action}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Aufgabe löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        destructive
        onConfirm={deleteTask}
      />
    </>
  );
}
