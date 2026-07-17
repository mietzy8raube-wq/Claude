import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProjectDetailView } from "@/components/projects/project-detail-view";
import { serializeProject } from "@/lib/serialize";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [project, users] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        participants: { include: { user: { select: { id: true, name: true, email: true } } } },
        milestones: { orderBy: { position: "asc" } },
        risks: { orderBy: { createdAt: "desc" } },
        files: { include: { uploadedBy: { select: { id: true, name: true } } } },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        tasks: { include: { assignee: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        decisions: { select: { id: true, title: true, status: true } },
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  if (!project) {
    notFound();
  }

  return <ProjectDetailView project={serializeProject(project)} users={users} />;
}
