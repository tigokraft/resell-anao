import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

// POST /api/orders/cancel/:id (customer, PENDING only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resOrSession = await requireAuth(req);
  if (resOrSession instanceof Response) return resOrSession;

  const userId = (resOrSession.user as any).id;
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true },
  });
  if (!order) return badRequest("Order not found or not owned by user");
  if (order.status !== "PENDING") return badRequest("Order not cancelable");

  await prisma.$transaction(async (tx) => {
    // restore stock
    for (const it of order.items) {
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { increment: it.quantity } },
      });
    }
    await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
  });

  return ok({ success: true });
}
