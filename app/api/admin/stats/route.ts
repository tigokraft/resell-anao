import { prisma } from "@/lib/prisma";
import { ok, forbidden } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const resOrSession = await requireAdmin(req as any);
  if (resOrSession instanceof Response) return resOrSession;

  const [totalUsers, totalOrders, totals, topProducts, lowStock, byStatus] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, price: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.product.findMany({ where: { stock: { lt: 5 } }, orderBy: { stock: "asc" }, take: 10 }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const revenue = totals._sum.total ?? 0;

  return ok({
    totalUsers,
    totalOrders,
    revenue,
    topProducts,
    lowStock,
    byStatus,
  });
}
