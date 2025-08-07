// app/api/products/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { productCreateSchema } from "@/lib/validation";

// GET /api/products?query=&min=&max=&limit=&cursor=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? undefined;
  const min = searchParams.get("min");
  const max = searchParams.get("max");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const cursor = searchParams.get("cursor") ?? undefined;

  const where: any = {};
  if (query) where.name = { contains: query, mode: "insensitive" };
  if (min || max) {
    where.price = {};
    if (min) where.price.gte = Number(min);
    if (max) where.price.lte = Number(max);
  }

  const products = await prisma.product.findMany({
    where,
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
  });

  const nextCursor = products.length > limit ? products[limit].id : null;
  const data = nextCursor ? products.slice(0, limit) : products;
  return ok({ items: data, nextCursor });
}

// POST /api/products (admin)
export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const json = await req.json().catch(() => null);
  const parsed = productCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid product body", parsed.error.flatten());

  const product = await prisma.product.create({ data: parsed.data });
  return created(product, `/api/products/${product.id}`);
}
