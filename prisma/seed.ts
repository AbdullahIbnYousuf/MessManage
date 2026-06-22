/**
 * prisma/seed.ts — Development database seeder
 *
 * Populates the database with realistic fake data so you can test all features
 * without waiting for real time to pass.
 *
 * What this creates:
 *   - 4 users: 1 admin (Rahim) + 3 members (Karim, Jamal, Nadia)
 *   - November 2024: full month of meals, bazar expenses, maid charges,
 *     a finished bulk cycle, a fridge bill — so "previous month" features work
 *   - December 2024: partial month data for "current month" features
 *   - SystemConfig with default settings
 *
 * Commands:
 *   npm run db:seed    — run the seed
 *   npm run db:reset   — wipe everything and re-seed (safe to run many times)
 */

import { PrismaClient, UserRole, UserStatus, BazarTripStatus, BulkCycleStatus } from "@prisma/client";
import Decimal from "decimal.js";

const db = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a Date at local midnight for a given year, month (1-indexed), day */
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Returns a Date at a specific time */
function dt(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding development database...\n");

  // ── 1. SystemConfig ─────────────────────────────────────────────────────────
  // Upsert so re-running the seed doesn't fail on the unique constraint.
  // We use updateMany + create pattern because there's no unique field to upsert on
  // other than the auto-generated id.
  const existingConfig = await db.systemConfig.findFirst();
  if (!existingConfig) {
    await db.systemConfig.create({
      data: {
        mealDeadline: "22:00",
        maidChargeDefault: new Decimal("700"),
        activeTripId: null,
      },
    });
    console.log("✅ SystemConfig created");
  } else {
    console.log("⏭️  SystemConfig already exists — skipping");
  }

  // ── 2. Users ────────────────────────────────────────────────────────────────
  // Using upsert so re-running the seed is safe.
  const rahim = await db.user.upsert({
    where: { email: "a.a.y.tonmoy@gmail.com" },
    update: {},
    create: {
      email: "a.a.y.tonmoy@gmail.com",
      name: "Rahim Ahmed",
      nickname: "Rahim",
      role: UserRole.admin,
      status: UserStatus.active,
      joinedAt: d(2024, 10, 1),
    },
  });

  const karim = await db.user.upsert({
    where: { email: "karim@example.com" },
    update: {},
    create: {
      email: "karim@example.com",
      name: "Karim Hossain",
      nickname: "Karim",
      role: UserRole.member,
      status: UserStatus.active,
      joinedAt: d(2024, 10, 1),
    },
  });

  const jamal = await db.user.upsert({
    where: { email: "jamal@example.com" },
    update: {},
    create: {
      email: "jamal@example.com",
      name: "Jamal Uddin",
      nickname: "Jamal",
      role: UserRole.member,
      status: UserStatus.active,
      joinedAt: d(2024, 10, 1),
    },
  });

  const nadia = await db.user.upsert({
    where: { email: "nadia@example.com" },
    update: {},
    create: {
      email: "nadia@example.com",
      name: "Nadia Islam",
      nickname: "Nadia",
      role: UserRole.member,
      status: UserStatus.active,
      joinedAt: d(2024, 10, 1),
    },
  });

  const allUsers = [rahim, karim, jamal, nadia];
  console.log(`✅ ${allUsers.length} users created/verified`);

  // ── 3. MealPatterns ─────────────────────────────────────────────────────────
  // Each user has a default weekly meal pattern.
  for (const user of allUsers) {
    await db.mealPattern.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        monday: 1,
        tuesday: 1,
        wednesday: 1,
        thursday: 1,
        friday: 1,
        saturday: 1,
        sunday: 1,
      },
    });
  }
  console.log("✅ Meal patterns created");

  // ── 4. November 2024 — Full month meal records (all locked, past month) ─────
  const novemberMeals: Array<{
    userId: string;
    date: Date;
    mealCount: number;
    isLocked: boolean;
  }> = [];

  // Meal counts per user per day — realistic variation
  const mealCountsByUser: Record<string, number[]> = {
    [rahim.id]: [1,1,1,1,0,1,1, 1,1,1,0,1,1,1, 1,0,1,1,1,1,1, 1,1,1,1,0,1,1, 1,1],
    [karim.id]: [1,1,0,1,1,1,1, 0,1,1,1,1,1,0, 1,1,1,1,0,1,1, 1,0,1,1,1,1,1, 1,1],
    [jamal.id]: [1,1,1,1,1,0,1, 1,1,0,1,1,1,1, 0,1,1,1,1,1,0, 1,1,1,0,1,1,1, 1,0],
    [nadia.id]: [1,0,1,1,1,1,1, 1,1,1,1,0,1,1, 1,1,0,1,1,1,1, 0,1,1,1,1,0,1, 1,1],
  };

  for (const user of allUsers) {
    const counts = mealCountsByUser[user.id] ?? [];
    for (let day = 1; day <= 30; day++) {
      const mealCount = counts[day - 1] ?? 1;
      novemberMeals.push({
        userId: user.id,
        date: d(2024, 11, day),
        mealCount,
        isLocked: true, // Past month — all locked
      });
    }
  }

  // Use createMany with skipDuplicates so re-running is safe
  const novMealResult = await db.mealRecord.createMany({
    data: novemberMeals,
    skipDuplicates: true,
  });
  console.log(`✅ November meal records: ${novMealResult.count} created`);

  // ── 5. November 2024 — Bazar trips and expenses ─────────────────────────────
  // 8 completed trips across November. Each trip has one expense.
  const novBazarData = [
    { day: 3,  buyer: rahim, amount: "1850.00", note: "Weekly groceries" },
    { day: 7,  buyer: karim, amount: "2100.50", note: "Vegetables and fish" },
    { day: 11, buyer: jamal, amount: "1650.00", note: "Rice and oil" },
    { day: 15, buyer: nadia, amount: "1920.75", note: "Groceries" },
    { day: 18, buyer: rahim, amount: "2050.00", note: "Weekly groceries" },
    { day: 22, buyer: karim, amount: "1780.00", note: "Vegetables" },
    { day: 25, buyer: jamal, amount: "1990.25", note: "Groceries and spices" },
    { day: 28, buyer: nadia, amount: "1850.00", note: "End of month groceries" },
  ];

  for (const entry of novBazarData) {
    // Check if a trip already exists for this day to avoid duplicates
    const tripDate = d(2024, 11, entry.day);
    const existingTrip = await db.bazarTrip.findFirst({
      where: { triggeredById: entry.buyer.id, triggeredAt: dt(2024, 11, entry.day, 9) },
    });
    if (existingTrip) continue;

    const trip = await db.bazarTrip.create({
      data: {
        triggeredById: entry.buyer.id,
        status: BazarTripStatus.completed,
        triggeredAt: dt(2024, 11, entry.day, 9),
        completedAt: dt(2024, 11, entry.day, 11),
      },
    });

    await db.bazarExpense.create({
      data: {
        userId: entry.buyer.id,
        tripId: trip.id,
        amount: new Decimal(entry.amount),
        note: entry.note,
        date: tripDate,
        submittedAt: dt(2024, 11, entry.day, 11),
      },
    });
  }
  console.log("✅ November bazar trips and expenses created");

  // ── 6. November 2024 — Maid charges ─────────────────────────────────────────
  const novMonth = d(2024, 11, 1);
  for (const user of allUsers) {
    await db.maidCharge.upsert({
      where: { userId_month: { userId: user.id, month: novMonth } },
      update: {},
      create: {
        userId: user.id,
        amount: new Decimal("700"),
        month: novMonth,
        appliedAt: dt(2024, 11, 1, 10),
      },
    });
  }
  // Rahim paid the maid for November on behalf of everyone
  const existingMaidPayment = await db.maidPayment.findFirst({
    where: { paidById: rahim.id, month: novMonth },
  });
  if (!existingMaidPayment) {
    await db.maidPayment.create({
      data: {
        paidById: rahim.id,
        amount: new Decimal("2800"), // 700 × 4 members
        month: novMonth,
        note: "November maid salary — paid by Rahim",
        paidAt: dt(2024, 11, 30, 18),
      },
    });
  }
  console.log("✅ November maid charges and payment created");

  // ── 7. November 2024 — Bulk item cycle (finished) ───────────────────────────
  // A gas cylinder bought in October, finished in November.
  // This gives you a completed BulkCycle with BulkAllocation rows to test against.
  let gasCylinder = await db.bulkItem.findFirst({ where: { name: "Gas Cylinder" } });
  if (!gasCylinder) {
    gasCylinder = await db.bulkItem.create({
      data: {
        name: "Gas Cylinder",
        unit: "cylinder",
        createdAt: dt(2024, 10, 1, 10),
      },
    });
  }

  const existingFinishedCycle = await db.bulkCycle.findFirst({
    where: { bulkItemId: gasCylinder.id, status: BulkCycleStatus.finished },
  });

  if (!existingFinishedCycle) {
    const finishedCycle = await db.bulkCycle.create({
      data: {
        bulkItemId: gasCylinder.id,
        purchasedById: karim.id,
        cost: new Decimal("1400"),
        purchaseDate: d(2024, 10, 5),
        status: BulkCycleStatus.finished,
        startedAt: dt(2024, 10, 5, 10),
        finishedAt: dt(2024, 11, 20, 14),
        finishedById: rahim.id,
      },
    });

    // Allocations based on meal counts during Oct 5 – Nov 20
    // Simplified: each user had roughly equal meals, so equal allocation
    const allocationData = [
      { userId: rahim.id, meals: 45, amount: "350.00" },
      { userId: karim.id, meals: 43, amount: "336.36" },
      { userId: jamal.id, meals: 44, amount: "343.18" },
      { userId: nadia.id, meals: 44, amount: "370.46" }, // remainder goes here
    ];

    await db.bulkAllocation.createMany({
      data: allocationData.map((a) => ({
        cycleId: finishedCycle.id,
        userId: a.userId,
        mealsDuringCycle: a.meals,
        amount: new Decimal(a.amount),
        allocatedAt: dt(2024, 11, 20, 14),
      })),
    });
    console.log("✅ Finished bulk cycle (gas cylinder) with allocations created");
  } else {
    console.log("⏭️  Finished bulk cycle already exists — skipping");
  }

  // ── 8. November 2024 — Fridge bill ──────────────────────────────────────────
  // Posted in December for November. This is what the "previous month fridge bill"
  // feature needs to exist.
  const existingFridgeBill = await db.fridgeBill.findFirst({
    where: { month: novMonth },
  });
  if (!existingFridgeBill) {
    await db.$transaction(async (tx) => {
      const allocatedAt = dt(2024, 12, 2, 10);
      const fridgeBill = await tx.fridgeBill.create({
        data: {
          month: novMonth,
          previousReading: new Decimal("1380"),
          currentReading: new Decimal("1680"),
          unitPrice: new Decimal("8"),
          totalAmount: new Decimal("2400"),
          memberCount: 4,
          postedAt: allocatedAt,
          postedById: rahim.id,
        },
      });

      await tx.fridgeAllocation.createMany({
        data: [rahim.id, karim.id, jamal.id, nadia.id].map((userId) => ({
          billId: fridgeBill.id,
          userId,
          amount: new Decimal("600"),
          allocatedAt,
        })),
      });

      // Rahim paid the fridge bill
      await tx.fridgePayment.create({
        data: {
          billId: fridgeBill.id,
          paidById: rahim.id,
          amount: new Decimal("2400"),
          paidAt: allocatedAt,
        },
      });
    });
    console.log("✅ November fridge bill and payment created");
  } else {
    console.log("⏭️  November fridge bill already exists — skipping");
  }

  // ── 9. December 2024 — Partial month data (current month) ───────────────────
  // 18 days of December so the dashboard has something to show.
  const decemberMeals: Array<{
    userId: string;
    date: Date;
    mealCount: number;
    isLocked: boolean;
  }> = [];

  const decMealCountsByUser: Record<string, number[]> = {
    [rahim.id]: [1,1,1,1,0,1,1, 1,1,1,0,1,1,1, 1,0,1,1],
    [karim.id]: [1,1,0,1,1,1,1, 0,1,1,1,1,1,0, 1,1,1,1],
    [jamal.id]: [1,1,1,1,1,0,1, 1,1,0,1,1,1,1, 0,1,1,1],
    [nadia.id]: [1,0,1,1,1,1,1, 1,1,1,1,0,1,1, 1,1,0,1],
  };

  for (const user of allUsers) {
    const counts = decMealCountsByUser[user.id] ?? [];
    for (let day = 1; day <= 18; day++) {
      const mealCount = counts[day - 1] ?? 1;
      decemberMeals.push({
        userId: user.id,
        date: d(2024, 12, day),
        mealCount,
        isLocked: true, // Days 1-18 are in the past, so locked
      });
    }
  }

  const decMealResult = await db.mealRecord.createMany({
    data: decemberMeals,
    skipDuplicates: true,
  });
  console.log(`✅ December meal records (days 1-18): ${decMealResult.count} created`);

  // ── 10. December 2024 — Bazar expenses ──────────────────────────────────────
  const decBazarData = [
    { day: 2,  buyer: jamal, amount: "1950.00", note: "Weekly groceries" },
    { day: 6,  buyer: nadia, amount: "2200.00", note: "Vegetables and fish" },
    { day: 10, buyer: rahim, amount: "1750.50", note: "Rice and oil" },
    { day: 14, buyer: karim, amount: "2050.00", note: "Groceries" },
  ];

  for (const entry of decBazarData) {
    const existingTrip = await db.bazarTrip.findFirst({
      where: { triggeredById: entry.buyer.id, triggeredAt: dt(2024, 12, entry.day, 9) },
    });
    if (existingTrip) continue;

    const trip = await db.bazarTrip.create({
      data: {
        triggeredById: entry.buyer.id,
        status: BazarTripStatus.completed,
        triggeredAt: dt(2024, 12, entry.day, 9),
        completedAt: dt(2024, 12, entry.day, 11),
      },
    });

    await db.bazarExpense.create({
      data: {
        userId: entry.buyer.id,
        tripId: trip.id,
        amount: new Decimal(entry.amount),
        note: entry.note,
        date: d(2024, 12, entry.day),
        submittedAt: dt(2024, 12, entry.day, 11),
      },
    });
  }
  console.log("✅ December bazar trips and expenses created");

  // ── 11. December 2024 — Maid charges ────────────────────────────────────────
  const decMonth = d(2024, 12, 1);
  for (const user of allUsers) {
    await db.maidCharge.upsert({
      where: { userId_month: { userId: user.id, month: decMonth } },
      update: {},
      create: {
        userId: user.id,
        amount: new Decimal("700"),
        month: decMonth,
        appliedAt: dt(2024, 12, 1, 10),
      },
    });
  }
  console.log("✅ December maid charges created");

  // ── 12. December 2024 — Active bulk cycle ────────────────────────────────────
  // A new gas cylinder bought in December — currently active.
  // This lets you test the "finish a cycle" feature.
  const existingActiveCycle = await db.bulkCycle.findFirst({
    where: { bulkItemId: gasCylinder.id, status: BulkCycleStatus.active },
  });
  if (!existingActiveCycle) {
    await db.bulkCycle.create({
      data: {
        bulkItemId: gasCylinder.id,
        purchasedById: nadia.id,
        cost: new Decimal("1400"),
        purchaseDate: d(2024, 12, 1),
        status: BulkCycleStatus.active,
        startedAt: dt(2024, 11, 20, 14), // Starts exactly when the previous one finished
      },
    });
    console.log("✅ Active bulk cycle (gas cylinder) created");
  } else {
    console.log("⏭️  Active bulk cycle already exists — skipping");
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete. Here's what you have:\n");
  console.log("  Users:");
  console.log("    a.a.y.tonmoy@gmail.com  — Admin (you)");
  console.log("    karim@example.com       — Member");
  console.log("    jamal@example.com       — Member");
  console.log("    nadia@example.com       — Member");
  console.log("\n  November 2024 (previous month):");
  console.log("    - Full month of locked meal records");
  console.log("    - 8 completed bazar trips with expenses");
  console.log("    - Maid charges (700 each) + Rahim paid 2800 total");
  console.log("    - Finished gas cylinder bulk cycle with allocations");
  console.log("    - Fridge bill (2400 total, 600 per member) + Rahim paid");
  console.log("\n  December 2024 (current month):");
  console.log("    - Days 1-18 locked meal records");
  console.log("    - 4 completed bazar trips with expenses");
  console.log("    - Maid charges applied");
  console.log("    - Active gas cylinder bulk cycle (ready to finish)");
  console.log("\n  To reset and re-seed: npm run db:reset");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
