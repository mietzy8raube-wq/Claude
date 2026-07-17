import type { Prisma } from "@prisma/client";

/**
 * Prisma's Decimal is a class instance and cannot cross the Server->Client
 * Component boundary. Converts known Decimal fields on a project to plain
 * numbers before passing data to client components.
 */
export function serializeProject<T extends { budget: Prisma.Decimal | null; budgetSpent: Prisma.Decimal | null }>(
  project: T
): Omit<T, "budget" | "budgetSpent"> & { budget: number | null; budgetSpent: number | null } {
  return {
    ...project,
    budget: project.budget ? Number(project.budget) : null,
    budgetSpent: project.budgetSpent ? Number(project.budgetSpent) : null,
  };
}
