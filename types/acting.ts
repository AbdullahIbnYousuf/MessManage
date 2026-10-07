import type { SessionUser } from "@/types";

export type ActingSessionView = {
  id: string;
  admin: SessionUser;
  member: SessionUser;
  expiresAt: string;
};

export type IdentityContext = {
  actor: SessionUser | null;
  effective: SessionUser | null;
  loginBinding: string | null;
  acting: ActingSessionView | null;
  cookiePresent: boolean;
  error: { code: string; message: string } | null;
};

export type MemberActionView = {
  id: string;
  action: string;
  entityType: string;
  entityIds: string[];
  changes: unknown;
  createdAt: string;
  admin: { id: string; name: string };
  member: { id: string; name: string };
  reason?: string;
};
