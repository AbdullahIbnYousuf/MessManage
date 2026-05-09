// Auth.js v5 configuration — Google OAuth only.
// On sign-in, checks for an existing User row. If none, creates a MembershipRequest.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.email) return false;

      // Check if a User row exists for this email
      const user = await db.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        // Deactivated users cannot sign in
        if (user.status === "deactivated") return "/auth/deactivated";
        return true;
      }

      // No User row — check for an existing MembershipRequest
      const existing = await db.membershipRequest.findFirst({
        where: { email: profile.email },
      });

      if (!existing) {
        // First time — create a pending MembershipRequest
        await db.membershipRequest.create({
          data: {
            email: profile.email,
            name: profile.name ?? "Unknown",
            avatarUrl: profile.picture ?? null,
            status: "pending",
            requestedAt: new Date(),
          },
        });
      }

      // Redirect based on request status
      if (existing?.status === "rejected") return "/auth/rejected";
      return "/auth/pending";
    },

    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            role: true,
            status: true,
          },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.avatarUrl = dbUser.avatarUrl;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.avatarUrl = token.avatarUrl as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
});
