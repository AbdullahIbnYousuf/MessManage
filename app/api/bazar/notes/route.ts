import { ActingError } from "@/lib/domain/acting";
import { withMemberRoute } from "@/lib/utils/acting-route";
// GET /api/bazar/notes — get shopping notes for the active trip
// PUT /api/bazar/notes — update shopping notes

import { requireAuth } from "@/lib/session";
import { withSerializableRetry } from "@/lib/services/debts/transactions";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireAuth();

    const config = await db.systemConfig.findFirst({
      include: { activeTrip: { select: { shoppingNotes: true } } },
    });

    return Response.json({
      data: { notes: config?.activeTrip?.shoppingNotes ?? null },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof ActingError) throw err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

async function putHandler(request: Request) {
  try {
    await requireAuth();

    const body = await request.json() as { notes: string };

    const config = await db.systemConfig.findFirst();
    if (!config?.activeTripId) {
      return Response.json({ error: "No active bazar trip found." }, { status: 400 });
    }

    const tripId = config.activeTripId;
    await withSerializableRetry((tx) => tx.bazarTrip.update({
      where: { id: tripId },
      data: { shoppingNotes: body.notes ?? "" },
    }));

    return Response.json({ data: { updated: true } });
  } catch (err) {
    if (err instanceof Response) return err;
    if (err instanceof ActingError) throw err;
    console.error(err);
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export const PUT = withMemberRoute("bazar.notes", putHandler);
