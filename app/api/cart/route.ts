// app/api/cart/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { cartAddSchema } from "@/lib/validation";

// GET /api/cart
export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  return ok(items);
}

// POST /api/cart { productId, quantity }
export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAuth(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;
  const userId = (sessionOrResponse.user as any).id;

  const json = await req.json().catch(() => null);
  const parsed = cartAddSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid cart body", parsed.error.flatten());

  const { productId, quantity } = parsed.data;

  const existing = await prisma.cartItem.findFirst({ where: { userId, productId } });
  const item = existing
    ? await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      })
    : await prisma.cartItem.create({
        data: { userId, productId, quantity },
      });

  return existing ? ok(item) : created(item, `/api/cart/${item.id}`);
}
