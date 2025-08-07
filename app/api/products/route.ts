import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";

// GET all products (public)
export async function GET() {
  const products = await prisma.product.findMany();
  return NextResponse.json(products);
}

// POST new product (admin only)
export async function POST(req: NextRequest) {
  await requireAdmin(req);
  const { name, description, price, imageUrl } = await req.json();
  const product = await prisma.product.create({ data: { name, description, price, imageUrl } });
  return NextResponse.json(product);
}
