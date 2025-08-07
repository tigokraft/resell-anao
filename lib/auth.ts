import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function requireAuth(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    const res = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    throw res;
  }
  return session;
}

export async function requireAdmin(req: Request) {
  const session = await requireAuth(req);
  if (session.user.role !== "ADMIN") {
    const res = new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    throw res;
  }
  return session;
}
