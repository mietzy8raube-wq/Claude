import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { MeetingsListView } from "@/components/meetings/meetings-list-view";

export default async function MeetingsPage() {
  const [meetings, users] = await Promise.all([
    prisma.meeting.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        attendees: true,
        agendaItems: { orderBy: { position: "asc" } },
        resolutions: true,
        _count: { select: { attachments: true } },
      },
      orderBy: { meetingDate: "desc" },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Meetings" description="Geschäftsführungsmeetings, Tagesordnungen und Beschlüsse." />
      <MeetingsListView meetings={meetings} users={users} />
    </div>
  );
}
