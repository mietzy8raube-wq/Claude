import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  TasksByAssigneeWidget,
  RunningProjectsWidget,
  ImportantDecisionsWidget,
  CriticalAlertsWidget,
  CalendarWidget,
  SyncStatusWidget,
  CompanyKpiWidget,
  ActivityFeedWidget,
} from "@/components/dashboard/widgets";
import { ListChecks, AlertOctagon, CalendarDays } from "lucide-react";
import type { Prisma, TaskStatus, Priority } from "@prisma/client";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const periodDays = params.period ? Number(params.period) : 14;

  const baseWhere: Prisma.TaskWhereInput = {};
  if (params.assigneeId) baseWhere.assigneeId = params.assigneeId;
  if (params.projectId) baseWhere.projectId = params.projectId;
  if (params.departmentId) baseWhere.departmentId = params.departmentId;
  if (params.priority) baseWhere.priority = params.priority as Priority;
  if (params.status) baseWhere.status = params.status as TaskStatus;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodDays);
  const upcomingEnd = new Date();
  upcomingEnd.setDate(upcomingEnd.getDate() + periodDays);

  const [
    openCount,
    overdueCount,
    dueTodayCount,
    criticalOpenCount,
    users,
    projects,
    departments,
    companyAreas,
    tasksByUserRaw,
    runningProjects,
    importantDecisions,
    todayEvents,
    upcomingEvents,
    connections,
    recentImports,
    failedSyncs,
    latestMetrics,
    activities,
    microsoftConnection,
  ] = await Promise.all([
    prisma.task.count({ where: { ...baseWhere, status: { not: "ERLEDIGT" } } }),
    prisma.task.count({ where: { ...baseWhere, status: { not: "ERLEDIGT" }, dueDate: { lt: todayStart } } }),
    prisma.task.count({ where: { ...baseWhere, status: { not: "ERLEDIGT" }, dueDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.task.count({ where: { ...baseWhere, status: { not: "ERLEDIGT" }, priority: "KRITISCH" } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.companyArea.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { isActive: true, role: "GESCHAEFTSFUEHRER" },
      select: {
        id: true,
        name: true,
        assignedTasks: {
          where: { ...baseWhere, status: { not: "ERLEDIGT" } },
          select: { id: true, dueDate: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { status: "LAUFEND", ...(params.projectId ? { id: params.projectId } : {}) },
      select: { id: true, name: true, progress: true, status: true, targetDate: true },
      orderBy: { targetDate: "asc" },
      take: 5,
    }),
    prisma.decision.findMany({
      where: { status: { in: ["ENTSCHEIDUNG_ERFORDERLICH", "DISKUSSION"] } },
      select: { id: true, title: true, status: true, decisionDeadline: true },
      orderBy: { decisionDeadline: "asc" },
      take: 5,
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: todayStart, lte: todayEnd } },
      select: { id: true, title: true, startTime: true, endTime: true, location: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gt: todayEnd, lte: upcomingEnd } },
      select: { id: true, title: true, startTime: true, endTime: true, location: true },
      orderBy: { startTime: "asc" },
      take: 5,
    }),
    prisma.microsoftConnection.findMany({
      select: { user: { select: { name: true } }, lastSyncAt: true, lastSyncStatus: true },
    }),
    prisma.excelOperationLog.findMany({
      where: { type: "IMPORT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { fileName: true, entity: true, createdAt: true, successCount: true, errorCount: true },
    }),
    prisma.syncLog.findMany({
      where: { status: "FEHLER", createdAt: { gte: periodStart } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { message: true, createdAt: true },
    }),
    prisma.companyMetric.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { companyArea: { select: { name: true } } },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: periodStart } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
    prisma.microsoftConnection.findUnique({ where: { userId } }),
  ]);

  const tasksByUser = tasksByUserRaw.map((u) => ({
    userId: u.id,
    name: u.name,
    open: u.assignedTasks.length,
    overdue: u.assignedTasks.filter((t) => t.dueDate && t.dueDate < todayStart).length,
    total: u.assignedTasks.length,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Übersicht über Aufgaben, Projekte, Entscheidungen und Termine."
        actions={
          <QuickActions
            users={users}
            projects={projects}
            departments={departments}
            companyAreas={companyAreas}
            hasMicrosoftConnection={!!microsoftConnection}
          />
        }
      />

      <DashboardFilters users={users} projects={projects} departments={departments} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Offene Aufgaben" value={openCount} icon={ListChecks} href="/tasks/all" />
        <StatCard label="Überfällige Aufgaben" value={overdueCount} icon={AlertOctagon} href="/tasks/all" tone={overdueCount > 0 ? "destructive" : "default"} />
        <StatCard label="Heute fällig" value={dueTodayCount} icon={CalendarDays} href="/tasks/all" tone="warning" />
        <StatCard label="Kritische Aufgaben" value={criticalOpenCount} icon={AlertOctagon} href="/tasks/all" tone={criticalOpenCount > 0 ? "destructive" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TasksByAssigneeWidget data={tasksByUser} />
        <RunningProjectsWidget projects={runningProjects} />
        <ImportantDecisionsWidget decisions={importantDecisions} />

        <CriticalAlertsWidget
          overdueCount={overdueCount}
          criticalTaskCount={criticalOpenCount}
          failedSyncCount={failedSyncs.length}
        />
        <CalendarWidget today={todayEvents} upcoming={upcomingEvents} />
        <SyncStatusWidget
          connections={connections.map((c) => ({ name: c.user.name, lastSyncAt: c.lastSyncAt, lastSyncStatus: c.lastSyncStatus }))}
          recentImports={recentImports}
          failedSyncs={failedSyncs}
        />

        <CompanyKpiWidget
          metrics={latestMetrics.map((m) => ({
            id: m.id,
            areaName: m.companyArea.name,
            name: m.name,
            value: Number(m.value),
            unit: m.unit,
            period: m.period,
          }))}
        />
        <div className="lg:col-span-2">
          <ActivityFeedWidget
            activities={activities.map((a) => ({
              id: a.id,
              description: a.description,
              userName: a.user?.name ?? null,
              createdAt: a.createdAt,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
