import ExcelJS from "exceljs";
import type { ExcelFieldDef } from "./fields";

export async function buildTemplateWorkbook(
  sheetName: string,
  fields: ExcelFieldDef[]
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GF-Suite";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = fields.map((f) => ({ header: f.label, key: f.key, width: f.width ?? 20 }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  });

  const exampleValues: Record<string, unknown> = {};
  for (const field of fields) {
    exampleValues[field.key] = field.example ?? "";
  }
  const exampleRow = sheet.addRow(exampleValues);
  exampleRow.eachCell((cell) => {
    cell.font = { italic: true, color: { argb: "FF94A3B8" } };
  });

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fields.length } };

  const infoSheet = workbook.addWorksheet("Anleitung");
  infoSheet.columns = [
    { header: "Spalte", key: "col", width: 26 },
    { header: "Pflichtfeld", key: "required", width: 14 },
    { header: "Format / Werte", key: "format", width: 60 },
  ];
  infoSheet.getRow(1).font = { bold: true };

  for (const field of fields) {
    let format = "Text";
    if (field.type === "date") format = "Datum (TT.MM.JJJJ)";
    if (field.type === "number") format = "Zahl";
    if (field.type === "enum") format = `Einer von: ${field.enumValues?.map((v) => field.enumLabels?.[v] ?? v).join(", ")}`;
    if (field.key === "id") format = "Nur beim Aktualisieren bestehender Datensätze angeben (aus Export-Datei)";

    infoSheet.addRow({
      col: field.label,
      required: field.required ? "Ja" : "Nein",
      format,
    });
  }

  return workbook.xlsx.writeBuffer();
}
