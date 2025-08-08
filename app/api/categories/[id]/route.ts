import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, notFound } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resOrSession = await requireAdmin(req);
  if (resOrSession instanceof Response) return resOrSession;

  const { id } = await params;
  const { name } = await req.json().catch(() => ({}));
  if (!name) return badRequest("Name is required");

  const updated = await prisma.category.update({ where: { id }, data: { name } });
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resOrSession = await requireAdmin(req);
  if (resOrSession instanceof Response) return resOrSession;

  const { id } = await params;
  await prisma.category.delete({ where: { id } });
  return ok({ success: true });
}
