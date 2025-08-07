// app/api/auth/signup/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { created, badRequest } from "@/lib/http";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
  const { email, password, name, role } = await request.json().catch(() => ({} as any));
  if (!email || !password) return badRequest("Email and password are required");
  if (role && !["ADMIN", "CUSTOMER"].includes(role)) return badRequest("Invalid role");

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return badRequest("User already exists");

  const hashed = await hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed, name, role: role ?? "CUSTOMER" },
  });

  return created(
    { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
    `/api/users/${user.id}`
  );
}
