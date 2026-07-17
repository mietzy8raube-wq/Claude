import type { Prisma } from "@prisma/client";

export type DecisionWithRelations = Prisma.DecisionGetPayload<{
  include: {
    responsible: { select: { id: true; name: true } };
    project: { select: { id: true; name: true } };
    options: true;
    _count: { select: { comments: true; linkedTasks: true } };
  };
}>;

export type DecisionDetail = Prisma.DecisionGetPayload<{
  include: {
    responsible: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
    options: true;
    comments: { include: { author: { select: { id: true; name: true } } } };
    linkedTasks: { include: { assignee: { select: { id: true; name: true } } } };
  };
}>;
