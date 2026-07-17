import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MeetingDetailView } from "@/components/meetings/meeting-detail-view";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [meeting, users] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        attendees: { include: { user: { select: { id: true, name: true } } } },
        agendaItems: { orderBy: { position: "asc" } },
        resolutions: {
          include: { responsible: { select: { id: true, name: true } }, generatedTask: { select: { id: true } } },
          orderBy: { createdAt: "asc" },
        },
        attachments: true,
      },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  if (!meeting) {
    notFound();
  }

  return <MeetingDetailView meeting={meeting} users={users} />;
}
