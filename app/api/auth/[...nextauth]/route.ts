// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

export const authOptions = {
  session: { strategy: "jwt" as const },
  jwt: { secret: process.env.NEXTAUTH_SECRET },

  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        const ok = await compare(credentials.password, user.password);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name ?? "", role: user.role };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }: any) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }: any) {
      session.user = session.user || {};
      (session.user as any).id = token.sub;
      (session.user as any).role = token.role;
      return session;
    },
  },

  pages: { signIn: "/auth/signin" },
} as const;

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
