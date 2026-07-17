import type { Prisma } from "@prisma/client";

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true; email: true } };
    createdBy: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
    department: { select: { id: true; name: true } };
    companyArea: { select: { id: true; name: true; type: true } };
    checklistItems: true;
    _count: { select: { comments: true; attachments: true } };
  };
}>;

export interface SelectUser {
  id: string;
  name: string;
  email: string;
}

export interface SelectOption {
  id: string;
  name: string;
}
