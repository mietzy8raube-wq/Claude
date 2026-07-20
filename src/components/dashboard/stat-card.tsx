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

const TONE_ICON_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-accent text-accent-foreground",
  warning: "bg-warning/20 text-warning-foreground",
  destructive: "bg-destructive/12 text-destructive",
  success: "bg-success/12 text-success",
};

const TONE_VALUE_CLASS: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  warning: "text-warning-foreground",
  destructive: "text-destructive",
  success: "text-success",
};

export function StatCard({ label, value, icon: Icon, href, tone = "default" }: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "group flex flex-row items-center gap-3.5 p-4",
        href && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg transition-transform duration-200",
          href && "group-hover:scale-105",
          TONE_ICON_CLASS[tone]
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className={cn("text-2xl leading-none font-semibold tabular-nums", TONE_VALUE_CLASS[tone])}>
          {value}
        </p>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );

  return href ? (
    <Link href={href} className="block transition-transform duration-200">
      {content}
    </Link>
  ) : (
    content
  );
}
