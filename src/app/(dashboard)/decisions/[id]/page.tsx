import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DecisionDetailView } from "@/components/decisions/decision-detail-view";

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [decision, linkableTasks] = await Promise.all([
    prisma.decision.findUnique({
      where: { id },
      include: {
        responsible: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        options: { orderBy: { position: "asc" } },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        linkedTasks: { include: { assignee: { select: { id: true, name: true } } } },
      },
    }),
    prisma.task.findMany({
      where: { decisionId: null },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (!decision) {
    notFound();
  }

  return <DecisionDetailView decision={decision} linkableTasks={linkableTasks} />;
}
