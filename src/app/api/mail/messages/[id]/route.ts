import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError } from "@/lib/api-utils";
import { requireMailAccess } from "@/lib/mail/access";
import { getMessage, markMessageRead } from "@/lib/graph/client";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const token = await requireMailAccess(session.user.id);
    const message = await getMessage(token, id);
    if (!message.isRead) {
      await markMessageRead(token, id).catch(() => undefined);
    }
    const tickets = await prisma.task.findMany({
      where: { sourceEmailId: id },
      select: { id: true, ticketNumber: true, title: true, status: true },
    });
    return NextResponse.json({ message: { ...message, isRead: true }, tickets });
  } catch (error) {
    return handleApiError(error);
  }
}

const patchSchema = z.object({ isRead: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const data = patchSchema.parse(await request.json());
    const token = await requireMailAccess(session.user.id);
    await markMessageRead(token, id, data.isRead);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
