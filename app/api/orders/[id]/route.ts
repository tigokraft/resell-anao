import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await requireAuth(req);
  const order = await prisma.order.findFirst({
    where: { id: params.id, userId: user.id },
    include: { items: { include: { product: true } }, shipment: true, receipt: true },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}
