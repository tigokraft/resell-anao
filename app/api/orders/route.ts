import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { user } = await requireAuth(req);
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { items: { include: { product: true } }, shipment: true, receipt: true },
  });
  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const { user } = await requireAuth(req);
  const { items } = await req.json(); 
  // items: [{ productId, quantity }]
  let total = 0;
  const orderItemsData = await Promise.all(
    items.map(async ({ productId, quantity }) => {
      const prod = await prisma.product.findUnique({ where: { id: productId } });
      if (!prod) throw new Error("Invalid product");
      total += prod.price * quantity;
      return { productId, quantity, price: prod.price };
    })
  );
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      total,
      items: { create: orderItemsData },
    },
  });
  // TODO: integrate payment gateway here (Stripe)
  return NextResponse.json(order);
}
