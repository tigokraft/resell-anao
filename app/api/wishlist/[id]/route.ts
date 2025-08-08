import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resOrSession = await requireAuth(req);
  if (resOrSession instanceof Response) return resOrSession;

  const userId = (resOrSession.user as any).id;
  const { id } = await params;

  await prisma.wishlistItem.deleteMany({ where: { id, userId } });
  return ok({ success: true });
}
