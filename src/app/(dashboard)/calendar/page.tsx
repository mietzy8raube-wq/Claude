import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarAgendaView } from "@/components/calendar/calendar-agenda-view";

export default async function CalendarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 60);

  const [events, connection] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId, startTime: { gte: from, lte: to } },
      include: {
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } },
        meeting: { select: { id: true, title: true } },
        decision: { select: { id: true, title: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.microsoftConnection.findUnique({ where: { userId } }),
  ]);

  return (
    <div>
      <PageHeader title="Kalender" description="Ihre Termine der nächsten Wochen, inklusive synchronisierter Outlook-Termine." />
      <CalendarAgendaView events={events} hasMicrosoftConnection={!!connection} />
    </div>
  );
}
