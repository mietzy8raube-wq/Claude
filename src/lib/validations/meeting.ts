import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  meetingDate: z.coerce.date(),
  location: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(10000).optional().or(z.literal("")),
  attendeeUserIds: z.array(z.string()).optional().default([]),
  externalAttendees: z
    .array(z.object({ name: z.string().min(1), email: z.string().optional().or(z.literal("")) }))
    .optional()
    .default([]),
  agendaItems: z.array(z.string().min(1)).optional().default([]),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  meetingDate: z.coerce.date().optional(),
  location: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(10000).optional().or(z.literal("")),
});

export type CreateMeetingInput = z.input<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.input<typeof updateMeetingSchema>;

export const createAgendaItemSchema = z.object({ title: z.string().min(1).max(200) });

export const createResolutionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(3000).optional().or(z.literal("")),
  responsibleId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});
