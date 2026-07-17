"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Send, CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertDialog } from "@/components/shared/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DecisionStatusBadge, DECISION_STATUS_LABEL } from "./badges";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import type { DecisionDetail } from "@/types/decision";
import type { DecisionStatus } from "@prisma/client";

interface DecisionDetailViewProps {
  decision: DecisionDetail;
  linkableTasks: { id: string; title: string }[];
}

export function DecisionDetailView({ decision, linkableTasks }: DecisionDetailViewProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [finalDecision, setFinalDecision] = useState(decision.finalDecision ?? "");
  const [newComment, setNewComment] = useState("");
  const [linkTaskId, setLinkTaskId] = useState("");
  const [busy, setBusy] = useState(false);

  async function updateStatus(status: DecisionStatus) {
    await fetch(`/api/decisions/${decision.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function saveFinalDecision() {
    setBusy(true);
    try {
      await fetch(`/api/decisions/${decision.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalDecision,
          status: "ENTSCHIEDEN",
          decisionDate: new Date(),
        }),
      });
      toast.success("Finale Entscheidung gespeichert");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function chooseOption(optionId: string) {
    await fetch(`/api/decisions/${decision.id}/options/${optionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isChosen: true }),
    });
    router.refresh();
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/decisions/${decision.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      setNewComment("");
      router.refresh();
    } catch {
      toast.error("Kommentar konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  }

  async function linkTask() {
    if (!linkTaskId) return;
    setBusy(true);
    try {
      await fetch(`/api/tasks/${linkTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id }),
      });
      setLinkTaskId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteDecision() {
    const res = await fetch(`/api/decisions/${decision.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entscheidung gelöscht");
      router.push("/decisions");
      router.refresh();
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  return (
    <div>
      <Link href="/decisions" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück zu Entscheidungen
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
            <DecisionStatusBadge status={decision.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Verantwortlich: {decision.responsible.name}
            {decision.project && <> · Projekt: {decision.project.name}</>}
            {decision.decisionDeadline && <> · Frist: {formatDate(decision.decisionDeadline)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={decision.status} onValueChange={(v) => updateStatus(v as DecisionStatus)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DECISION_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="text-destructive" /> Löschen
          </Button>
        </div>
      </div>

      {decision.background && (
        <Card className="mb-4 p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Hintergrund</p>
          <p className="whitespace-pre-wrap text-sm">{decision.background}</p>
        </Card>
      )}
      {decision.description && (
        <Card className="mb-4 p-4">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Beschreibung</p>
          <p className="whitespace-pre-wrap text-sm">{decision.description}</p>
        </Card>
      )}

      <div className="mb-6">
        <p className="mb-2 text-sm font-medium">Handlungsoptionen</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {decision.options.map((option) => (
            <Card key={option.id} className={option.isChosen ? "border-success p-3" : "p-3"}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{option.title}</p>
                {option.isChosen ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 className="size-3.5" /> Gewählt
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => chooseOption(option.id)}>
                    Wählen
                  </Button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="font-medium text-success">Vorteile</p>
                  <p className="text-muted-foreground">{option.pros || "-"}</p>
                </div>
                <div>
                  <p className="font-medium text-destructive">Nachteile</p>
                  <p className="text-muted-foreground">{option.cons || "-"}</p>
                </div>
              </div>
            </Card>
          ))}
          {decision.options.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Handlungsoptionen erfasst.</p>
          )}
        </div>
      </div>

      <Card className="mb-6 p-4">
        <p className="mb-2 text-sm font-medium">Finale Entscheidung</p>
        <Textarea
          value={finalDecision}
          onChange={(e) => setFinalDecision(e.target.value)}
          placeholder="Wie wurde final entschieden und warum?"
        />
        <div className="mt-2 flex items-center justify-between">
          {decision.decisionDate && (
            <p className="text-xs text-muted-foreground">Entschieden am {formatDate(decision.decisionDate)}</p>
          )}
          <Button size="sm" disabled={busy} onClick={saveFinalDecision} className="ml-auto">
            Entscheidung festhalten
          </Button>
        </div>
      </Card>

      <Card className="mb-6 p-4">
        <p className="mb-2 text-sm font-medium">Verknüpfte Aufgaben</p>
        <div className="space-y-2">
          {decision.linkedTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>{task.title}</span>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
              </div>
            </div>
          ))}
          {decision.linkedTasks.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine verknüpften Aufgaben.</p>
          )}
        </div>
        {linkableTasks.length > 0 && (
          <div className="mt-3 flex gap-2">
            <Select value={linkTaskId} onValueChange={setLinkTaskId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Bestehende Aufgabe verknüpfen" /></SelectTrigger>
              <SelectContent>
                {linkableTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={linkTask} disabled={!linkTaskId || busy}>
              <Link2 className="size-4" /> Verknüpfen
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <p className="mb-2 text-sm font-medium">Kommentare</p>
        <div className="space-y-3">
          {decision.comments.map((c) => (
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
        </div>
        <Separator className="my-3" />
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
      </Card>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Entscheidung löschen?"
        description="Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        destructive
        onConfirm={deleteDecision}
      />
    </div>
  );
}
