import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createContactSchema } from "@/lib/validations/company";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const companyAreaId = searchParams.get("companyAreaId");
    const type = searchParams.get("type");

    const contacts = await prisma.contact.findMany({
      where: {
        ...(companyAreaId ? { companyAreaId } : {}),
        ...(type ? { type: type as never } : {}),
      },
      include: { responsible: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = createContactSchema.parse(body);

    const contact = await prisma.contact.create({
      data: {
        type: data.type,
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        responsibleId: data.responsibleId || null,
        companyAreaId: data.companyAreaId || null,
      },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "Contact",
      entityId: contact.id,
      description: `Kontakt "${contact.name}" wurde erstellt`,
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
