import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { AREA_ICON } from "@/components/company/area-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Mail,
  ArrowRight,
  Rocket,
  Footprints,
  TrendingUp,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { initials } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  GESCHAEFTSFUEHRER: "Geschäftsführer",
  ADMINISTRATOR: "Administrator",
  MITARBEITER: "Mitarbeiter",
};

const OUTLOOK: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Woche 1 — Ankommen",
    description: "Abläufe, Ansprechpartner und laufende Themen in Ihrem Bereich kennenlernen.",
    icon: Footprints,
  },
  {
    title: "Monat 1 — Mitwirken",
    description: "Erste eigene Aufgaben übernehmen und in Projekten oder Meetings mitwirken.",
    icon: TrendingUp,
  },
  {
    title: "Monat 3 — Rückblick",
    description: "Gespräch mit der Geschäftsführung: Wie ist der Einstieg gelaufen, was fehlt noch?",
    icon: MessageCircle,
  },
];

export default async function OnboardingPage() {
  const session = await auth();
  const user = session!.user;

  const [openTaskCount, team, areas, personalArea] = await Promise.all([
    prisma.task.count({ where: { assigneeId: user.id, status: { not: "ERLEDIGT" } } }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["GESCHAEFTSFUEHRER", "ADMINISTRATOR"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.companyArea.findMany({
      select: { id: true, type: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
    prisma.companyArea.findFirst({
      where: { type: "PERSONAL" },
      select: { responsible: { select: { id: true, name: true, email: true, role: true } } },
    }),
  ]);

  const buddy = personalArea?.responsible ?? team[0] ?? null;
  const otherContacts = team.filter((member) => member.id !== buddy?.id);

  return (
    <div>
      <PageHeader title="Onboarding" description="Ihr Einstieg bei Drucklufttechnik Chemnitz." />

      <div className="relative mb-6 overflow-hidden rounded-xl bg-brand-gradient px-6 py-8 text-white shadow-md sm:px-9 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-semibold tracking-wider text-white/70 uppercase">
              <Sparkles className="size-4" />
              Willkommen im Team
            </div>
            <h1 className="mt-2 text-[1.9rem] leading-[1.15] font-semibold tracking-tight text-balance">
              Schön, dass Sie da sind, {user.name.split(" ")[0]}!
            </h1>
            <p className="mt-3 max-w-xl text-[14.5px] text-white/85">
              Diese Seite begleitet Sie durch Ihre ersten Wochen bei der{" "}
              <span className="font-medium text-white">Drucklufttechnik Chemnitz</span>.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 bg-white/15 text-white border-transparent">
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
        </div>
      </div>

      <Card className="mb-6 border-primary/20 bg-accent/40">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Rocket className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Ihr erster Schritt</p>
              <p className="mt-0.5 max-w-lg text-sm text-muted-foreground">
                {openTaskCount > 0
                  ? `Ihnen ${openTaskCount === 1 ? "wurde bereits eine Aufgabe zugewiesen" : `wurden bereits ${openTaskCount} Aufgaben zugewiesen`} — der schnellste Weg, direkt mitzuarbeiten.`
                  : "Ihnen wurde noch keine Aufgabe zugewiesen. Verschaffen Sie sich in der Zwischenzeit einen Überblick über das Unternehmen."}
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href={openTaskCount > 0 ? "/tasks/mine" : "/company"}>
              {openTaskCount > 0 ? "Meine Aufgaben ansehen" : "Unternehmen ansehen"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OnboardingChecklist userId={user.id} role={user.role} openTaskCount={openTaskCount} />
        </div>

        <Card>
          <CardContent className="p-6">
            {buddy && (
              <>
                <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Ihre Ansprechperson für den Einstieg
                </p>
                <div className="mb-5 flex items-center gap-3 rounded-lg bg-accent/60 p-3">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials(buddy.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{buddy.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ROLE_LABEL[buddy.role] ?? buddy.role} · verantwortlich für Personal
                    </p>
                  </div>
                  <a
                    href={`mailto:${buddy.email}`}
                    aria-label={`E-Mail an ${buddy.name}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <Mail className="size-4" />
                  </a>
                </div>
              </>
            )}

            {otherContacts.length > 0 && (
              <>
                <p className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Weitere Ansprechpartner
                </p>
                <div className="flex flex-col gap-4">
                  {otherContacts.map((member) => (
                    <div key={member.id} className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ROLE_LABEL[member.role] ?? member.role}
                        </p>
                      </div>
                      <a
                        href={`mailto:${member.email}`}
                        aria-label={`E-Mail an ${member.name}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <Mail className="size-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-4 text-[1.05rem] font-semibold tracking-tight">Ausblick</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {OUTLOOK.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.title}>
                <CardContent className="p-5">
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4.5" />
                  </div>
                  <p className="font-medium">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[1.05rem] font-semibold tracking-tight">Unternehmensbereiche</h2>
          <Link
            href="/company"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Alle ansehen
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {areas.map((area) => {
            const Icon = AREA_ICON[area.type];
            return (
              <Link key={area.id} href={`/company/${area.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex items-start gap-3 p-5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{area.name}</p>
                      {area.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {area.description}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
