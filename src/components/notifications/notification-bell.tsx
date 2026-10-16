"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  UserPlus,
  MessageSquare,
  RefreshCw,
  Clock,
  AlertTriangle,
  AlarmClock,
  CheckCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: LucideIcon; className: string }> = {
  ZUGEWIESEN: { icon: UserPlus, className: "bg-chart-2/15 text-chart-2" },
  KOMMENTAR: { icon: MessageSquare, className: "bg-muted text-muted-foreground" },
  STATUS_GEAENDERT: { icon: RefreshCw, className: "bg-success/15 text-success" },
  FRIST_BALD: { icon: Clock, className: "bg-warning/20 text-warning-foreground" },
  UEBERFAELLIG: { icon: AlertTriangle, className: "bg-destructive/15 text-destructive" },
  ERINNERUNG: { icon: AlarmClock, className: "bg-warning/20 text-warning-foreground" },
};

const POLL_MS = 60_000;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  const rtf = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      setItems(body.notifications ?? []);
      setUnread(body.unreadCount ?? 0);
    } catch {
      // Netzwerkfehler beim Polling still ignorieren
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  async function markRead(body: { all: true } | { ids: string[] }) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function openItem(item: NotificationItem) {
    if (!item.isRead) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      markRead({ ids: [item.id] });
    }
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    await markRead({ all: true });
  }

  const BellIcon = unread > 0 ? BellRing : Bell;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Benachrichtigungen (${unread} ungelesen)`}>
          <BellIcon className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold">Benachrichtigungen</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="size-3.5" /> Alle gelesen
            </Button>
          )}
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Keine Benachrichtigungen – alles im Griff.
            </div>
          ) : (
            items.map((item) => {
              const meta = TYPE_META[item.type] ?? TYPE_META.KOMMENTAR;
              const Icon = meta.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={cn(
                    "flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/60",
                    !item.isRead && "bg-primary/[0.04]"
                  )}
                >
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", meta.className)}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", !item.isRead && "font-medium")}>{item.title}</span>
                    {item.message && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.message}</span>
                    )}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(item.createdAt)}</span>
                  </span>
                  {!item.isRead && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="ungelesen" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
