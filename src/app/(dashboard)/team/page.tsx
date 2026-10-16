import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TeamWorkloadView, type TeamMember, type QueueTicket } from "@/components/team/team-workload-view";
import { absenceCovers, findAbsence, formatAbsence, loadAbsences } from "@/lib/absences";
import type { Priority } from "@prisma/client";

/** Gewichtung je Priorität für die Auslastungsberechnung. */
const PRIORITY_POINTS: Record<Priority, number> = { NIEDRIG: 1, MITTEL: 2, HOCH: 3, KRITISCH: 5 };

export default async function TeamPage() {
  const session = await auth();
  const userId = session!.user.id;
  const visible = { OR: [{ visibility: "GEMEINSAM" as const }, { assigneeId: userId }, { createdById: userId }] };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const absenceHorizon = new Date(todayStart);
  absenceHorizon.setDate(absenceHorizon.getDate() + 60);
  const in14Days = new Date(todayStart);
  in14Days.setDate(in14Days.getDate() + 14);

  const [users, openTasks, completed, unassigned, absences] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.task.findMany({
      where: { ...visible, status: { not: "ERLEDIGT" }, assigneeId: { not: null } },
      select: { id: true, ticketNumber: true, title: true, assigneeId: true, priority: true, status: true, dueDate: true },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    }),
    prisma.task.findMany({
      where: { ...visible, status: "ERLEDIGT", completedAt: { gte: thirtyDaysAgo }, assigneeId: { not: null } },
      select: { assigneeId: true, dueDate: true, completedAt: true },
    }),
    prisma.task.findMany({
      where: { ...visible, status: { not: "ERLEDIGT" }, assigneeId: null },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    loadAbsences(todayStart, absenceHorizon),
  ]);

  const members: TeamMember[] = users.map((u) => {
    const mine = openTasks.filter((t) => t.assigneeId === u.id);
    const done = completed.filter((t) => t.assigneeId === u.id);
    const withDue = done.filter((t) => t.dueDate);
    const onTime = withDue.filter((t) => t.completedAt! <= endOfDay(t.dueDate!)).length;
    const mineAbsences = absences.filter((a) => a.userId === u.id);
    const current = mineAbsences.find((a) => a.approved === true && absenceCovers(a, now));
    const next = mineAbsences.find((a) => a.startOn > now && a.startOn <= in14Days && a.approved !== false);
    return {
      id: u.id,
      name: u.name,
      absence: current
        ? { label: formatAbsence(current), current: true, pending: false }
        : next
          ? { label: formatAbsence(next), current: false, pending: next.approved !== true }
          : null,
      dueDuringAbsence: mine.filter((t) => t.dueDate && findAbsence(mineAbsences, u.id, t.dueDate)).length,
      email: u.email,
      role: u.role,
      open: mine.filter((t) => t.status === "OFFEN").length,
      inProgress: mine.filter((t) => t.status === "IN_BEARBEITUNG" || t.status === "ZUR_PRUEFUNG").length,
      blocked: mine.filter((t) => t.status === "BLOCKIERT").length,
      overdue: mine.filter((t) => t.dueDate && t.dueDate < todayStart).length,
      dueThisWeek: mine.filter((t) => t.dueDate && t.dueDate >= todayStart && t.dueDate < weekEnd).length,
      critical: mine.filter((t) => t.priority === "KRITISCH" || t.priority === "HOCH").length,
      load: mine.reduce((sum, t) => sum + PRIORITY_POINTS[t.priority], 0),
      completed30: done.length,
      onTimeRate: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
      next: mine.slice(0, 3).map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        title: t.title,
        dueDate: t.dueDate?.toISOString() ?? null,
        priority: t.priority,
      })),
    };
  });

  const queue: QueueTicket[] = unassigned.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    createdBy: t.createdBy.name,
    project: t.project?.name ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Team & Auslastung"
        description="Wer arbeitet woran? Auslastung, Fristen und Termintreue je Person – und offene Tickets verteilen."
      />
      <TeamWorkloadView members={members} queue={queue} />
    </div>
  );
}

function endOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}
