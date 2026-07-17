import { z } from "zod";

export const decisionStatusEnum = z.enum([
  "VORBEREITUNG",
  "DISKUSSION",
  "ENTSCHEIDUNG_ERFORDERLICH",
  "ENTSCHIEDEN",
  "ZURUECKGESTELLT",
]);

export const createDecisionSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  background: z.string().max(5000).optional().or(z.literal("")),
  responsibleId: z.string().min(1, "Verantwortliche Person ist erforderlich"),
  decisionDeadline: z.coerce.date().optional().nullable(),
  status: decisionStatusEnum.default("VORBEREITUNG"),
  finalDecision: z.string().max(5000).optional().or(z.literal("")),
  decisionDate: z.coerce.date().optional().nullable(),
  projectId: z.string().optional().nullable(),
  options: z
    .array(
      z.object({
        title: z.string().min(1),
        pros: z.string().optional().or(z.literal("")),
        cons: z.string().optional().or(z.literal("")),
      })
    )
    .optional()
    .default([]),
});

export const updateDecisionSchema = createDecisionSchema.partial().omit({ options: true });

export type CreateDecisionInput = z.input<typeof createDecisionSchema>;
export type UpdateDecisionInput = z.input<typeof updateDecisionSchema>;

export const createOptionSchema = z.object({
  title: z.string().min(1).max(200),
  pros: z.string().max(2000).optional().or(z.literal("")),
  cons: z.string().max(2000).optional().or(z.literal("")),
});

export const updateOptionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pros: z.string().max(2000).optional().or(z.literal("")),
  cons: z.string().max(2000).optional().or(z.literal("")),
  isChosen: z.boolean().optional(),
});

export const createDecisionCommentSchema = z.object({
  content: z.string().min(1).max(4000),
});
