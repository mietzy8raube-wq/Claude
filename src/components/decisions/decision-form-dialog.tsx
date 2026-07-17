"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { createDecisionSchema, type CreateDecisionInput } from "@/lib/validations/decision";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DECISION_STATUS_LABEL } from "./badges";
import type { SelectOption, SelectUser } from "@/types/task";

interface DecisionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: SelectUser[];
  projects: SelectOption[];
}

interface DraftOption {
  title: string;
  pros: string;
  cons: string;
}

export function DecisionFormDialog({ open, onOpenChange, users, projects }: DecisionFormDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [options, setOptions] = useState<DraftOption[]>([]);

  const form = useForm<CreateDecisionInput>({
    resolver: zodResolver(createDecisionSchema),
    defaultValues: {
      title: "",
      description: "",
      background: "",
      responsibleId: users[0]?.id ?? "",
      status: "VORBEREITUNG",
      projectId: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        description: "",
        background: "",
        responsibleId: users[0]?.id ?? "",
        status: "VORBEREITUNG",
        projectId: null,
      });
      setOptions([]);
    }
  }, [open, users, form]);

  function addOption() {
    setOptions((prev) => [...prev, { title: "", pros: "", cons: "" }]);
  }

  function updateOption(index: number, patch: Partial<DraftOption>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  async function onSubmit(values: CreateDecisionInput) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, options: options.filter((o) => o.title.trim()) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Speichern fehlgeschlagen");
      }
      toast.success("Entscheidung erstellt");
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Entscheidung</DialogTitle>
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
                    <Input placeholder="Worüber muss entschieden werden?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="background"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hintergrund</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Warum steht diese Entscheidung an?" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="responsibleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verantwortlich</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(DECISION_STATUS_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="decisionDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entscheidungsfrist</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {projects.length > 0 && (
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verknüpftes Projekt</FormLabel>
                    <Select
                      value={field.value ?? "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Kein Projekt" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Kein Projekt</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-2">
              <Label>Handlungsoptionen</Label>
              <div className="space-y-3">
                {options.map((option, index) => (
                  <div key={index} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Input
                        placeholder="Option"
                        value={option.title}
                        onChange={(e) => updateOption(index, { title: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Textarea
                        placeholder="Vorteile"
                        className="min-h-16"
                        value={option.pros}
                        onChange={(e) => updateOption(index, { pros: e.target.value })}
                      />
                      <Textarea
                        placeholder="Nachteile"
                        className="min-h-16"
                        value={option.cons}
                        onChange={(e) => updateOption(index, { cons: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                <Plus className="size-4" /> Option hinzufügen
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                Entscheidung erfassen
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
