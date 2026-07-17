"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, CalendarDays, MapPin, Video, Trash2, Link2, CloudCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertDialog } from "@/components/shared/alert-dialog";
import { CalendarEventFormDialog } from "./calendar-event-form-dialog";
import { formatDate } from "@/lib/utils";
import type { CalendarEventWithRelations } from "@/types/calendar";

function timeRange(start: string | Date, end: string | Date) {
  const fmt = (d: Date) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(new Date(start))} – ${fmt(new Date(end))}`;
}

function groupByDay(events: CalendarEventWithRelations[]) {
  const groups = new Map<string, CalendarEventWithRelations[]>();
  for (const event of events) {
    const key = new Date(event.startTime).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  return Array.from(groups.entries());
}

export function CalendarAgendaView({
  events,
  hasMicrosoftConnection,
}: {
  events: CalendarEventWithRelations[];
  hasMicrosoftConnection: boolean;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function deleteEvent() {
    if (!deleteId) return;
    const res = await fetch(`/api/calendar-events/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Termin gelöscht");
      router.refresh();
    } else {
      toast.error("Löschen fehlgeschlagen");
    }
  }

  async function createTaskFromEvent(eventId: string) {
    setBusy(eventId);
    try {
      const res = await fetch(`/api/calendar-events/${eventId}/create-task`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Aufgabe aus Termin erstellt");
      router.refresh();
    } catch {
      toast.error("Aufgabe konnte nicht erstellt werden");
    } finally {
      setBusy(null);
    }
  }

  const grouped = groupByDay(events);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Termin erstellen
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Keine Termine"
          description="Verbinden Sie Outlook unter Integrationen oder erstellen Sie einen lokalen Termin."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Termin erstellen</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="mb-2 text-sm font-medium text-muted-foreground">{formatDate(dayEvents[0].startTime)}</p>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <Card key={event.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">{timeRange(event.startTime, event.endTime)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {event.location && (
                            <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {event.location}</span>
                          )}
                          {event.teamsLink && (
                            <a href={event.teamsLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                              <Video className="size-3.5" /> Teams-Link
                            </a>
                          )}
                          {event.source === "OUTLOOK" && (
                            <span className="flex items-center gap-1"><CloudCheck className="size-3.5" /> Outlook</span>
                          )}
                          {event.task && <span>· Aufgabe: {event.task.title}</span>}
                          {event.project && <span>· Projekt: {event.project.name}</span>}
                          {event.meeting && <span>· Meeting: {event.meeting.title}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!event.task && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Aufgabe aus Termin erstellen"
                            disabled={busy === event.id}
                            onClick={() => createTaskFromEvent(event.id)}
                          >
                            <Link2 className="size-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(event.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CalendarEventFormDialog open={formOpen} onOpenChange={setFormOpen} hasMicrosoftConnection={hasMicrosoftConnection} />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Termin löschen?"
        description="Falls der Termin mit Outlook synchronisiert ist, wird er dort ebenfalls entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={deleteEvent}
      />
    </div>
  );
}
