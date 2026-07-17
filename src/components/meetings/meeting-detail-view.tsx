"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus, CheckSquare, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog } from "@/components/shared/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { SelectUser } from "@/types/task";
import type { MeetingDetail } from "@/types/meeting";

export function MeetingDetailView({ meeting, users }: { meeting: MeetingDetail; users: SelectUser[] }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [newAgendaItem, setNewAgendaItem] = useState("");
  const [newResolution, setNewResolution] = useState({ title: "", description: "", responsibleId: "" });
  const [busy, setBusy] = useState(false);

  async function saveNotes() {
    setBusy(true);
    try {
      await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      toast.success("Notizen gespeichert");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addAgendaItem() {
    if (!newAgendaItem.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/meetings/${meeting.id}/agenda-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newAgendaItem.trim() }),
      });
      setNewAgendaItem("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addResolution() {
    if (!newResolution.title.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/meetings/${meeting.id}/resolutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newResolution.title.trim(),
          description: newResolution.description || undefined,
          responsibleId: newResolution.responsibleId || undefined,
        }),
      });
      setNewResolution({ title: "", description: "", responsibleId: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createTaskFromResolution(resolutionId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/resolutions/${resolutionId}/create-task`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Aufgabe konnte nicht erstellt werden");
      }
      toast.success("Aufgabe aus Beschluss erstellt");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Erstellen der Aufgabe");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMeeting() {
    const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Meeting gelöscht");
      router.push("/meetings");
      router.refresh();
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  return (
    <div>
      <Link href="/meetings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück zu Meetings
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateTime(meeting.meetingDate)}
            {meeting.location && <> · {meeting.location}</>}
          </p>
        </div>
        <Button variant="outline" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="text-destructive" /> Löschen
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Tagesordnung</p>
            <ol className="space-y-1.5 text-sm">
              {meeting.agendaItems.map((item, index) => (
                <li key={item.id} className="flex gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span> {item.title}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="TOP hinzufügen"
                value={newAgendaItem}
                onChange={(e) => setNewAgendaItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAgendaItem()}
              />
              <Button type="button" variant="outline" size="icon" disabled={busy} onClick={addAgendaItem}>
                <Plus className="size-4" />
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Gesprächsnotizen &amp; Protokoll</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-32" />
            <div className="mt-2 flex justify-end">
              <Button size="sm" disabled={busy} onClick={saveNotes}>
                Notizen speichern
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="size-4" /> Beschlüsse
            </p>
            <div className="space-y-3">
              {meeting.resolutions.map((resolution) => (
                <div key={resolution.id} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{resolution.title}</p>
                      {resolution.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{resolution.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {resolution.responsible?.name ?? "Nicht zugewiesen"}
                        {resolution.dueDate && <> · Fällig: {formatDate(resolution.dueDate)}</>}
                      </p>
                    </div>
                    {resolution.generatedTask ? (
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                        <CheckSquare className="size-3.5" /> Aufgabe erstellt
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => createTaskFromResolution(resolution.id)}
                      >
                        Aufgabe erstellen
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {meeting.resolutions.length === 0 && (
                <p className="text-sm text-muted-foreground">Noch keine Beschlüsse erfasst.</p>
              )}
            </div>

            <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-3">
              <Input
                placeholder="Neuer Beschluss"
                value={newResolution.title}
                onChange={(e) => setNewResolution((prev) => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder="Beschreibung (optional)"
                className="min-h-16"
                value={newResolution.description}
                onChange={(e) => setNewResolution((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="flex gap-2">
                <Select
                  value={newResolution.responsibleId || "__none__"}
                  onValueChange={(v) => setNewResolution((prev) => ({ ...prev, responsibleId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Verantwortlich" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nicht zugewiesen</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" disabled={busy} onClick={addResolution}>
                  <Plus className="size-4" /> Hinzufügen
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Teilnehmer</p>
            <div className="space-y-1.5 text-sm">
              {meeting.attendees.map((a) => (
                <p key={a.id}>{a.name}</p>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <p className="mb-1 text-sm font-medium">Erstellt von</p>
            <p className="text-sm text-muted-foreground">{meeting.createdBy.name}</p>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Meeting löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        destructive
        onConfirm={deleteMeeting}
      />
    </div>
  );
}
