import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  await requireAdmin(req);
  const { carrier, trackingNumber } = await req.json();
  const shipment = await prisma.shipment.create({
    data: { orderId: params.orderId, carrier, trackingNumber, status: "label_created" },
  });
  // Optionally update order.status → PROCESSING or SHIPPED
  await prisma.order.update({
    where: { id: params.orderId },
    data: { status: "SHIPPED" },
  });
  return NextResponse.json(shipment);
}

export async function PATCH(req: NextRequest, { params }: { params: { orderId: string } }) {
  await requireAdmin(req);
  const updates = await req.json(); // e.g. { status: "in_transit", deliveredAt: Date }
  const shipment = await prisma.shipment.update({
    where: { orderId: params.orderId },
    data: updates,
  });
  return NextResponse.json(shipment);
}
