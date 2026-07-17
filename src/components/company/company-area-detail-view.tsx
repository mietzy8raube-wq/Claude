"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge, StatusBadge } from "@/components/tasks/badges";
import { AREA_ICON } from "./area-meta";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import type { AreaDetail } from "@/types/company";
import type { SelectUser } from "@/types/task";

const CONTACT_TYPE_LABEL: Record<string, string> = {
  KUNDE: "Kunde",
  LIEFERANT: "Lieferant",
  PARTNER: "Partner",
  SONSTIGE: "Sonstige",
};

export function CompanyAreaDetailView({ area, users }: { area: AreaDetail; users: SelectUser[] }) {
  const router = useRouter();
  const Icon = AREA_ICON[area.type];
  const [busy, setBusy] = useState(false);

  const [metric, setMetric] = useState({ name: "", value: "", unit: "", target: "", period: "" });
  const [noteContent, setNoteContent] = useState("");
  const [document, setDocument] = useState({ fileName: "", url: "" });
  const [contact, setContact] = useState({ name: "", company: "", email: "", phone: "", type: "KUNDE" });

  const showContacts = area.type === "KUNDEN" || area.type === "LIEFERANTEN";

  async function addMetric() {
    if (!metric.name.trim() || !metric.value || !metric.period.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/company-areas/${area.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: metric.name.trim(),
          value: Number(metric.value),
          unit: metric.unit || undefined,
          target: metric.target ? Number(metric.target) : undefined,
          period: metric.period.trim(),
        }),
      });
      setMetric({ name: "", value: "", unit: "", target: "", period: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!noteContent.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/company-areas/${area.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent.trim() }),
      });
      setNoteContent("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addDocument() {
    if (!document.fileName.trim() || !document.url.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/company-areas/${area.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: document.fileName.trim(), url: document.url.trim() }),
      });
      setDocument({ fileName: "", url: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addContact() {
    if (!contact.name.trim()) return;
    setBusy(true);
    try {
      await fetch(`/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, companyAreaId: area.id }),
      });
      setContact({ name: "", company: "", email: "", phone: "", type: "KUNDE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function updateResponsible(responsibleId: string) {
    await fetch(`/api/company-areas/${area.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsibleId: responsibleId === "__none__" ? null : responsibleId }),
    });
    router.refresh();
  }

  return (
    <div>
      <Link href="/company" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Zurück zur Unternehmensübersicht
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{area.name}</h1>
            {area.description && <p className="text-sm text-muted-foreground">{area.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Verantwortlich:</span>
          <Select value={area.responsibleId ?? "__none__"} onValueChange={updateResponsible}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nicht zugewiesen</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Kennzahlen ({area.metrics.length})</TabsTrigger>
          <TabsTrigger value="tasks">Aufgaben ({area.tasks.length})</TabsTrigger>
          <TabsTrigger value="notes">Notizen ({area.notes.length})</TabsTrigger>
          <TabsTrigger value="documents">Dokumente ({area.documents.length})</TabsTrigger>
          {showContacts && <TabsTrigger value="contacts">Kontakte ({area.contacts.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="metrics" className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {area.metrics.map((m) => (
              <Card key={m.id} className="p-3">
                <p className="text-xs text-muted-foreground">{m.name} · {m.period}</p>
                <p className="mt-1 text-xl font-semibold">
                  {m.value.toLocaleString("de-DE")} {m.unit}
                </p>
                {m.target !== null && (
                  <p className="text-xs text-muted-foreground">Ziel: {m.target.toLocaleString("de-DE")} {m.unit}</p>
                )}
              </Card>
            ))}
            {area.metrics.length === 0 && <p className="text-sm text-muted-foreground">Keine Kennzahlen erfasst.</p>}
          </div>
          <Card className="p-3">
            <p className="mb-2 text-sm font-medium">Kennzahl hinzufügen</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Input placeholder="Name" value={metric.name} onChange={(e) => setMetric((p) => ({ ...p, name: e.target.value }))} />
              <Input placeholder="Wert" type="number" value={metric.value} onChange={(e) => setMetric((p) => ({ ...p, value: e.target.value }))} />
              <Input placeholder="Einheit" value={metric.unit} onChange={(e) => setMetric((p) => ({ ...p, unit: e.target.value }))} />
              <Input placeholder="Ziel" type="number" value={metric.target} onChange={(e) => setMetric((p) => ({ ...p, target: e.target.value }))} />
              <Input placeholder="Periode (2026-07)" value={metric.period} onChange={(e) => setMetric((p) => ({ ...p, period: e.target.value }))} />
            </div>
            <Button size="sm" className="mt-2" disabled={busy} onClick={addMetric}>
              <Plus className="size-4" /> Hinzufügen
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-2">
          {area.tasks.map((task) => (
            <Card key={task.id} className="flex flex-row items-center justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-medium">{task.title}</p>
                <p className="text-xs text-muted-foreground">{task.assignee?.name ?? "Nicht zugewiesen"}</p>
              </div>
              <div className="flex items-center gap-2">
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
              </div>
            </Card>
          ))}
          {area.tasks.length === 0 && <p className="text-sm text-muted-foreground">Keine Aufgaben in diesem Bereich.</p>}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-3">
          {area.notes.map((note) => (
            <div key={note.id} className="flex gap-2">
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">{initials(note.author.name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{note.author.name}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{note.content}</p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Textarea placeholder="Notiz hinzufügen…" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} className="min-h-9" />
            <Button type="button" disabled={busy} onClick={addNote}>Speichern</Button>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-3">
          {area.documents.map((doc) => (
            <Card key={doc.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">{doc.fileName}</p>
                <p className="text-xs text-muted-foreground">{doc.uploadedBy.name} · {formatDate(doc.createdAt)}</p>
              </div>
              <a href={doc.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="size-4" />
              </a>
            </Card>
          ))}
          {area.documents.length === 0 && <p className="text-sm text-muted-foreground">Keine Dokumente hinterlegt.</p>}
          <Card className="p-3">
            <p className="mb-2 text-sm font-medium">Dokument-Link hinzufügen</p>
            <div className="flex gap-2">
              <Input placeholder="Dateiname" value={document.fileName} onChange={(e) => setDocument((p) => ({ ...p, fileName: e.target.value }))} />
              <Input placeholder="URL (z. B. SharePoint-Link)" value={document.url} onChange={(e) => setDocument((p) => ({ ...p, url: e.target.value }))} />
              <Button disabled={busy} onClick={addDocument}><Plus className="size-4" /></Button>
            </div>
          </Card>
        </TabsContent>

        {showContacts && (
          <TabsContent value="contacts" className="mt-4 space-y-3">
            {area.contacts.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.name}</p>
                  <span className="text-xs text-muted-foreground">{CONTACT_TYPE_LABEL[c.type]}</span>
                </div>
                <p className="text-xs text-muted-foreground">{c.company}</p>
                <p className="text-xs text-muted-foreground">{c.email} {c.phone && `· ${c.phone}`}</p>
              </Card>
            ))}
            {area.contacts.length === 0 && <p className="text-sm text-muted-foreground">Keine Kontakte erfasst.</p>}
            <Card className="p-3">
              <p className="mb-2 text-sm font-medium">Kontakt hinzufügen</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={contact.name} onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Firma" value={contact.company} onChange={(e) => setContact((p) => ({ ...p, company: e.target.value }))} />
                <Input placeholder="E-Mail" value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} />
                <Input placeholder="Telefon" value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <Button size="sm" className="mt-2" disabled={busy} onClick={addContact}>
                <Plus className="size-4" /> Hinzufügen
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
