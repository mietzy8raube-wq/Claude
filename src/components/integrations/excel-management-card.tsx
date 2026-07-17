import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { ExcelExportButton } from "@/components/excel/excel-export-button";
import { ExcelImportDialog } from "@/components/excel/excel-import-dialog";
import { ENTITY_LABELS, type ExcelEntity } from "@/lib/excel/fields";

const ENTITIES: ExcelEntity[] = ["tasks", "projects", "decisions", "companyMetrics", "contacts"];

export function ExcelManagementCard() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-4" /> Excel-Import und -Export
        </CardTitle>
        <CardDescription>
          Vorlagen herunterladen, Daten importieren (mit Vorschau, Spaltenzuordnung und Fehlerbericht) und
          exportieren.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border rounded-md border border-border">
          {ENTITIES.map((entity) => (
            <div key={entity} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="text-sm font-medium">{ENTITY_LABELS[entity]}</span>
              <div className="flex flex-wrap items-center gap-2">
                <ExcelImportDialog entity={entity} />
                <ExcelExportButton entity={entity} label="Exportieren" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
