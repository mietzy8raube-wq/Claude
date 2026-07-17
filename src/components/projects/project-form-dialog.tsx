"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createProjectSchema, type CreateProjectInput } from "@/lib/validations/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PROJECT_STATUS_LABEL } from "./badges";
import type { SelectUser } from "@/types/task";
import type { ProjectWithRelations } from "@/types/project";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: SelectUser[];
  project?: ProjectWithRelations | null;
}

function toDateInput(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function ProjectFormDialog({ open, onOpenChange, users, project }: ProjectFormDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!project;

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "GEPLANT",
      progress: 0,
      ownerId: users[0]?.id ?? "",
      participantIds: [],
      budget: null,
      budgetSpent: null,
    },
  });

  useEffect(() => {
    if (open) {
      if (project) {
        form.reset({
          name: project.name,
          description: project.description ?? "",
          status: project.status,
          progress: project.progress,
          startDate: project.startDate,
          targetDate: project.targetDate,
          ownerId: project.ownerId,
          budget: project.budget ? Number(project.budget) : null,
          budgetSpent: project.budgetSpent ? Number(project.budgetSpent) : null,
        });
      } else {
        form.reset({
          name: "",
          description: "",
          status: "GEPLANT",
          progress: 0,
          ownerId: users[0]?.id ?? "",
          participantIds: [],
          budget: null,
          budgetSpent: null,
        });
      }
    }
  }, [open, project, users, form]);

  async function onSubmit(values: CreateProjectInput) {
    setIsSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/projects/${project!.id}` : "/api/projects", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Speichern fehlgeschlagen");
      }
      toast.success(isEdit ? "Projekt aktualisiert" : "Projekt erstellt");
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
          <DialogTitle>{isEdit ? "Projekt bearbeiten" : "Neues Projekt"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Projektname</FormLabel>
                  <FormControl>
                    <Input placeholder="Projektname" {...field} />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verantwortlicher</FormLabel>
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
                        {Object.entries(PROJECT_STATUS_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Startdatum</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={toDateInput(field.value as string | Date | null)}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zieldatum</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={toDateInput(field.value as string | Date | null)}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fortschritt (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={100} {...field} value={(field.value as number) ?? 0} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget (EUR)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} value={(field.value as number | string) ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetSpent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verbraucht (EUR)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} value={(field.value as number | string) ?? ""} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isEdit ? "Speichern" : "Projekt erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
