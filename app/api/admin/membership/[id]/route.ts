// POST /api/admin/membership/[id] — Approve or reject a membership request

import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json() as { action: string };
    const { action } = body;

    if (action !== "approve" && action !== "reject") {
      return Response.json({ error: "Invalid action. Use 'approve' or 'reject'." }, { status: 400 });
    }

    const membershipRequest = await db.membershipRequest.findUnique({
      where: { id },
    });

    if (!membershipRequest) {
      return Response.json({ error: "Membership request not found." }, { status: 404 });
    }

    if (membershipRequest.status !== "pending") {
      return Response.json({ error: "This request has already been reviewed." }, { status: 400 });
    }

    if (action === "reject") {
      await db.membershipRequest.update({
        where: { id },
        data: {
          status: "rejected",
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      return Response.json({ data: { status: "rejected" } });
    }

    // Approve: create User + link to request atomically
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: membershipRequest.email,
          name: membershipRequest.name,
          avatarUrl: membershipRequest.avatarUrl,
          role: "member",
          status: "active",
          joinedAt: new Date(),
        },
      });

      await tx.membershipRequest.update({
        where: { id },
        data: {
          status: "approved",
          userId: user.id,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      // Create a default meal pattern for the new member
      await tx.mealPattern.create({
        data: { userId: user.id },
      });

      return user;
    });

    return Response.json({ data: { status: "approved", userId: result.id } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
