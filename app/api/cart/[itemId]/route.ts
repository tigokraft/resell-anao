import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const { user } = await requireAuth(req);
  const { quantity } = await req.json();
  const item = await prisma.cartItem.updateMany({
    where: { id: params.itemId, userId: user.id },
    data: { quantity },
  });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { itemId: string } }) {
  const { user } = await requireAuth(req);
  await prisma.cartItem.deleteMany({
    where: { id: params.itemId, userId: user.id },
  });
  return NextResponse.json({ success: true });
}
