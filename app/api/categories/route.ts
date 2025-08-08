import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, created, forbidden } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return ok(categories);
}

export async function POST(req: NextRequest) {
  const resOrSession = await requireAdmin(req);
  if (resOrSession instanceof Response) return resOrSession;

  const { name } = await req.json().catch(() => ({}));
  if (!name) return badRequest("Name is required");

  const exists = await prisma.category.findUnique({ where: { name } });
  if (exists) return badRequest("Category already exists");

  const category = await prisma.category.create({ data: { name } });
  return created(category, `/api/categories/${category.id}`);
}
