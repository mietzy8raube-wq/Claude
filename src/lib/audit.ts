import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

interface LogAuditParams {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
}: LogAuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        description,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    console.error("Audit-Log konnte nicht geschrieben werden:", error);
  }
}
