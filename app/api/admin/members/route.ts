// GET  /api/admin/members — List all members
// POST /api/admin/members/[id]/deactivate — Deactivate a member

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();

    const members = await db.user.findMany({
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        status: true,
        joinedAt: true,
        deactivatedAt: true,
      },
    });

    return Response.json({ data: members });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
