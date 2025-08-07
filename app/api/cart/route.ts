// app/api/cart/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/cart (customer)
export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const userId = (sessionOrResponse.user as any).id;
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  return NextResponse.json(items);
}

// POST /api/cart (customer) { productId, quantity }
export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const userId = (sessionOrResponse.user as any).id;
  const { productId, quantity } = await req.json();

  const existing = await prisma.cartItem.findFirst({
    where: { userId, productId },
  });

  const item = existing
    ? await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + (quantity ?? 1) },
      })
    : await prisma.cartItem.create({
        data: { userId, productId, quantity: quantity ?? 1 },
      });

  return NextResponse.json(item);
}
