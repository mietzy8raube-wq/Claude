import type { Prisma } from "@prisma/client";

type RawProjectDetail = Prisma.ProjectGetPayload<{
  include: {
    owner: { select: { id: true; name: true; email: true } };
    participants: { include: { user: { select: { id: true; name: true; email: true } } } };
    milestones: true;
    risks: true;
    files: { include: { uploadedBy: { select: { id: true; name: true } } } };
    comments: { include: { author: { select: { id: true; name: true } } } };
    tasks: { include: { assignee: { select: { id: true; name: true } } } };
    decisions: { select: { id: true; title: true; status: true } };
  };
}>;

export type ProjectDetail = Omit<RawProjectDetail, "budget" | "budgetSpent"> & {
  budget: number | null;
  budgetSpent: number | null;
};
