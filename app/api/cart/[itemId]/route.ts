// app/api/cart/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// PATCH /api/cart/:itemId (customer) { quantity }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { itemId } = await params;
  const { quantity } = await req.json();
  const userId = (sessionOrResponse.user as any).id;

  const result = await prisma.cartItem.updateMany({
    where: { id: itemId, userId },
    data: { quantity },
  });
  return NextResponse.json(result);
}

// DELETE /api/cart/:itemId (customer)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { itemId } = await params;
  const userId = (sessionOrResponse.user as any).id;

  await prisma.cartItem.deleteMany({
    where: { id: itemId, userId },
  });
  return NextResponse.json({ success: true });
}
