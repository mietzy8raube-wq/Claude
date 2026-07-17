import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateCompanyAreaSchema } from "@/lib/validations/company";
import { logAudit } from "@/lib/audit";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;

    const area = await prisma.companyArea.findUnique({
      where: { id },
      include: {
        responsible: { select: { id: true, name: true } },
        metrics: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        documents: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } },
        contacts: { orderBy: { name: "asc" } },
        tasks: {
          include: { assignee: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!area) {
      throw new ApiError(404, "Unternehmensbereich nicht gefunden.");
    }

    return NextResponse.json({ area });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateCompanyAreaSchema.parse(body);

    const area = await prisma.companyArea.update({
      where: { id },
      data: { ...data, description: data.description === "" ? null : data.description },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "CompanyArea",
      entityId: area.id,
      description: `Unternehmensbereich "${area.name}" wurde aktualisiert`,
    });

    return NextResponse.json({ area });
  } catch (error) {
    return handleApiError(error);
  }
}
