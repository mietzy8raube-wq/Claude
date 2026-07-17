import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { createCompanyDocumentSchema } from "@/lib/validations/company";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await request.json();
    const data = createCompanyDocumentSchema.parse(body);

    const document = await prisma.companyDocument.create({
      data: {
        companyAreaId: id,
        fileName: data.fileName,
        url: data.url,
        mimeType: data.mimeType,
        size: data.size,
        uploadedById: session.user.id,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
