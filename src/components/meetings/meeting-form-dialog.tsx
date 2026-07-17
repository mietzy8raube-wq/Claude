"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { createMeetingSchema, type CreateMeetingInput } from "@/lib/validations/meeting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { SelectUser } from "@/types/task";

interface MeetingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: SelectUser[];
}

function toDateTimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MeetingFormDialog({ open, onOpenChange, users }: MeetingFormDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [agendaItems, setAgendaItems] = useState<string[]>([]);
  const [newAgendaItem, setNewAgendaItem] = useState("");

  const form = useForm<CreateMeetingInput>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      title: "",
      meetingDate: new Date(),
      location: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ title: "", meetingDate: new Date(), location: "", notes: "" });
      setAttendeeIds(users.map((u) => u.id));
      setAgendaItems([]);
    }
  }, [open, users, form]);

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function addAgendaItem() {
    if (!newAgendaItem.trim()) return;
    setAgendaItems((prev) => [...prev, newAgendaItem.trim()]);
    setNewAgendaItem("");
  }

  async function onSubmit(values: CreateMeetingInput) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, attendeeUserIds: attendeeIds, agendaItems }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Speichern fehlgeschlagen");
      }
      toast.success("Meeting erstellt");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ein Fehler ist aufgetreten");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Neues Meeting</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Geschäftsführungsmeeting KW 30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="meetingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum &amp; Uhrzeit</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        defaultValue={toDateTimeLocal(new Date())}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ort / Link</FormLabel>
                    <FormControl>
                      <Input placeholder="Konferenzraum, Teams-Link…" {...field} value={field.value ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div>
              <Label className="mb-2 block">Teilnehmer</Label>
              <div className="flex flex-wrap gap-3">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={attendeeIds.includes(u.id)}
                      onCheckedChange={() => toggleAttendee(u.id)}
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tagesordnung</Label>
              <div className="space-y-1.5">
                {agendaItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                    <span className="flex-1">{index + 1}. {item}</span>
                    <button
                      type="button"
                      onClick={() => setAgendaItems((prev) => prev.filter((_, i) => i !== index))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Tagesordnungspunkt hinzufügen"
                  value={newAgendaItem}
                  onChange={(e) => setNewAgendaItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAgendaItem();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addAgendaItem}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Erste Gesprächsnotizen…" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Meeting erstellen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
