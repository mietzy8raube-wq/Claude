import type { Prisma } from "@prisma/client";

type RawProjectWithRelations = Prisma.ProjectGetPayload<{
  include: {
    owner: { select: { id: true; name: true } };
    participants: { include: { user: { select: { id: true; name: true } } } };
    milestones: true;
    risks: true;
    _count: { select: { tasks: true; files: true; comments: true } };
  };
}>;

export type ProjectWithRelations = Omit<RawProjectWithRelations, "budget" | "budgetSpent"> & {
  budget: number | null;
  budgetSpent: number | null;
};
