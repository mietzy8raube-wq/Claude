import { z } from "zod";

export const projectStatusEnum = z.enum([
  "GEPLANT",
  "LAUFEND",
  "PAUSIERT",
  "ABGESCHLOSSEN",
  "ABGEBROCHEN",
]);

export const createProjectSchema = z.object({
  name: z.string().min(1, "Projektname ist erforderlich").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  status: projectStatusEnum.default("GEPLANT"),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  startDate: z.coerce.date().optional().nullable(),
  targetDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().min(1, "Verantwortlicher ist erforderlich"),
  participantIds: z.array(z.string()).optional().default([]),
  budget: z.coerce.number().min(0).optional().nullable(),
  budgetSpent: z.coerce.number().min(0).optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;

export const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.coerce.date().optional().nullable(),
});

export const updateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  isDone: z.boolean().optional(),
});

export const riskImpactEnum = z.enum(["NIEDRIG", "MITTEL", "HOCH", "KRITISCH"]);
export const riskStatusEnum = z.enum([
  "OFFEN",
  "IN_BEOBACHTUNG",
  "GEMILDERT",
  "EINGETRETEN",
  "GESCHLOSSEN",
]);

export const createRiskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(3000).optional().or(z.literal("")),
  impact: riskImpactEnum.default("MITTEL"),
  status: riskStatusEnum.default("OFFEN"),
  mitigation: z.string().max(3000).optional().or(z.literal("")),
});

export const updateRiskSchema = createRiskSchema.partial();

export const createProjectCommentSchema = z.object({
  content: z.string().min(1).max(4000),
});
