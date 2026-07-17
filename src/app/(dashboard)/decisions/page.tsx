import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { DecisionsListView } from "@/components/decisions/decisions-list-view";

export default async function DecisionsPage() {
  const [decisions, users, projects] = await Promise.all([
    prisma.decision.findMany({
      include: {
        responsible: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        options: { orderBy: { position: "asc" } },
        _count: { select: { comments: true, linkedTasks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Entscheidungen" description="Anstehende und getroffene Geschäftsführungsentscheidungen." />
      <DecisionsListView decisions={decisions} users={users} projects={projects} />
    </div>
  );
}
