import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { DeadlinesView, type DeadlineItem } from "@/components/deadlines/deadlines-view";

export default async function DeadlinesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const visible = { OR: [{ visibility: "GEMEINSAM" as const }, { assigneeId: userId }, { createdById: userId }] };

  const [tasks, withoutDueDate, milestones, decisions, users] = await Promise.all([
    prisma.task.findMany({
      where: { ...visible, status: { not: "ERLEDIGT" }, dueDate: { not: null } },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    }),
    prisma.task.count({ where: { ...visible, status: { not: "ERLEDIGT" }, dueDate: null } }),
    prisma.projectMilestone.findMany({
      where: { isDone: false, dueDate: { not: null }, project: { status: { in: ["GEPLANT", "LAUFEND"] } } },
      select: { id: true, title: true, dueDate: true, project: { select: { id: true, name: true, owner: { select: { id: true, name: true } } } } },
    }),
    prisma.decision.findMany({
      where: { decisionDeadline: { not: null }, status: { notIn: ["ENTSCHIEDEN", "ZURUECKGESTELLT"] } },
      select: { id: true, title: true, decisionDeadline: true, responsible: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const items: DeadlineItem[] = [
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      priority: t.priority,
      status: t.status,
      assignee: t.assignee,
      context: t.project?.name ?? null,
    })),
    ...milestones.map((m) => ({
      kind: "milestone" as const,
      id: m.id,
      title: m.title,
      dueDate: m.dueDate!.toISOString(),
      assignee: m.project.owner,
      context: m.project.name,
      href: `/projects/${m.project.id}`,
    })),
    ...decisions.map((d) => ({
      kind: "decision" as const,
      id: d.id,
      title: d.title,
      dueDate: d.decisionDeadline!.toISOString(),
      assignee: d.responsible,
      context: null,
      href: `/decisions/${d.id}`,
    })),
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <PageHeader
        title="Fristen"
        description="Alle anstehenden und überfälligen Tickets, Meilensteine und Entscheidungen auf einen Blick."
      />
      <DeadlinesView items={items} users={users} currentUserId={userId} withoutDueDate={withoutDueDate} />
    </div>
  );
}
