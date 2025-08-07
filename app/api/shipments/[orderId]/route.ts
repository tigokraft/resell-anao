// app/api/shipments/[orderId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// POST /api/shipments/:orderId (admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { orderId } = await params;
  const { carrier, trackingNumber } = await req.json();

  const shipment = await prisma.shipment.create({
    data: { orderId, carrier, trackingNumber, status: "label_created" },
  });

  await prisma.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });

  return NextResponse.json(shipment);
}

// PATCH /api/shipments/:orderId (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { orderId } = await params;
  const updates = await req.json();

  const shipment = await prisma.shipment.update({
    where: { orderId },
    data: updates,
  });
  return NextResponse.json(shipment);
}
