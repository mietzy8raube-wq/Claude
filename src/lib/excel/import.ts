import ExcelJS from "exceljs";
import { Readable } from "stream";
import type { ExcelFieldDef } from "./fields";

export interface ParsedSheet {
  headers: string[];
  rows: unknown[][];
}

function cellToPlainValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("text" in value) return (value as { text: string }).text;
    if ("result" in value) return (value as { result: unknown }).result;
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    }
  }
  return value;
}

export async function parseSpreadsheet(buffer: Buffer, fileName: string): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook();
  const isCsv = fileName.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream);
  } else {
    // @types/node's newer generic Buffer type is incompatible with ExcelJS's
    // bundled type definitions; the runtime value is a plain Node Buffer.
    await workbook.xlsx.load(buffer as never);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { headers: [], rows: [] };
  }

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cellToPlainValue(cell.value) ?? "").trim();
  });

  const rows: unknown[][] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;
    const values: unknown[] = [];
    let hasContent = false;
    for (let col = 1; col <= headers.length; col++) {
      const value = cellToPlainValue(row.getCell(col).value);
      if (value !== null && value !== "") hasContent = true;
      values[col - 1] = value;
    }
    if (hasContent) rows.push(values);
  }

  return { headers, rows };
}

export type ColumnMapping = Record<string, number>; // field.key -> header column index (0-based), -1 = unmapped

export function suggestMapping(headers: string[], fields: ExcelFieldDef[]): ColumnMapping {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const mapping: ColumnMapping = {};

  for (const field of fields) {
    const label = field.label.toLowerCase();
    let index = normalized.findIndex((h) => h === label);
    if (index === -1) {
      index = normalized.findIndex((h) => h.includes(label) || label.includes(h));
    }
    mapping[field.key] = index;
  }

  return mapping;
}

export interface RowValidationError {
  row: number;
  field: string;
  message: string;
}

export interface MappedRow {
  row: number;
  data: Record<string, unknown>;
}

export interface ValidationResult {
  valid: MappedRow[];
  errors: RowValidationError[];
}

export function mapAndValidateRows(
  rawRows: unknown[][],
  mapping: ColumnMapping,
  fields: ExcelFieldDef[]
): ValidationResult {
  const valid: MappedRow[] = [];
  const errors: RowValidationError[] = [];

  rawRows.forEach((rawRow, rowIndex) => {
    const rowNumber = rowIndex + 2; // 1-indexed + header row
    const data: Record<string, unknown> = {};
    let rowHasError = false;

    for (const field of fields) {
      const colIndex = mapping[field.key];
      const rawValue = colIndex >= 0 ? rawRow[colIndex] : null;

      if (field.required && (rawValue === null || rawValue === undefined || rawValue === "")) {
        errors.push({ row: rowNumber, field: field.label, message: "Pflichtfeld fehlt" });
        rowHasError = true;
        continue;
      }

      if (rawValue === null || rawValue === undefined || rawValue === "") {
        data[field.key] = null;
        continue;
      }

      if (field.type === "number") {
        const num = typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue).replace(",", "."));
        if (Number.isNaN(num)) {
          errors.push({ row: rowNumber, field: field.label, message: `Ungültige Zahl: "${rawValue}"` });
          rowHasError = true;
          continue;
        }
        data[field.key] = num;
      } else if (field.type === "date") {
        const date = rawValue instanceof Date ? rawValue : new Date(String(rawValue));
        if (Number.isNaN(date.getTime())) {
          errors.push({ row: rowNumber, field: field.label, message: `Ungültiges Datum: "${rawValue}"` });
          rowHasError = true;
          continue;
        }
        data[field.key] = date;
      } else if (field.type === "enum") {
        const text = String(rawValue).trim();
        const match =
          field.enumValues?.find((v) => v === text.toUpperCase()) ??
          field.enumValues?.find((v) => field.enumLabels?.[v]?.toLowerCase() === text.toLowerCase());
        if (!match) {
          errors.push({
            row: rowNumber,
            field: field.label,
            message: `Ungültiger Wert "${rawValue}". Erlaubt: ${field.enumValues?.join(", ")}`,
          });
          rowHasError = true;
          continue;
        }
        data[field.key] = match;
      } else {
        data[field.key] = String(rawValue).trim();
      }
    }

    if (!rowHasError) {
      valid.push({ row: rowNumber, data });
    }
  });

  return { valid, errors };
}
