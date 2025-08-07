// app/api/orders/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

// GET /api/orders/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: { include: { product: true } },
      shipment: true,
      receipt: true,
    },
  });
  if (!order) return notFound();
  return ok(order);
}
