import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string; assignee?: string; status?: string }>;
}) {
  const { ticket, assignee, status } = await searchParams;
  const [users, projects, departments, companyAreas] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.companyArea.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Meine Aufgaben" description="Aufgaben, die Ihnen zugewiesen sind oder an denen Sie beteiligt sind." />
      <TasksView
        scope="mine"
        initialTicketId={ticket ?? null}
        initialFilters={{ assigneeId: assignee ?? "", status: status ?? "" }}
        users={users} projects={projects} departments={departments} companyAreas={companyAreas} />
    </div>
  );
}
