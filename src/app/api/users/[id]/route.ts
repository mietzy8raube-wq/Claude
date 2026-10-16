import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { updateUserRoleSchema } from "@/lib/validations/settings";
import { logAudit } from "@/lib/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMINISTRATOR") {
      throw new ApiError(403, "Nur Administratoren dürfen Benutzer verwalten.");
    }

    const { id } = await params;
    const body = await request.json();
    const data = updateUserRoleSchema.parse(body);

    if (id === session.user.id) {
      throw new ApiError(400, "Das eigene Konto kann hier nicht geändert werden.");
    }

    const user = await prisma.user.update({ where: { id }, data });

    const changes = [
      data.role !== undefined ? `Rolle auf ${data.role}` : null,
      data.isActive !== undefined ? (data.isActive ? "aktiviert" : "deaktiviert") : null,
    ].filter(Boolean);

    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "User",
      entityId: user.id,
      description: `Benutzer ${user.name}: ${changes.join(", ")}`,
    });

    return NextResponse.json({ user: { id: user.id, role: user.role, isActive: user.isActive } });
  } catch (error) {
    return handleApiError(error);
  }
}
