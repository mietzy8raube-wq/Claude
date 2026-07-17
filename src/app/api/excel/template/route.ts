import { NextRequest, NextResponse } from "next/server";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { ENTITY_FIELDS, ENTITY_LABELS, type ExcelEntity } from "@/lib/excel/fields";
import { buildTemplateWorkbook } from "@/lib/excel/template";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const entity = new URL(request.url).searchParams.get("entity") as ExcelEntity | null;

    if (!entity || !(entity in ENTITY_FIELDS)) {
      throw new ApiError(400, "Unbekannter Entitätstyp.");
    }

    const buffer = await buildTemplateWorkbook(ENTITY_LABELS[entity], ENTITY_FIELDS[entity]);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Vorlage_${ENTITY_LABELS[entity]}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
