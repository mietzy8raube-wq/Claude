import type { Prisma } from "@prisma/client";

export type CalendarEventWithRelations = Prisma.CalendarEventGetPayload<{
  include: {
    task: { select: { id: true; title: true } };
    project: { select: { id: true; name: true } };
    meeting: { select: { id: true; title: true } };
    decision: { select: { id: true; title: true } };
  };
}>;
