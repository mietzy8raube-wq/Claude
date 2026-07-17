import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createContactSchema } from "@/lib/validations/company";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createContactSchema.partial().parse(body);

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...data,
        company: data.company === "" ? null : data.company,
        email: data.email === "" ? null : data.email,
        phone: data.phone === "" ? null : data.phone,
        notes: data.notes === "" ? null : data.notes,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    await prisma.contact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
