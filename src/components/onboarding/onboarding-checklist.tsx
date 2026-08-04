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
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  cta?: string;
}

function buildSteps(openTaskCount: number): OnboardingStep[] {
  return [
    {
      id: "profil",
      title: "Profil überprüfen",
      description: "Name, E-Mail-Adresse und Passwort in den Einstellungen kontrollieren.",
      icon: UserCircle,
      href: "/settings",
      cta: "Zu den Einstellungen",
    },
    {
      id: "unternehmen",
      title: "Unternehmen kennenlernen",
      description: "Die zehn Unternehmensbereiche und ihre Verantwortlichen ansehen.",
      icon: Building2,
      href: "/company",
      cta: "Unternehmensbereiche öffnen",
    },
    {
      id: "team",
      title: "Team & Ansprechpartner",
      description: "Geschäftsführung und Administration weiter unten auf dieser Seite kennenlernen.",
      icon: Users,
    },
    {
      id: "aufgaben",
      title: "Erste Aufgaben ansehen",
      description:
        openTaskCount > 0
          ? `Aktuell ${openTaskCount} offene ${openTaskCount === 1 ? "Aufgabe" : "Aufgaben"} für Sie.`
          : "Aktuell keine offenen Aufgaben zugewiesen.",
      icon: ListChecks,
      href: "/tasks/mine",
      cta: "Meine Aufgaben öffnen",
    },
    {
      id: "kalender",
      title: "Kalender prüfen",
      description: "Anstehende Termine und Meetings im Blick behalten.",
      icon: CalendarDays,
      href: "/calendar",
      cta: "Kalender öffnen",
    },
    {
      id: "integrationen",
      title: "Outlook verbinden (optional)",
      description: "Kalender mit Microsoft Outlook synchronisieren.",
      icon: Plug,
      href: "/integrations",
      cta: "Integrationen öffnen",
    },
  ];
}

function storageKey(userId: string) {
  return `gf-suite:onboarding:${userId}`;
}

export function OnboardingChecklist({ userId, openTaskCount }: { userId: string; openTaskCount: number }) {
  const steps = buildSteps(openTaskCount);
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

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

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[1.05rem] font-semibold tracking-tight">Ihre Einstiegs-Checkliste</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {completed.length} von {steps.length} Schritten erledigt
            </p>
          </div>
          <span className="shrink-0 text-2xl font-semibold tabular-nums text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="mb-6" />

        <div className="flex flex-col divide-y divide-border">
          {steps.map((step) => {
            const isDone = completed.includes(step.id);
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-start gap-3.5 py-4 first:pt-0 last:pb-0">
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
                  <p className={cn("font-medium", isDone && "text-muted-foreground line-through")}>
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
      </CardContent>
    </Card>
  );
}
