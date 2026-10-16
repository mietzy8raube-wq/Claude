import Link from "next/link";
import { MailWarning } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { MailboxView } from "@/components/mail/mailbox-view";
import { MAIL_SCOPES, hasScopes, isMicrosoftGraphConfigured } from "@/lib/graph/config";

export default async function MailPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [connection, users, projects] = await Promise.all([
    prisma.microsoftConnection.findUnique({ where: { userId }, select: { email: true, scopes: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: { status: { in: ["GEPLANT", "LAUFEND"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const header = (
    <PageHeader
      title="Postfach"
      description="Outlook-Posteingang direkt im Ticketsystem: E-Mails lesen, beantworten und mit einem Klick als Ticket übernehmen."
    />
  );

  const problem = !isMicrosoftGraphConfigured()
    ? {
        title: "Microsoft 365 ist noch nicht eingerichtet",
        description:
          "Ein Administrator muss die Entra-ID-App-Registrierung in der .env hinterlegen (siehe README → Entra-ID-App-Registrierung).",
      }
    : !connection
      ? {
          title: "Kein Microsoft-365-Konto verbunden",
          description: "Verbinden Sie Ihr Outlook-Konto, um Ihr Postfach hier zu sehen.",
        }
      : !hasScopes(connection.scopes, MAIL_SCOPES)
        ? {
            title: "Postfach-Berechtigung fehlt",
            description:
              "Ihre Verbindung stammt aus der Zeit vor der Mail-Integration. Bitte unter „Integrationen“ trennen und neu verbinden, um Mail.Read und Mail.Send zu erteilen.",
          }
        : null;

  if (problem) {
    return (
      <div>
        {header}
        <EmptyState
          icon={MailWarning}
          title={problem.title}
          description={problem.description}
          action={
            <Button asChild>
              <Link href="/integrations">Zu den Integrationen</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      {header}
      <MailboxView mailbox={connection!.email} users={users} projects={projects} currentUserId={userId} />
    </div>
  );
}
