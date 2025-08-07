// app/api/shipments/[orderId]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { shipmentCreateSchema, shipmentUpdateSchema } from "@/lib/validation";

// POST /api/shipments/:orderId  { carrier, trackingNumber }
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { orderId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = shipmentCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid shipment body", parsed.error.flatten());

  const shipment = await prisma.shipment.create({
    data: { orderId, ...parsed.data, status: "label_created" },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });
  return created(shipment, `/api/shipments/${orderId}`);
}

// PATCH /api/shipments/:orderId  { status?, shippedAt?, deliveredAt? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { orderId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = shipmentUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid shipment update", parsed.error.flatten());

  const shipment = await prisma.shipment.update({
    where: { orderId },
    data: parsed.data as any,
  });
  return ok(shipment);
}
