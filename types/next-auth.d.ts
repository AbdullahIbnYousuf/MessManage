// Extends NextAuth session and JWT types to include our custom fields.
// Without this, TypeScript doesn't know about role, status, avatarUrl.

import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      status: string;
      avatarUrl: string | null;
    };
  }

  interface User extends DefaultUser {
    role?: string;
    status?: string;
    avatarUrl?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    status?: string;
    avatarUrl?: string | null;
  }
}
