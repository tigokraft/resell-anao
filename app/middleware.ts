// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // all admin mutations under /api/products, /api/shipments, /api/receipts
  if (
    pathname.startsWith("/api/products") ||
    pathname.startsWith("/api/shipments") ||
    pathname.startsWith("/api/receipts")
  ) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token || token.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/products/:path*", "/api/shipments/:path*", "/api/receipts/:path*"],
};
