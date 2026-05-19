import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { z } from "zod";
import { UserRole } from "@prisma/client";

const RequestSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    if (id === admin.id) {
      return Response.json({ error: "You cannot change your own role." }, { status: 400 });
    }

    const body = await request.json();
    const result = RequestSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid role." }, { status: 400 });
    }

    const { role } = result.data;

    const user = await db.user.findUnique({ where: { id } });

    if (!user) {
      return Response.json({ error: "Member not found." }, { status: 404 });
    }

    if (user.status === "deactivated") {
      return Response.json({ error: "Cannot change role of a deactivated member." }, { status: 400 });
    }

    await db.user.update({
      where: { id },
      data: { role },
    });

    return Response.json({ data: { role } });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
