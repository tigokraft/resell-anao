import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [totalUsers, totalOrders, totalRevenue, lowStock] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.product.findMany({ where: { stock: { lt: 5 } } }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalOrders,
    totalRevenue: totalRevenue._sum.total || 0,
    lowStock,
  });
}
