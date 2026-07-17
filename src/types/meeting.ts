import type { Prisma } from "@prisma/client";

export type MeetingWithRelations = Prisma.MeetingGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true } };
    attendees: true;
    agendaItems: true;
    resolutions: true;
    _count: { select: { attachments: true } };
  };
}>;

export type MeetingDetail = Prisma.MeetingGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true } };
    attendees: { include: { user: { select: { id: true; name: true } } } };
    agendaItems: true;
    resolutions: {
      include: { responsible: { select: { id: true; name: true } }; generatedTask: { select: { id: true } } };
    };
    attachments: true;
  };
}>;
