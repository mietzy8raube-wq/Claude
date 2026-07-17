import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateUserRoleSchema } from "@/lib/validations/settings";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMINISTRATOR") {
      throw new ApiError(403, "Nur Administratoren dürfen Rollen ändern.");
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateUserRoleSchema.parse(body);

    const user = await prisma.user.update({ where: { id }, data: { role: data.role } });

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      description: `Rolle von ${user.name} auf ${data.role} geändert`,
    });

    return NextResponse.json({ user: { id: user.id, role: user.role } });
  } catch (error) {
    return handleApiError(error);
  }
}
