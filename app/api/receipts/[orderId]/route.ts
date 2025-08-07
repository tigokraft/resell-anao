// app/api/receipts/[orderId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// POST /api/receipts/:orderId (admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { orderId } = await params;
  const { pdfUrl } = await req.json();

  const receipt = await prisma.receipt.upsert({
    where: { orderId },
    create: { orderId, pdfUrl },
    update: { pdfUrl, createdAt: new Date() },
  });

  return NextResponse.json(receipt);
}
