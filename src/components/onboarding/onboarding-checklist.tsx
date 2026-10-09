"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserCircle,
  Building2,
  ListChecks,
  CalendarDays,
  Plug,
  Users,
  Scale,
  FolderKanban,
  Presentation,
  Settings,
  ArrowRight,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/shared/alert-dialog";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

type Milestone = "heute" | "woche" | "monat";

const MILESTONE_LABEL: Record<Milestone, string> = {
  heute: "Heute",
  woche: "Diese Woche",
  monat: "Erster Monat",
};

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  milestone: Milestone;
  href?: string;
  cta?: string;
}

function buildSteps(role: Role, openTaskCount: number): OnboardingStep[] {
  const roleStep: Record<Role, { woche: OnboardingStep; monat: OnboardingStep }> = {
    GESCHAEFTSFUEHRER: {
      woche: {
        id: "role-woche",
        title: "Offene Entscheidungen prüfen",
        description: "Entscheidungen, die aktuell auf Ihre Einschätzung warten.",
        icon: Scale,
        milestone: "woche",
        href: "/decisions",
        cta: "Entscheidungen öffnen",
      },
      monat: {
        id: "role-monat",
        title: "Erstes Meeting vorbereiten",
        description: "Tagesordnung anlegen oder an einem bestehenden Meeting teilnehmen.",
        icon: Presentation,
        milestone: "monat",
        href: "/meetings",
        cta: "Meetings öffnen",
      },
    },
    ADMINISTRATOR: {
      woche: {
        id: "role-woche",
        title: "Projekte im Überblick behalten",
        description: "Laufende Projekte und ihre Meilensteine ansehen.",
        icon: FolderKanban,
        milestone: "woche",
        href: "/projects",
        cta: "Projekte öffnen",
      },
      monat: {
        id: "role-monat",
        title: "Benutzerverwaltung kennenlernen",
        description: "Zugänge und Rollen der Kolleginnen und Kollegen prüfen.",
        icon: Settings,
        milestone: "monat",
        href: "/settings",
        cta: "Einstellungen öffnen",
      },
    },
    MITARBEITER: {
      woche: {
        id: "role-woche",
        title: "Erste Aufgabe übernehmen",
        description:
          openTaskCount > 0
            ? `${openTaskCount} offene ${openTaskCount === 1 ? "Aufgabe wartet" : "Aufgaben warten"} bereits auf Sie.`
            : "Sobald Ihnen eine Aufgabe zugewiesen wird, erscheint sie hier.",
        icon: ListChecks,
        milestone: "woche",
        href: "/tasks/mine",
        cta: "Meine Aufgaben öffnen",
      },
      monat: {
        id: "role-monat",
        title: "An einem Meeting teilnehmen",
        description: "Tagesordnung und Beschlüsse eines Meetings nachvollziehen.",
        icon: Presentation,
        milestone: "monat",
        href: "/meetings",
        cta: "Meetings öffnen",
      },
    },
  };

  return [
    {
      id: "profil",
      title: "Profil überprüfen",
      description: "Name, E-Mail-Adresse und Passwort in den Einstellungen kontrollieren.",
      icon: UserCircle,
      milestone: "heute",
      href: "/settings",
      cta: "Zu den Einstellungen",
    },
    {
      id: "unternehmen",
      title: "Unternehmen kennenlernen",
      description: "Die zehn Unternehmensbereiche und ihre Verantwortlichen ansehen.",
      icon: Building2,
      milestone: "heute",
      href: "/company",
      cta: "Unternehmensbereiche öffnen",
    },
    {
      id: "team",
      title: "Ihre Ansprechperson kennenlernen",
      description: "Wer Sie in den ersten Wochen begleitet, steht weiter unten auf dieser Seite.",
      icon: Users,
      milestone: "heute",
    },
    {
      id: "kalender",
      title: "Kalender prüfen",
      description: "Anstehende Termine und Meetings im Blick behalten.",
      icon: CalendarDays,
      milestone: "woche",
      href: "/calendar",
      cta: "Kalender öffnen",
    },
    roleStep[role].woche,
    {
      id: "integrationen",
      title: "Outlook verbinden (optional)",
      description: "Kalender mit Microsoft Outlook synchronisieren.",
      icon: Plug,
      milestone: "monat",
      href: "/integrations",
      cta: "Integrationen öffnen",
    },
    roleStep[role].monat,
  ];
}

function storageKey(userId: string) {
  return `gf-suite:onboarding:${userId}`;
}

export function OnboardingChecklist({
  userId,
  role,
  openTaskCount,
}: {
  userId: string;
  role: Role;
  openTaskCount: number;
}) {
  const steps = buildSteps(role, openTaskCount);
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(userId));
      if (raw) setCompleted(JSON.parse(raw));
    } catch {
      // ignore malformed/unavailable storage
    }
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(userId), JSON.stringify(completed));
  }, [completed, hydrated, userId]);

  function toggle(id: string) {
    setCompleted((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  const progress = Math.round((completed.length / steps.length) * 100);
  const milestones: Milestone[] = ["heute", "woche", "monat"];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[1.05rem] font-semibold tracking-tight">Ihre Einstiegs-Checkliste</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm text-muted-foreground">
                {completed.length} von {steps.length} Schritten erledigt
              </p>
              {completed.length > 0 && (
                <>
                  <span className="text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1.5 py-0.5 text-muted-foreground"
                    onClick={() => setResetOpen(true)}
                  >
                    <RotateCcw />
                    Fortschritt zurücksetzen
                  </Button>
                </>
              )}
            </div>
          </div>
          <span className="shrink-0 text-2xl font-semibold tabular-nums text-primary transition-all duration-300">
            {progress}%
          </span>
        </div>
        <Progress value={progress} className="mb-2" />

        <AlertDialog
          open={resetOpen}
          onOpenChange={setResetOpen}
          title="Fortschritt zurücksetzen?"
          description="Alle erledigten Schritte dieser Checkliste werden als offen markiert. Das lässt sich nicht rückgängig machen."
          confirmLabel="Zurücksetzen"
          destructive
          onConfirm={() => setCompleted([])}
        />

        {milestones.map((milestone) => {
          const groupSteps = steps.filter((s) => s.milestone === milestone);
          const groupDone = groupSteps.filter((s) => completed.includes(s.id)).length;
          return (
            <div key={milestone} className="mt-6 first:mt-6">
              <div className="mb-1 flex items-baseline justify-between">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {MILESTONE_LABEL[milestone]}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {groupDone}/{groupSteps.length}
                </p>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {groupSteps.map((step) => {
                  const isDone = completed.includes(step.id);
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex items-start gap-3.5 py-4 first:pt-3 last:pb-0">
                      <Checkbox
                        checked={isDone}
                        onCheckedChange={() => toggle(step.id)}
                        aria-label={`${step.title} als erledigt markieren`}
                        className="mt-0.5"
                      />
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-medium transition-colors duration-200",
                            isDone && "text-muted-foreground line-through"
                          )}
                        >
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                      </div>
                      {step.href && (
                        <Link
                          href={step.href}
                          className="hidden shrink-0 items-center gap-1 self-center text-sm font-medium text-primary hover:underline sm:flex"
                        >
                          {step.cta}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
