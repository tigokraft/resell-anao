// app/api/receipts/[orderId]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { receiptCreateSchema } from "@/lib/validation";

// POST /api/receipts/:orderId  { pdfUrl }
export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { orderId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = receiptCreateSchema.safeParse(json);
  if (!parsed.success) return badRequest("Invalid receipt body", parsed.error.flatten());

  const receipt = await prisma.receipt.upsert({
    where: { orderId },
    create: { orderId, ...parsed.data },
    update: { ...parsed.data },
  });
  return created(receipt, `/api/receipts/${orderId}`);
}
