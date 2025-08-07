// app/api/products/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { productUpdateSchema } from "@/lib/validation";

// GET /api/products/:id (public)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return notFound();
  return ok(product);
}

// PATCH /api/products/:id (admin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = productUpdateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid product body", parsed.error.flatten());

  const product = await prisma.product.update({ where: { id }, data: parsed.data });
  return ok(product);
}

// DELETE /api/products/:id (admin) — cascade dependents
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const { id } = await params;

  await prisma.cartItem.deleteMany({ where: { productId: id } });
  await prisma.orderItem.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  return ok({ success: true });
}
