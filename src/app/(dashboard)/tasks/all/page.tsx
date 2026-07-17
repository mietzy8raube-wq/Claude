import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "@/components/tasks/tasks-view";

export default async function AllTasksPage() {
  const [users, projects, departments, companyAreas] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.companyArea.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Alle Aufgaben" description="Alle gemeinsamen Aufgaben im Unternehmen." />
      <TasksView scope="all" users={users} projects={projects} departments={departments} companyAreas={companyAreas} />
    </div>
  );
}
