import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyAreaDetailView } from "@/components/company/company-area-detail-view";
import { serializeArea } from "@/lib/serialize";

export default async function CompanyAreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [area, users] = await Promise.all([
    prisma.companyArea.findUnique({
      where: { id },
      include: {
        responsible: { select: { id: true, name: true } },
        metrics: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        documents: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        contacts: { orderBy: { name: "asc" } },
        tasks: { include: { assignee: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  if (!area) {
    notFound();
  }

  return <CompanyAreaDetailView area={serializeArea(area)} users={users} />;
}
