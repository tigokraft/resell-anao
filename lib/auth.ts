// lib/auth.ts
import { type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { unauthorized, forbidden } from "@/lib/http";

/** Return session or Response(401). Callers must early-return if they get a Response. */
export async function requireAuth(_req?: NextRequest) {
  const session = await getServerSession(authOptions as any);
  if (!session || !session.user) return unauthorized();
  return session;
}

/** Return session (admin) or Response(401/403). */
export async function requireAdmin(req?: NextRequest) {
  const resOrSession = await requireAuth(req);
  if (resOrSession instanceof Response) return resOrSession;
  // @ts-ignore - role attached by next-auth callbacks
  if (resOrSession.user.role !== "ADMIN") return forbidden();
  return resOrSession;
}
