import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const resOrSession = await requireAuth(req);
  if (resOrSession instanceof Response) return resOrSession;

  const userId = (resOrSession.user as any).id;
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { addedAt: "desc" },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const resOrSession = await requireAuth(req);
  if (resOrSession instanceof Response) return resOrSession;

  const userId = (resOrSession.user as any).id;
  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return badRequest("productId required");

  const item = await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
  return created(item, `/api/wishlist/${item.id}`);
}
