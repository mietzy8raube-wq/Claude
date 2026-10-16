"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Inbox,
  Send,
  Search,
  Loader2,
  Paperclip,
  Ticket,
  Reply,
  ReplyAll,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  Mail,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PRIORITY_LABEL } from "@/components/tasks/badges";
import { formatTicketNumber } from "@/lib/ticket";
import { cn } from "@/lib/utils";

interface Address {
  emailAddress: { name: string; address: string };
}

interface MessageSummary {
  id: string;
  subject: string | null;
  bodyPreview: string;
  from?: Address;
  toRecipients?: Address[];
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance?: string;
  webLink?: string;
  tickets: { id: string; ticketNumber: number; status: string }[];
}

interface MessageDetail extends Omit<MessageSummary, "tickets"> {
  body?: { contentType: "html" | "text"; content: string };
  ccRecipients?: Address[];
}

interface Option {
  id: string;
  name: string;
}

const NONE = "__none__";

function formatReceived(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: d.getFullYear() === today.getFullYear() ? undefined : "2-digit" });
}

function senderName(a?: Address) {
  return a ? a.emailAddress.name || a.emailAddress.address : "Unbekannt";
}

/** Rendert HTML-Mails isoliert: keine Skripte, keine Formulare, Links öffnen in neuem Tab. */
function buildSrcDoc(body: MessageDetail["body"]) {
  if (!body) return "";
  const content =
    body.contentType === "html"
      ? body.content
      : `<pre style="white-space:pre-wrap;font-family:inherit">${body.content.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: cid:; style-src 'unsafe-inline'; font-src https: data:"><style>body{font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2430;margin:0;padding:4px 2px;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${content}</body></html>`;
}

export function MailboxView({
  mailbox,
  users,
  projects,
  currentUserId,
}: {
  mailbox: string;
  users: Option[];
  projects: Option[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [folder, setFolder] = useState<"inbox" | "sentitems">("inbox");
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [detailTickets, setDetailTickets] = useState<{ id: string; ticketNumber: number; title: string }[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState<{ open: boolean; all: boolean; text: string; sending: boolean }>({
    open: false,
    all: false,
    text: "",
    sending: false,
  });
  const [ticketOpen, setTicketOpen] = useState(false);

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ folder });
        if (activeQuery) params.set("q", activeQuery);
        if (append) params.set("skip", String(messages.length));
        const res = await fetch(`/api/mail/messages?${params}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Postfach konnte nicht geladen werden");
        setMessages((prev) => (append ? [...prev, ...body.messages] : body.messages));
        setHasMore(body.hasMore);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    // messages.length nur fürs Nachladen relevant
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folder, activeQuery]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string) {
    setSelectedId(id);
    setDetail(null);
    setReply({ open: false, all: false, text: "", sending: false });
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/mail/messages/${encodeURIComponent(id)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setDetail(body.message);
      setDetailTickets(body.tickets);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
    } catch (e) {
      toast.error((e as Error).message || "E-Mail konnte nicht geladen werden");
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendReply() {
    if (!detail || !reply.text.trim()) return;
    setReply((r) => ({ ...r, sending: true }));
    try {
      const res = await fetch(`/api/mail/messages/${encodeURIComponent(detail.id)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: reply.text, replyAll: reply.all }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Antwort konnte nicht gesendet werden");
      toast.success("Antwort gesendet");
      setReply({ open: false, all: false, text: "", sending: false });
    } catch (e) {
      toast.error((e as Error).message);
      setReply((r) => ({ ...r, sending: false }));
    }
  }

  const list = (
    <Card className={cn("flex flex-col overflow-hidden", selectedId && "hidden lg:flex")}>
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <Tabs value={folder} onValueChange={(v) => { setFolder(v as typeof folder); setSelectedId(null); }}>
            <TabsList>
              <TabsTrigger value="inbox"><Inbox className="size-4" /> Posteingang</TabsTrigger>
              <TabsTrigger value="sentitems"><Send className="size-4" /> Gesendet</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="icon" onClick={() => load()} aria-label="Aktualisieren">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveQuery(query.trim());
          }}
          className="relative"
        >
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`In ${mailbox} suchen…`} className="pl-8" />
        </form>
      </div>
      <div className="max-h-[calc(100vh-17rem)] min-h-[20rem] overflow-y-auto">
        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : loading && messages.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Keine E-Mails gefunden.</p>
        ) : (
          <>
            {messages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => open(m.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  selectedId === m.id && "bg-muted",
                  !m.isRead && "border-l-2 border-l-primary"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-sm", !m.isRead && "font-semibold")}>
                    {folder === "sentitems" ? `An: ${senderName(m.toRecipients?.[0])}` : senderName(m.from)}
                  </span>
                  {m.hasAttachments && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />}
                  <span className="shrink-0 text-xs text-muted-foreground">{formatReceived(m.receivedDateTime)}</span>
                </span>
                <span className={cn("truncate text-sm", !m.isRead ? "font-medium" : "text-foreground/90")}>
                  {m.importance === "high" && <span className="mr-1 text-destructive">!</span>}
                  {m.subject || "(kein Betreff)"}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{m.bodyPreview}</span>
                {m.tickets.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {m.tickets.map((t) => (
                      <Badge key={t.id} variant="outline" className="font-mono text-[10px]">
                        <Ticket className="size-3" /> {formatTicketNumber(t.ticketNumber)}
                      </Badge>
                    ))}
                  </span>
                )}
              </button>
            ))}
            {hasMore && (
              <div className="p-3">
                <Button variant="outline" className="w-full" onClick={() => load(true)} disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />} Weitere laden
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );

  const detailPane = (
    <Card className={cn("flex min-h-[24rem] flex-col overflow-hidden", !selectedId && "hidden lg:flex")}>
      {!selectedId ? (
        <EmptyState icon={Mail} title="Keine E-Mail ausgewählt" description="Wählen Sie links eine E-Mail aus." className="m-6 border-0 bg-transparent" />
      ) : detailLoading || !detail ? (
        <div className="flex flex-1 items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="space-y-3 border-b border-border p-4">
            <Button variant="ghost" size="sm" className="-ml-2 lg:hidden" onClick={() => setSelectedId(null)}>
              <ArrowLeft /> Zurück
            </Button>
            <h2 className="text-lg font-semibold leading-snug">{detail.subject || "(kein Betreff)"}</h2>
            <div className="text-sm">
              <p>
                <span className="font-medium">{senderName(detail.from)}</span>{" "}
                <span className="text-muted-foreground">&lt;{detail.from?.emailAddress.address}&gt;</span>
              </p>
              <p className="text-xs text-muted-foreground">
                An: {detail.toRecipients?.map(senderName).join(", ") || "–"}
                {detail.ccRecipients?.length ? ` · Cc: ${detail.ccRecipients.map(senderName).join(", ")}` : ""}
                {" · "}
                {new Date(detail.receivedDateTime).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setTicketOpen(true)}>
                <Ticket /> Als Ticket übernehmen
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReply({ open: true, all: false, text: "", sending: false })}>
                <Reply /> Antworten
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReply({ open: true, all: true, text: "", sending: false })}>
                <ReplyAll /> Allen antworten
              </Button>
              {detail.webLink && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={detail.webLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> In Outlook öffnen
                  </a>
                </Button>
              )}
            </div>
            {detailTickets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Tickets aus dieser E-Mail:</span>
                {detailTickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="font-medium underline-offset-4 hover:underline"
                    onClick={() => router.push(`/tasks/all?ticket=${t.id}`)}
                  >
                    {formatTicketNumber(t.ticketNumber)} {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {reply.open && (
            <div className="space-y-2 border-b border-border bg-muted/30 p-4">
              <Label htmlFor="mail-reply">{reply.all ? "Allen antworten" : `Antwort an ${senderName(detail.from)}`}</Label>
              <Textarea
                id="mail-reply"
                rows={5}
                value={reply.text}
                onChange={(e) => setReply((r) => ({ ...r, text: e.target.value }))}
                placeholder="Ihre Antwort… (der ursprüngliche Verlauf wird automatisch angehängt)"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setReply({ open: false, all: false, text: "", sending: false })}>
                  Abbrechen
                </Button>
                <Button size="sm" onClick={sendReply} disabled={reply.sending || !reply.text.trim()}>
                  {reply.sending ? <Loader2 className="animate-spin" /> : <Send />} Senden
                </Button>
              </div>
            </div>
          )}

          <iframe
            title="E-Mail-Inhalt"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={buildSrcDoc(detail.body)}
            className="min-h-[24rem] w-full flex-1 bg-white px-3"
          />
        </div>
      )}
    </Card>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {list}
        {detailPane}
      </div>
      {detail && (
        <CreateTicketDialog
          open={ticketOpen}
          onOpenChange={setTicketOpen}
          message={detail}
          users={users}
          projects={projects}
          currentUserId={currentUserId}
          onCreated={(t) => {
            setDetailTickets((prev) => [...prev, t]);
            setMessages((prev) =>
              prev.map((m) => (m.id === detail.id ? { ...m, tickets: [...m.tickets, { id: t.id, ticketNumber: t.ticketNumber, status: "OFFEN" }] } : m))
            );
          }}
        />
      )}
    </>
  );
}

function CreateTicketDialog({
  open,
  onOpenChange,
  message,
  users,
  projects,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: MessageDetail;
  users: Option[];
  projects: Option[];
  currentUserId: string;
  onCreated: (t: { id: string; ticketNumber: number; title: string }) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [priority, setPriority] = useState("MITTEL");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState(NONE);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(message.subject?.replace(/^(re|aw|fw|wg|fwd):\s*/i, "") || "E-Mail ohne Betreff");
      setPriority(message.importance === "high" ? "HOCH" : "MITTEL");
      setAssigneeId(currentUserId);
      setDueDate("");
      setProjectId(NONE);
      setNote("");
    }
  }, [open, message, currentUserId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/mail/messages/${encodeURIComponent(message.id)}/create-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          assigneeId: assigneeId === NONE ? null : assigneeId,
          priority,
          dueDate: dueDate || null,
          projectId: projectId === NONE ? null : projectId,
          note: note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Ticket konnte nicht erstellt werden");
      onCreated(body.task);
      onOpenChange(false);
      toast.success(`${formatTicketNumber(body.task.ticketNumber)} erstellt`, {
        action: { label: "Öffnen", onClick: () => router.push(`/tasks/all?ticket=${body.task.id}`) },
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ticket aus E-Mail erstellen</DialogTitle>
          <DialogDescription>
            Absender, Eingangsdatum und Text der E-Mail werden in die Ticketbeschreibung übernommen und das Ticket mit der
            E-Mail verknüpft.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="mt-title">Titel</Label>
            <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Verantwortlich</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nicht zugewiesen</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-due">Frist</Label>
              <Input id="mt-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Projekt</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Kein Projekt</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-note">Notiz (optional)</Label>
            <Textarea id="mt-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Was ist zu tun?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />} Ticket erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
