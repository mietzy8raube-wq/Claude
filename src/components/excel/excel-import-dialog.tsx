"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ENTITY_FIELDS, ENTITY_LABELS, type ExcelEntity } from "@/lib/excel/fields";

interface ExcelImportDialogProps {
  entity: ExcelEntity;
  trigger?: React.ReactNode;
}

interface PreviewResult {
  headers: string[];
  mapping: Record<string, number>;
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
}

interface CommitResult {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
}

const NO_COLUMN = -1;

export function ExcelImportDialog({ entity, trigger }: ExcelImportDialogProps) {
  const router = useRouter();
  const fields = ENTITY_FIELDS[entity];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "mapping" | "result">("select");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep("select");
    setFile(null);
    setPreview(null);
    setResult(null);
  }

  async function handleFileChange(selected: File) {
    setFile(selected);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", selected);
      formData.append("entity", entity);
      const res = await fetch("/api/excel/import/preview", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Vorschau fehlgeschlagen");
      const body: PreviewResult = await res.json();
      setPreview(body);
      setStep("mapping");
    } catch {
      toast.error("Datei konnte nicht gelesen werden");
    } finally {
      setBusy(false);
    }
  }

  async function revalidate(mapping: Record<string, number>) {
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/excel/import/preview", { method: "POST", body: formData });
      const body: PreviewResult = await res.json();
      setPreview(body);
    } finally {
      setBusy(false);
    }
  }

  function updateMapping(fieldKey: string, columnIndex: number) {
    if (!preview) return;
    const mapping = { ...preview.mapping, [fieldKey]: columnIndex };
    setPreview({ ...preview, mapping });
    revalidate(mapping);
  }

  async function commitImport() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity", entity);
      formData.append("mapping", JSON.stringify(preview.mapping));
      const res = await fetch("/api/excel/import/commit", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Import fehlgeschlagen");
      const body: CommitResult = await res.json();
      setResult(body);
      setStep("result");
      router.refresh();
    } catch {
      toast.error("Import fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button type="button" variant="outline">
            <Upload /> Importieren
          </Button>
        )}
      </div>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ENTITY_LABELS[entity]} importieren</DialogTitle>
          <DialogDescription>XLSX oder CSV-Datei hochladen, Spalten zuordnen und Import prüfen.</DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-8">
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">XLSX- oder CSV-Datei auswählen</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              />
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Upload />} Datei auswählen
              </Button>
            </div>
            <a
              href={`/api/excel/template?entity=${entity}`}
              className="flex items-center justify-center gap-1 text-sm text-primary hover:underline"
            >
              <Download className="size-3.5" /> Excel-Vorlage herunterladen
            </a>
          </div>
        )}

        {step === "mapping" && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-lg font-semibold">{preview.totalRows}</p>
                <p className="text-xs text-muted-foreground">Zeilen gesamt</p>
              </div>
              <div className="rounded-md bg-success/10 p-2">
                <p className="text-lg font-semibold text-success">{preview.validCount}</p>
                <p className="text-xs text-muted-foreground">Gültig</p>
              </div>
              <div className="rounded-md bg-destructive/10 p-2">
                <p className="text-lg font-semibold text-destructive">{preview.errorCount}</p>
                <p className="text-xs text-muted-foreground">Fehler</p>
              </div>
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto">
              <p className="text-sm font-medium">Spaltenzuordnung</p>
              {fields.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="w-40 shrink-0 truncate text-sm">
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </span>
                  <Select
                    value={String(preview.mapping[field.key] ?? NO_COLUMN)}
                    onValueChange={(v) => updateMapping(field.key, Number(v))}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(NO_COLUMN)}>Nicht zugeordnet</SelectItem>
                      {preview.headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h || `Spalte ${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {preview.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-destructive/30">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeile</TableHead>
                      <TableHead>Feld</TableHead>
                      <TableHead>Fehler</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.errors.slice(0, 20).map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell>{e.field}</TableCell>
                        <TableCell className="text-destructive">{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded-md bg-success/10 p-2">
                <p className="text-lg font-semibold text-success">{result.created}</p>
                <p className="text-xs text-muted-foreground">Neu</p>
              </div>
              <div className="rounded-md bg-chart-2/10 p-2">
                <p className="text-lg font-semibold text-chart-2">{result.updated}</p>
                <p className="text-xs text-muted-foreground">Aktualisiert</p>
              </div>
              <div className="rounded-md bg-warning/10 p-2">
                <p className="text-lg font-semibold text-warning-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Übersprungen</p>
              </div>
              <div className="rounded-md bg-destructive/10 p-2">
                <p className="text-lg font-semibold text-destructive">{result.errors.length}</p>
                <p className="text-xs text-muted-foreground">Fehler</p>
              </div>
            </div>
            {result.errors.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeile</TableHead>
                      <TableHead>Feld</TableHead>
                      <TableHead>Meldung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.row}</TableCell>
                        <TableCell>{e.field}</TableCell>
                        <TableCell>{e.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-success">
                <CheckCircle2 className="size-4" /> Import ohne Fehler abgeschlossen.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "mapping" && (
            <>
              <Badge variant="outline" className="mr-auto">
                <AlertTriangle className="size-3" /> Pflichtfelder müssen zugeordnet sein
              </Badge>
              <Button variant="outline" onClick={reset}>Zurück</Button>
              <Button onClick={commitImport} disabled={busy || preview?.validCount === 0}>
                {busy && <Loader2 className="animate-spin" />} {preview?.validCount ?? 0} Datensätze importieren
              </Button>
            </>
          )}
          {step === "result" && <Button onClick={() => setOpen(false)}>Schließen</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
