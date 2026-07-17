import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectsGridView } from "@/components/projects/projects-grid-view";
import { serializeProject } from "@/lib/serialize";

export default async function ProjectsPage() {
  const [projects, users] = await Promise.all([
    prisma.project.findMany({
      include: {
        owner: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, name: true } } } },
        milestones: true,
        risks: true,
        _count: { select: { tasks: true, files: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Projekte" description="Laufende und abgeschlossene Projekte im Überblick." />
      <ProjectsGridView projects={projects.map(serializeProject)} users={users} />
    </div>
  );
}
