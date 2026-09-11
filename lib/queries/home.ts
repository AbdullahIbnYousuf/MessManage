import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { buildHomeAttention, getHomeMealState } from "@/lib/domain/home";
import { fetchExpensesSummary } from "@/lib/queries/expenses";
import { fetchMoneySummary } from "@/lib/queries/money";
import {
  getNow,
  isDeadlinePassed,
  parseDateString,
  toDateString,
} from "@/lib/utils/dates";
import type { ExpensesSummary } from "@/types/expenses";
import type {
  HomeActiveTrip,
  HomeMealMember,
  HomeSummary,
} from "@/types/home";
import type { MoneySummary } from "@/types/money";
import type { SessionUser } from "@/types";

type HomeSummaryClient = Pick<
  PrismaClient,
  "user" | "mealRecord" | "mealEditRequest" | "systemConfig" | "membershipRequest"
>;

type HomeSummaryDependencies = {
  fetchExpensesSummary: (now: Date) => Promise<ExpensesSummary>;
  fetchMoneySummary: (args: {
    currentUserId: string;
    confirmedMoneyEnabled: boolean;
    now: Date;
  }) => Promise<MoneySummary>;
};

const defaultDependencies: HomeSummaryDependencies = {
  fetchExpensesSummary: (now) => fetchExpensesSummary(db, now),
  fetchMoneySummary: (args) => fetchMoneySummary(args),
};

function displayName(member: { name: string; nickname: string | null }): string {
  return member.nickname || member.name;
}

export async function fetchHomeSummary({
  currentUser,
  confirmedMoneyEnabled,
  client = db,
  now = getNow(),
  dependencies = defaultDependencies,
}: {
  currentUser: Pick<SessionUser, "id" | "role">;
  confirmedMoneyEnabled: boolean;
  client?: HomeSummaryClient;
  now?: Date;
  dependencies?: HomeSummaryDependencies;
}): Promise<HomeSummary> {
  const date = toDateString(now);
  const dateValue = parseDateString(date);
  const isAdmin = currentUser.role === "admin";

  const [
    members,
    records,
    config,
    editRequest,
    pendingMealEditRequests,
    pendingMembershipCount,
    expenses,
    money,
  ] = await Promise.all([
    client.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, nickname: true, avatarUrl: true },
      orderBy: { name: "asc" },
    }),
    client.mealRecord.findMany({
      where: { date: dateValue },
      select: { userId: true, mealCount: true, isLocked: true },
    }),
    client.systemConfig.findFirst({
      select: {
        mealDeadline: true,
        activeTrip: {
          select: {
            id: true,
            status: true,
            triggeredAt: true,
            shoppingNotes: true,
            assignee1Id: true,
            assignee2Id: true,
            assignee1: {
              select: { id: true, name: true, nickname: true, avatarUrl: true },
            },
            assignee2: {
              select: { id: true, name: true, nickname: true, avatarUrl: true },
            },
          },
        },
      },
    }),
    client.mealEditRequest.findFirst({
      where: {
        userId: currentUser.id,
        OR: [
          { batchId: null, mealRecord: { date: dateValue } },
          { batchId: { not: null }, targetDate: dateValue, status: "pending" },
        ],
      },
      select: { status: true },
      orderBy: { requestedAt: "desc" },
    }),
    isAdmin
      ? client.mealEditRequest.findMany({
          where: { status: "pending" },
          select: { id: true, batchId: true },
        })
      : Promise.resolve([]),
    isAdmin
      ? client.membershipRequest.count({ where: { status: "pending" } })
      : Promise.resolve(0),
    dependencies.fetchExpensesSummary(now),
    dependencies.fetchMoneySummary({
      currentUserId: currentUser.id,
      confirmedMoneyEnabled,
      now,
    }),
  ]);

  const recordByUser = new Map(records.map((record) => [record.userId, record]));
  const mealMembers: HomeMealMember[] = members
    .map((member) => {
      const record = recordByUser.get(member.id);
      return {
        userId: member.id,
        name: displayName(member),
        avatarUrl: member.avatarUrl,
        mealCount: record?.mealCount ?? null,
        isLocked: record?.isLocked ?? null,
        hasRecord: Boolean(record),
        isCurrentUser: member.id === currentUser.id,
      };
    })
    .sort((left, right) => {
      if (left.isCurrentUser !== right.isCurrentUser) return left.isCurrentUser ? -1 : 1;
      return left.name.localeCompare(right.name);
    });

  const currentMember = mealMembers.find((member) => member.isCurrentUser);
  if (!currentMember) {
    throw new Error("Authenticated member is missing from the active household.");
  }

  const deadline = config?.mealDeadline ?? "22:00";
  const pendingMealEditCount = new Set(
    pendingMealEditRequests.map((request) => request.batchId ?? request.id)
  ).size;
  const deadlinePassed = isDeadlinePassed(deadline, now);
  const mealState = getHomeMealState({
    hasRecord: currentMember.hasRecord,
    isLocked: currentMember.isLocked ?? false,
    deadlinePassed,
    editRequestStatus: editRequest?.status ?? null,
  });

  const trip = config?.activeTrip;
  const activeTrip: HomeActiveTrip | null = trip?.status === "open"
    ? {
        id: trip.id,
        status: "open",
        triggeredAt: trip.triggeredAt.toISOString(),
        shoppingNotes: trip.shoppingNotes,
        isCurrentUserAssigned:
          trip.assignee1Id === currentUser.id || trip.assignee2Id === currentUser.id,
        assignee1: trip.assignee1
          ? {
              id: trip.assignee1.id,
              name: displayName(trip.assignee1),
              avatarUrl: trip.assignee1.avatarUrl,
            }
          : null,
        assignee2: trip.assignee2
          ? {
              id: trip.assignee2.id,
              name: displayName(trip.assignee2),
              avatarUrl: trip.assignee2.avatarUrl,
            }
          : null,
      }
    : null;

  const attention = buildHomeAttention({
    isAdmin,
    mealState,
    isAssignedToBazar: activeTrip?.isCurrentUserAssigned ?? false,
    pendingMealEditCount,
    pendingMembershipCount,
    expenses,
    money,
  });

  return {
    generatedAt: now.toISOString(),
    date,
    currentUser: {
      id: currentMember.userId,
      name: currentMember.name,
    },
    meals: {
      deadline,
      deadlinePassed,
      total: mealMembers.reduce((total, member) => total + (member.mealCount ?? 0), 0),
      missingRecordCount: mealMembers.filter((member) => !member.hasRecord).length,
      members: mealMembers,
      currentMember: {
        ...currentMember,
        state: mealState,
        editRequestStatus: editRequest?.status ?? null,
      },
    },
    bazar: { activeTrip },
    attention,
    month: {
      month: money.currentMonth.month,
      provisionalBalance: money.currentMonth.balance,
      direction: money.currentMonth.direction,
      totalBazar: money.currentMonth.householdBazar,
      totalMeals: money.currentMonth.householdMeals,
      mealRate: money.currentMonth.mealRate,
    },
  };
}
