import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "warning" | "destructive" | "success";
}

const TONE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-accent text-accent-foreground",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/15 text-destructive",
  success: "bg-success/15 text-success",
};

export function StatCard({ label, value, icon: Icon, href, tone = "default" }: StatCardProps) {
  const content = (
    <Card className="flex flex-row items-center gap-3 p-4 transition-shadow hover:shadow-md">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASS[tone])}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
