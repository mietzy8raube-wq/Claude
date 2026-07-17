import { z } from "zod";

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich").max(200),
  description: z.string().max(3000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  timeZone: z.string().default("Europe/Berlin"),
  attendees: z
    .array(z.object({ name: z.string(), email: z.string() }))
    .optional()
    .default([]),
  projectId: z.string().optional().nullable(),
  meetingId: z.string().optional().nullable(),
  decisionId: z.string().optional().nullable(),
  syncToOutlook: z.boolean().optional().default(false),
});

export const updateCalendarEventSchema = createCalendarEventSchema.partial().omit({ syncToOutlook: true });

export type CreateCalendarEventInput = z.input<typeof createCalendarEventSchema>;
export type UpdateCalendarEventInput = z.input<typeof updateCalendarEventSchema>;
