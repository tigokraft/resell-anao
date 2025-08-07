// lib/auth.ts
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * Returns either a session or a NextResponse (401).
 * Callers must check: `if (sessionOrResponse instanceof Response) return sessionOrResponse`
 */
export async function requireAuth(_req?: NextRequest) {
  const session = await getServerSession(authOptions as any);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

/**
 * Returns either a session or a NextResponse (401/403).
 * See usage pattern above.
 */
export async function requireAdmin(req?: NextRequest) {
  const resOrSession = await requireAuth(req);
  if (resOrSession instanceof Response) return resOrSession;
  // @ts-ignore - we attach role in NextAuth callbacks
  if (resOrSession.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return resOrSession;
}
