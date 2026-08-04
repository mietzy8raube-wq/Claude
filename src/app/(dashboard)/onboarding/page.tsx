import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { AREA_ICON } from "@/components/company/area-meta";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, ArrowRight } from "lucide-react";
import { initials } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  GESCHAEFTSFUEHRER: "Geschäftsführer",
  ADMINISTRATOR: "Administrator",
  MITARBEITER: "Mitarbeiter",
};

export default async function OnboardingPage() {
  const session = await auth();
  const user = session!.user;

  const [openTaskCount, team, areas] = await Promise.all([
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
  ]);

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Ihr Einstieg bei Drucklufttechnik Chemnitz."
      />

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
              Diese Seite begleitet Sie durch Ihre ersten Schritte bei der{" "}
              <span className="font-medium text-white">Drucklufttechnik Chemnitz</span> — vom
              Kennenlernen der Unternehmensbereiche bis zu Ihren ersten Aufgaben.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0 bg-white/15 text-white border-transparent">
            {ROLE_LABEL[user.role] ?? user.role}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OnboardingChecklist userId={user.id} openTaskCount={openTaskCount} />
        </div>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-[1.05rem] font-semibold tracking-tight">Ansprechpartner</h2>
            <div className="flex flex-col gap-4">
              {team.map((member) => (
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
          </CardContent>
        </Card>
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
