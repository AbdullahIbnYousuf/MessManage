// GET /api/members — List all members for the public directory

import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const members = await db.user.findMany({
      orderBy: [{ status: "asc" }, { joinedAt: "asc" }],
      select: {
        id: true,
        name: true,
        nickname: true,
        avatarUrl: true,
        role: true,
        status: true,
        joinedAt: true,
      },
    });

    return Response.json({ data: members });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
