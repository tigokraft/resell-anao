// app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/orders (customer)
export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const userId = (sessionOrResponse.user as any).id;
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      items: { include: { product: true } },
      shipment: true,
      receipt: true,
    },
  });
  return NextResponse.json(orders);
}

// POST /api/orders (customer) { items: [{productId, quantity}] }
export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const userId = (sessionOrResponse.user as any).id;
  const { items } = await req.json();

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items" }, { status: 400 });
  }

  let total = 0;
  const toCreate: { productId: string; quantity: number; price: number }[] = [];

  for (const { productId, quantity } of items) {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) return NextResponse.json({ error: "Invalid product" }, { status: 400 });
    const qty = Number(quantity) || 1;
    total += p.price * qty;
    toCreate.push({ productId, quantity: qty, price: p.price });
  }

  const order = await prisma.order.create({
    data: {
      userId,
      total,
      items: { create: toCreate },
    },
  });

  return NextResponse.json(order);
}
