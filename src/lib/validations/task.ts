import { z } from "zod";

export const taskStatusEnum = z.enum([
  "OFFEN",
  "IN_BEARBEITUNG",
  "BLOCKIERT",
  "ZUR_PRUEFUNG",
  "ERLEDIGT",
]);

export const priorityEnum = z.enum(["NIEDRIG", "MITTEL", "HOCH", "KRITISCH"]);

export const taskVisibilityEnum = z.enum(["PERSOENLICH", "GEMEINSAM"]);

export const recurrenceFrequencyEnum = z.enum([
  "TAEGLICH",
  "WOECHENTLICH",
  "MONATLICH",
  "JAEHRLICH",
]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  assigneeId: z.string().optional().nullable(),
  participantIds: z.array(z.string()).optional().default([]),
  priority: priorityEnum.default("MITTEL"),
  status: taskStatusEnum.default("OFFEN"),
  visibility: taskVisibilityEnum.default("GEMEINSAM"),
  dueDate: z.coerce.date().optional().nullable(),
  projectId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  companyAreaId: z.string().optional().nullable(),
  decisionId: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  isRecurring: z.boolean().optional().default(false),
  recurrenceFrequency: recurrenceFrequencyEnum.optional().nullable(),
  recurrenceInterval: z.coerce.number().int().min(1).optional().nullable(),
  recurrenceEndDate: z.coerce.date().optional().nullable(),
  reminderAt: z.coerce.date().optional().nullable(),
  checklistItems: z.array(z.string().min(1)).optional().default([]),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type CreateTaskOutput = z.output<typeof createTaskSchema>;
export type UpdateTaskInput = z.input<typeof updateTaskSchema>;

export const createChecklistItemSchema = z.object({
  title: z.string().min(1).max(300),
});

export const updateChecklistItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  isDone: z.boolean().optional(),
  position: z.number().int().optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Kommentar darf nicht leer sein").max(4000),
});
