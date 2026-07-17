import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { ENTITY_FIELDS, type ExcelEntity } from "@/lib/excel/fields";
import { parseSpreadsheet, suggestMapping, mapAndValidateRows, type ColumnMapping } from "@/lib/excel/import";

export async function POST(request: NextRequest) {
  try {
    await requireSession();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entity = formData.get("entity") as ExcelEntity | null;
    const mappingRaw = formData.get("mapping") as string | null;

    if (!file || !entity || !(entity in ENTITY_FIELDS)) {
      throw new ApiError(400, "Datei und Entitätstyp sind erforderlich.");
    }

    const fields = ENTITY_FIELDS[entity];
    const buffer = Buffer.from(await file.arrayBuffer());
    const { headers, rows } = await parseSpreadsheet(buffer, file.name);

    const mapping: ColumnMapping = mappingRaw ? JSON.parse(mappingRaw) : suggestMapping(headers, [...fields]);
    const { valid, errors } = mapAndValidateRows(rows, mapping, [...fields]);

    return NextResponse.json({
      headers,
      mapping,
      totalRows: rows.length,
      validCount: valid.length,
      errorCount: errors.length,
      errors: errors.slice(0, 100),
      previewRows: rows.slice(0, 10),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
