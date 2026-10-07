// Auth.js v5 configuration — Google OAuth only.
// On sign-in, checks for an existing User row. If none, creates a MembershipRequest.

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      status: string;
      avatarUrl: string | null;
      nickname: string | null;
      loginBinding?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    status?: string;
    avatarUrl?: string | null;
    nickname?: string | null;
    loginBinding?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      if (user) token.loginBinding = randomUUID();
      const email = user?.email ?? token?.email;
      if (email) {
        const dbUser = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
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
          token.nickname = dbUser.nickname;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.avatarUrl = token.avatarUrl ?? null;
        session.user.nickname = token.nickname ?? null;
        session.user.loginBinding = token.loginBinding;
      }
      return session;
    },
  },
  events: {
    async signOut(message) {
      const jar = await cookies();
      if (!jar.has("mm-acting")) return;
      jar.delete("mm-acting");
      if ("token" in message && message.token?.id && message.token.loginBinding) {
        const adminId = message.token.id;
        const loginBinding = message.token.loginBinding;
        await db.$transaction(async (tx) => {
          const sessions = await tx.adminActingSession.findMany({ where: { adminId, loginBinding, endedAt: null } });
          const endedAt = new Date();
          for (const session of sessions) {
            const changed = await tx.adminActingSession.updateMany({ where: { id: session.id, endedAt: null }, data: { endedAt } });
            if (changed.count) await tx.adminMemberAction.create({ data: {
              actingSessionId: session.id, adminId, memberId: session.memberId, action: "session.logout",
              entityType: "account", entityIds: [session.memberId], changes: { endedAt: endedAt.toISOString() },
            } });
          }
        });
      }
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
});
