import { z } from "zod";

export const createEventFromTaskSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().max(200).optional().or(z.literal("")),
  syncToOutlook: z.boolean().optional().default(false),
});

export type CreateEventFromTaskInput = z.input<typeof createEventFromTaskSchema>;
