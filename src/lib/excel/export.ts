import ExcelJS from "exceljs";
import type { ExcelFieldDef } from "./fields";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E293B" },
};

export interface BuildExportOptions {
  sheetName: string;
  fields: ExcelFieldDef[];
  rows: Record<string, unknown>[];
  exportedBy: string;
  filters?: Record<string, string | undefined>;
}

export async function buildExportWorkbook({
  sheetName,
  fields,
  rows,
  exportedBy,
  filters,
}: BuildExportOptions): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GF-Suite";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = fields.map((f) => ({
    header: f.label,
    key: f.key,
    width: f.width ?? 20,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle" };
  });
  headerRow.height = 20;

  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const value = row[field.key];
      if (field.type === "date" && value) {
        values[field.key] = new Date(value as string | Date);
      } else if (field.type === "enum" && value && field.enumLabels) {
        values[field.key] = field.enumLabels[value as string] ?? value;
      } else {
        values[field.key] = value ?? "";
      }
    }
    sheet.addRow(values);
  }

  fields.forEach((field, index) => {
    if (field.type === "date") {
      sheet.getColumn(index + 1).numFmt = "dd.mm.yyyy";
    }
    if (field.type === "number") {
      sheet.getColumn(index + 1).numFmt = "#,##0.00";
    }
  });

  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: fields.length },
    };
  }

  const infoSheet = workbook.addWorksheet("Exportinformationen");
  infoSheet.columns = [
    { header: "Feld", key: "field", width: 24 },
    { header: "Wert", key: "value", width: 50 },
  ];
  infoSheet.getRow(1).font = { bold: true };
  infoSheet.addRow({ field: "Exportiert von", value: exportedBy });
  infoSheet.addRow({ field: "Exportdatum", value: new Date().toLocaleString("de-DE") });
  infoSheet.addRow({ field: "Anzahl Datensätze", value: rows.length });
  if (filters && Object.values(filters).some(Boolean)) {
    infoSheet.addRow({ field: "", value: "" });
    infoSheet.addRow({ field: "Aktive Filter", value: "" }).font = { bold: true };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) infoSheet.addRow({ field: key, value });
    });
  }

  return workbook.xlsx.writeBuffer();
}
