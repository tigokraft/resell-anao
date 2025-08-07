// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// GET /api/products (public)
export async function GET() {
  const products = await prisma.product.findMany();
  return NextResponse.json(products);
}

// POST /api/products (admin)
export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAdmin(req);
  if (sessionOrResponse instanceof Response) return sessionOrResponse;

  const { name, description, price, imageUrl } = await req.json();
  const product = await prisma.product.create({
    data: { name, description, price, imageUrl },
  });
  return NextResponse.json(product);
}
