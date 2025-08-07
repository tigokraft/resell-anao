// app/api/orders/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { orderCreateSchema } from "@/lib/validation";

// GET /api/orders
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
    orderBy: { createdAt: "desc" },
  });
  return ok(orders);
}

// POST /api/orders { items: [{ productId, quantity }] }
export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const json = await req.json().catch(() => null);
  const parsed = orderCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid order body", parsed.error.flatten());

  let total = 0;
  const toCreate: { productId: string; quantity: number; price: number }[] = [];
  for (const { productId, quantity } of parsed.data.items) {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    if (!p) return badRequest("Invalid product in order items");
    total += p.price * quantity;
    toCreate.push({ productId, quantity, price: p.price });
  }

  const order = await prisma.order.create({
    data: {
      userId,
      total,
      items: { create: toCreate },
    },
  });

  return created(order, `/api/orders/${order.id}`);
}
