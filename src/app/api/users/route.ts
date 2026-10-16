import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { createUserSchema } from "@/lib/validations/settings";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireSession();
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true, image: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMINISTRATOR") {
      throw new ApiError(403, "Nur Administratoren dürfen Benutzer anlegen.");
    }

    const data = createUserSchema.parse(await request.json());
    const email = data.email.trim().toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ApiError(409, "Es existiert bereits ein Benutzer mit dieser E-Mail-Adresse.");
    }

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        role: data.role,
        passwordHash: await bcrypt.hash(data.password, 12),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAudit({
      userId: session.user.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Benutzer ${user.name} (${user.role}) wurde angelegt`,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
