// app/api/cart/[itemId]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { cartUpdateSchema } from "@/lib/validation";

// PATCH /api/cart/:itemId { quantity }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const { itemId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = cartUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid cart update", parsed.error.flatten());

  const result = await prisma.cartItem.updateMany({
    where: { id: itemId, userId },
    data: { quantity: parsed.data.quantity },
  });
  return ok(result);
}

// DELETE /api/cart/:itemId
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const { itemId } = await params;

  await prisma.cartItem.deleteMany({
    where: { id: itemId, userId },
  });
  return ok({ success: true });
}
