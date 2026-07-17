import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { updateProfileSchema } from "@/lib/validations/settings";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: data.name },
    });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      description: "Profil aktualisiert",
    });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    return handleApiError(error);
  }
}
