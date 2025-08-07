import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user } = await requireAuth(req);
  const items = await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { product: true },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { user } = await requireAuth(req);
  const { productId, quantity } = await req.json();
  const existing = await prisma.cartItem.findFirst({
    where: { userId: user.id, productId },
  });
  const item = existing
    ? await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      })
    : await prisma.cartItem.create({
        data: { userId: user.id, productId, quantity },
      });
  return NextResponse.json(item);
}
