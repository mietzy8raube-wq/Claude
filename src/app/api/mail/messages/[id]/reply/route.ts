import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { requireMailAccess } from "@/lib/mail/access";
import { replyToMessage } from "@/lib/graph/client";
import { logAudit } from "@/lib/audit";

const replySchema = z.object({
  comment: z.string().trim().min(1, "Antwort darf nicht leer sein").max(20000),
  replyAll: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const data = replySchema.parse(await request.json());
    const token = await requireMailAccess(session.user.id);
    await replyToMessage(token, id, data.comment, data.replyAll);
    await logAudit({
      userId: session.user.id,
      action: "UPDATE",
      entityType: "Email",
      entityId: id,
      description: data.replyAll ? "E-Mail allen beantwortet" : "E-Mail beantwortet",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
