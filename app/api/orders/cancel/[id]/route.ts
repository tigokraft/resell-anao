// app/api/orders/cancel/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

// POST /api/orders/cancel/:id (customer) — can cancel if not shipped
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, userId } });
  if (!order) return badRequest("Order not found or not owned by user");
  if (order.status === "SHIPPED" || order.status === "DELIVERED") {
    return badRequest("Order already shipped, cannot cancel");
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  return ok(updated);
}
