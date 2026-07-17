import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, ExternalLink } from "lucide-react";

interface DocumentRow {
  id: string;
  fileName: string;
  url: string | null;
  source: string;
  sourceLabel: string;
  sourceHref: string;
  uploadedBy: string;
  createdAt: Date;
}

export default async function DocumentsPage() {
  const [taskAttachments, projectFiles, meetingAttachments, companyDocuments] = await Promise.all([
    prisma.taskAttachment.findMany({
      include: { task: { select: { id: true, title: true } }, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.projectFile.findMany({
      include: { project: { select: { id: true, name: true } }, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.meetingAttachment.findMany({
      include: { meeting: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.companyDocument.findMany({
      include: { companyArea: { select: { id: true, name: true } }, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const documents: DocumentRow[] = [
    ...taskAttachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      url: a.url,
      source: "Aufgabe",
      sourceLabel: a.task.title,
      sourceHref: `/tasks/all`,
      uploadedBy: a.uploadedBy.name,
      createdAt: a.createdAt,
    })),
    ...projectFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      url: f.url,
      source: "Projekt",
      sourceLabel: f.project.name,
      sourceHref: `/projects/${f.project.id}`,
      uploadedBy: f.uploadedBy.name,
      createdAt: f.createdAt,
    })),
    ...meetingAttachments.map((m) => ({
      id: m.id,
      fileName: m.fileName,
      url: m.url,
      source: "Meeting",
      sourceLabel: m.meeting.title,
      sourceHref: `/meetings/${m.meeting.id}`,
      uploadedBy: "-",
      createdAt: m.createdAt,
    })),
    ...companyDocuments.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      url: d.url,
      source: "Unternehmen",
      sourceLabel: d.companyArea.name,
      sourceHref: `/company/${d.companyArea.id}`,
      uploadedBy: d.uploadedBy.name,
      createdAt: d.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div>
      <PageHeader
        title="Dokumente"
        description="Alle mit Aufgaben, Projekten, Meetings und Unternehmensbereichen verknüpften Dokumente."
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Noch keine Dokumente"
          description="Dokumente können direkt in Aufgaben, Projekten, Meetings oder Unternehmensbereichen hinzugefügt werden und erscheinen dann hier gesammelt."
        />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={`${doc.source}-${doc.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <FileText className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={doc.sourceHref} className="hover:underline">{doc.sourceLabel}</Link> · {doc.uploadedBy} · {formatDate(doc.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{doc.source}</Badge>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
