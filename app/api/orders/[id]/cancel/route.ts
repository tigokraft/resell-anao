import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "Cannot cancel non-pending order" }, { status: 400 });
  }

  await prisma.order.update({
    where: { id: params.id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
