import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  await requireAdmin(req);
  const { pdfUrl } = await req.json();
  const receipt = await prisma.receipt.upsert({
    where: { orderId: params.orderId },
    create: { orderId: params.orderId, pdfUrl },
    update: { pdfUrl, createdAt: new Date() },
  });
  return NextResponse.json(receipt);
}
