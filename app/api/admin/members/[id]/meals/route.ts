import { db } from "@/lib/db";
import {
  getAdminMealEditBlockReason,
  isMealDateCoveredByFinishedBulkCycle,
} from "@/lib/domain/meal";
import { fetchOrCreateMealRecordsForMonth } from "@/lib/queries/meal-records";
import { requireAdmin } from "@/lib/session";
import {
  firstDayOfMonth,
  getDhakaParts,
  getNow,
  lastDayOfMonth,
  toDateString,
} from "@/lib/utils/dates";

function isFutureMonth(year: number, month: number): boolean {
  const now = getDhakaParts(getNow());
  return year > now.y || (year === now.y && month > now.m);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const now = getDhakaParts(getNow());
    const year = Number.parseInt(searchParams.get("year") ?? String(now.y), 10);
    const month = Number.parseInt(searchParams.get("month") ?? String(now.m), 10);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      year < 1 ||
      month < 1 ||
      month > 12
    ) {
      return Response.json({ error: "Invalid year or month." }, { status: 400 });
    }

    if (isFutureMonth(year, month)) {
      return Response.json(
        { error: "Future months are not available in the admin calendar." },
        { status: 400 }
      );
    }

    const member = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        nickname: true,
        avatarUrl: true,
        status: true,
        joinedAt: true,
        deactivatedAt: true,
      },
    });

    if (!member) {
      return Response.json({ error: "Member not found." }, { status: 404 });
    }

    const monthStart = firstDayOfMonth(year, month);
    const monthEnd = lastDayOfMonth(year, month);
    const [records, settlement, finishedCycles] = await Promise.all([
      fetchOrCreateMealRecordsForMonth(id, year, month),
      db.monthlySettlement.findFirst({
        where: { month: monthStart },
        select: { id: true },
      }),
      db.bulkCycle.findMany({
        where: {
          status: "finished",
          startedAt: { lte: monthEnd },
          finishedAt: { gte: monthStart },
        },
        select: { startedAt: true, finishedAt: true },
      }),
    ]);

    const joinedDate = toDateString(member.joinedAt);
    const deactivatedDate = member.deactivatedAt
      ? toDateString(member.deactivatedAt)
      : null;
    const isSettled = settlement !== null;

    return Response.json({
      data: {
        member: {
          id: member.id,
          name: member.nickname || member.name,
          avatarUrl: member.avatarUrl,
          status: member.status,
        },
        month: `${year}-${String(month).padStart(2, "0")}`,
        isSettled,
        records: records.map((record) => {
          const recordDate = record.date.toISOString().slice(0, 10);
          const blockReason = getAdminMealEditBlockReason({
            recordDate,
            joinedDate,
            deactivatedDate,
            isMonthSettled: isSettled,
            isCoveredByFinishedBulkCycle:
              isMealDateCoveredByFinishedBulkCycle(
                record.date,
                finishedCycles
              ),
          });

          return {
            id: record.id,
            date: recordDate,
            mealCount: record.mealCount,
            isLocked: record.isLocked,
            canEdit: blockReason === null,
            blockReason,
          };
        }),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
