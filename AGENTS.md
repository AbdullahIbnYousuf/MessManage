# agents.md — AI Agent Instructions

# Household Meal & Expense Management System

## ⚠️ Mobile First — Non-Negotiable

This app is used **primarily on mobile phones**. Every UI decision must start from mobile.

- Design for **390px width first**. Desktop is secondary.
- Touch targets must be large enough to tap comfortably (minimum 44px height for buttons and inputs).
- No horizontal scrolling. No tiny text. No cramped layouts.
- Prefer vertical stacking over side-by-side columns on small screens.
- Forms must be easy to fill out with one thumb.
- If something looks good on desktop but awkward on mobile, fix it for mobile.

This is the **first constraint** to apply before writing any component or layout code.

### Mobile UI Best Practices

**Calendar and Grid Layouts:**

- Use CSS Grid with `repeat(7, 1fr)` for calendar layouts — never use fixed widths
- Remove `overflowX: auto` wrappers that cause horizontal scrolling
- Ensure all content fits within viewport width without scrolling

**Buttons and Interactive Elements:**

- Stack buttons vertically instead of horizontally when space is tight
- Use full-width or near-full-width buttons in mobile layouts
- Minimum button height: 44px (Apple's recommended touch target size)
- Add `touchAction: manipulation` and `WebkitTapHighlightColor: transparent` for better mobile UX
- Increase font size in buttons to at least 0.875rem (14px) for readability

**Text and Instructions:**

- Use "Tap" instead of "Click" in mobile-first interfaces
- Keep instructions concise and visible without scrolling
- Use responsive font sizes (0.875rem for body, 1.75rem for h1)

**Spacing and Layout:**

- Use flexible gaps (0.75rem, 1rem) that adapt to screen size
- Add `flexWrap: wrap` to prevent content from overflowing
- Use `minHeight` instead of fixed heights for dynamic content
- Reduce gaps between grid items on mobile (3px instead of 4px+)

**Information Display:**

- Replace redundant visual indicators with useful contextual information
- Show dynamic status (e.g., "Locks today at 10:00 PM" instead of "■ Today")
- Use day names and times for better user context

---

## Source of Truth — Read These First

@System1DataModel.md

Read both documents completely before writing any code or answering any question.
They are the single source of truth for what this system does and how it is modelled.
Do not ask the developer to repeat information that is already in them.

---

## What This System Is

A household meal and expense management web application for a single group of fewer than 10
members. It replaces a manual spreadsheet. It handles real money. Accuracy is non-negotiable.

The system is built in two phases:

- **System 1** (current) — meal tracking, bazar expenses, maid charges, bulk items, fridge bills, settlement
- **System 2** (future) — debt management and money transfers between members

AI features (shopping assistant, anomaly detection, data analyst) come after System 2.

Do not build System 2 or AI features now. Do design every decision so they can be added
without restructuring what exists.

### System 1 Features (Implemented)

**Core Features:**

- ✅ User authentication (Google OAuth via Auth.js)
- ✅ Membership request system (pending/approved/rejected workflow)
- ✅ Member profiles with contact and banking information
- ✅ Admin panel for system settings and member management

**Meal Management:**

- ✅ Daily meal records with configurable deadline
- ✅ Meal patterns (weekly schedule)
- ✅ Meal edit requests (after deadline, requires admin approval)
- ✅ Admin-managed member meal calendars with protected historical corrections
- ✅ Automatic meal locking at midnight
- ✅ Admin ability to cancel today's meals for all members
- ✅ Meal rate calculation (total bazar ÷ total meals)

**Bazar (Market Shopping):**

- ✅ Bazar trip system (open/completed workflow)
- ✅ Shopping notes (shared list for active trip)
- ✅ Bazar expense recording with backdating support
- ✅ Visit count tracking per member
- ✅ Expense history and aggregates

**Bulk Items:**

- ✅ Bulk item management (rice, oil, etc.)
- ✅ Bulk cycle tracking (active/finished)
- ✅ Automatic allocation when cycle closes
- ✅ Cost split based on meal count during cycle period

**Maid Charges:**

- ✅ Monthly maid charge system (flat fee per member)
- ✅ Maid payment recording (who paid on behalf of group)
- ✅ Automatic charge application on 1st of month (cron job)
- ✅ Admin ability to reset current month charges

**Fridge Bills:**

- ✅ Monthly electricity bill tracking with meter readings
- ✅ Automatic per-member calculation
- ✅ Fridge payment recording (who paid the bill)
- ✅ Unit price configuration in system settings

**Settlement:**

- ✅ Monthly settlement algorithm (greedy matching)
- ✅ Automatic settlement on 1st of month (cron job)
- ✅ Settlement history and monthly reports
- ✅ Balance calculation with detailed breakdown
- ✅ Member-specific transaction history

**Dashboard:**

- ✅ Today's meal count overview
- ✅ Current balance display
- ✅ Quick access to all features

**Background Jobs:**

- ✅ Midnight lock (locks yesterday's meals, expires edit requests)
- ✅ Auto maid charges (applies charges on 1st of month)
- ✅ Auto settle (runs settlement on 1st of month)

---

## Tech Stack — Exact Versions

| Layer       | Choice                   | Notes                                        |
| ----------- | ------------------------ | -------------------------------------------- |
| Framework   | Next.js 15 (App Router)  | Frontend AND backend in one app              |
| Language    | TypeScript — strict mode | Every file. No exceptions.                   |
| Styling     | Tailwind CSS             | Utility classes only                         |
| Components  | shadcn/ui                | Use these before writing custom components   |
| Database    | PostgreSQL               | Hosted on Neon — free tier                   |
| ORM         | Prisma                   | Only way to touch the database               |
| Auth        | Auth.js v5 (NextAuth)    | Google OAuth only                            |
| Real-time   | Server-Sent Events (SSE) | Infrastructure exists, not fully implemented |
| Cron jobs   | Vercel Cron Jobs         | Configured in vercel.json                    |
| AI (future) | Anthropic TypeScript SDK | Not built yet — design for it                |
| Testing     | Vitest                   | Business logic and formulas only             |
| Hosting     | Vercel                   | Free tier                                    |

<!-- BEGIN:nextjs-agent-rules -->

# This is Next.js 15 App Router

This uses the App Router — NOT the Pages Router. They are fundamentally different.

- Data fetching is done in Server Components by default
- API endpoints live in `app/api/[route]/route.ts` using the Web Request/Response API
- There is no `getServerSideProps`, no `getStaticProps`, no `pages/` directory
- Server Actions exist — use them for form mutations where appropriate
- `use client` directive is required for any component that uses hooks or browser APIs
Read `node_modules/next/dist/docs/` before writing any Next.js code.
Heed all deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Project File Structure

Follow this structure exactly. Do not invent new top-level folders.

```
/
├── app/                          ← Next.js App Router
│   ├── api/                      ← All API route handlers
│   │   ├── auth/                 ← Auth.js routes (do not modify)
│   │   ├── meals/                ← Meal records, patterns, edit requests, cancel-today
│   │   ├── bazar/                ← Bazar trips, expenses, shopping notes, history
│   │   ├── bulk-items/           ← Bulk items and cycles
│   │   ├── maid/                 ← Maid charges and payments
│   │   ├── fridge/               ← Fridge bills and payments
│   │   ├── settlement/           ← Settlement run, balance, history, monthly reports
│   │   ├── admin/                ← Admin-only endpoints (settings, members, membership, meal-edit-requests)
│   │   ├── members/              ← Member profiles and aggregates
│   │   ├── dashboard/            ← Dashboard data endpoint
│   │   └── cron/                 ← Vercel cron job endpoints (midnight-lock, auto-maid-charges, auto-settle)
│   ├── (auth)/                   ← Login, pending-approval, rejected, deactivated pages
│   ├── dashboard/
│   ├── meals/
│   ├── bazar/
│   ├── bulk-items/
│   ├── maid/
│   ├── fridge/
│   ├── settlement/
│   ├── admin/
│   ├── members/
│   ├── profile/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
│
├── lib/                          ← All shared logic — nothing goes here that belongs elsewhere
│   ├── db.ts                     ← Prisma client singleton — import from here everywhere
│   ├── auth.ts                   ← Auth.js configuration
│   ├── session.ts                ← Session helpers and type-safe user extraction
│   │
│   ├── domain/                   ← Pure business logic — no HTTP, no database calls
│   │   ├── meal.ts               ← Meal rate formula, locking logic, pattern application
│   │   ├── bazar.ts              ← Visit count logic, suggestion logic, backdating rules
│   │   ├── bulk.ts               ← Bulk cycle allocation formula
│   │   ├── maid.ts               ← Maid charge and payment logic
│   │   ├── fridge.ts             ← Fridge bill calculation and payment logic
│   │   └── settlement.ts         ← Smart settlement algorithm
│   │
│   └── utils/
│       ├── decimal.ts            ← Decimal arithmetic helpers — all money math lives here
│       └── dates.ts              ← Date helpers, month boundaries, deadline checks
│
├── components/
│   ├── ui/                       ← shadcn/ui generated components — do not modify manually
│   ├── Sidebar.tsx               ← Main navigation sidebar
│   └── domain/                   ← Feature-specific components
│       ├── meal/                 ← MealCalendar, MealsClient, PatternEditor
│       ├── bazar/                ← BazarClient, TripCard, ExpenseForm, ShoppingNotes
│       ├── bulk/                 ← BulkItemsClient, CycleCard
│       ├── maid/                 ← MaidClient, ChargeCard, PaymentForm
│       ├── fridge/               ← FridgeClient, BillRow, PaymentForm
│       ├── settlement/           ← SettlementClient, MonthlyReportClient
│       ├── dashboard/            ← DashboardClient, MealCountCard
│       ├── admin/                ← SystemSettingsClient, MemberManagementClient, MembershipRequestsClient
│       └── members/              ← MemberProfileClient, MemberCard
│
├── prisma/
│   ├── schema.prisma             ← Single source of truth for database schema
│   ├── migrations/               ← Never edit migration files manually
│   │                               Exception: SystemConfig seed INSERT (see Database Seeding)
│   └── seed.ts                   ← Database seeding script
│
├── types/
│   ├── index.ts                  ← Shared TypeScript types and enums
│   └── next-auth.d.ts            ← NextAuth type extensions
│
├── __tests__/                    ← Vitest test files (if implemented)
│   └── domain/                   ← Tests for lib/domain/* only
│
├── public/                       ← Static assets
│   └── logo.png
│
├── vercel.json                   ← Cron job configuration
├── AGENTS.md                     ← This file
├── System1DataModel.md           ← Complete data model documentation
├── ProjectRequirements.md        ← Project requirements
├── README.md                     ← Project readme
├── vitest.config.ts              ← Vitest configuration
└── seed_admin.ts                 ← Admin user seeding script
```

---

## Architecture Rules

### The Three-Layer Rule

Every feature follows this exact path. No shortcuts.

```
HTTP Request
    ↓
app/api/[route]/route.ts       ← Validate input, check auth, call domain
    ↓
lib/domain/[feature].ts        ← Pure business logic, no database access
    ↓
lib/db.ts (Prisma)             ← All database operations
    ↓
HTTP Response
```

**Business logic must never live in route handlers.**
**Database calls must never live in domain files.**
**Components must never call the database directly.**

### Prisma Client Singleton

Always import Prisma from `lib/db.ts`. Never instantiate `new PrismaClient()` anywhere else.
Multiple instances cause connection pool exhaustion in serverless environments.

```typescript
// lib/db.ts — the only place PrismaClient is created
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma || new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

### Server Components vs Client Components

- Default to Server Components — they run on the server and can fetch data directly
- Add `'use client'` only when the component needs: `useState`, `useEffect`, event handlers, browser APIs
- Never fetch data in a Client Component if a Server Component can do it instead
- SSE connections are always Client Components (they use browser EventSource API)

---

## Database and Prisma Rules

### Schema Conventions

- All primary keys: `String @id @default(uuid())`
- All monetary fields: `Decimal` — using Prisma's Decimal type backed by `decimal.js`
- All dates (no time): `DateTime @db.Date`
- All timestamps (with timezone): `DateTime`
- Month references: always the first day of the month e.g. `2024-11-01`
- Month boundaries are always the first and last day of the calendar month, aligned with
  `MaidCharge.month` and `MonthlySettlement.month`
- Enums: define in Prisma schema, not as TypeScript string unions

### MealEditRequest Status Enum

MealEditRequest has four statuses — not three:

```prisma
enum MealEditRequestStatus {
  pending
  approved
  rejected
  expired    ← set automatically by the midnight cron job, never set manually
}
```

`expired` means the request was still pending when midnight arrived and the linked
MealRecord was permanently locked. The cron job sets this automatically. No user or admin
action triggers it. No code path should ever set status = expired except the midnight cron job.

### Migrations

- Every schema change must produce a migration file: `npx prisma migrate dev --name describe-the-change`
- Never edit an existing migration file
- Exception: the SystemConfig seed INSERT described below is added once to the initial migration
- Never use `prisma db push` in production — only `prisma migrate deploy`
- After any schema change, run `npx prisma generate` to update the client types

### Database Seeding — SystemConfig

SystemConfig must always contain exactly one row. This row is created automatically via a
raw SQL INSERT appended to the bottom of the initial SystemConfig migration file.

```sql
-- Added to the bottom of the migration that creates the SystemConfig table
INSERT INTO "SystemConfig" ("id", "mealDeadline", "maidChargeDefault", "electricityUnitPrice", "updatedAt")
VALUES (gen_random_uuid(), '22:00', 700, 8, NOW())
ON CONFLICT DO NOTHING;
```

`ON CONFLICT DO NOTHING` makes this safe to run multiple times — if the row already exists,
nothing happens. This runs automatically on every `prisma migrate deploy` with no manual step.

Default values:

- `mealDeadline`: `22:00` (10 PM)
- `maidChargeDefault`: `700` (taka per member per month)
- `electricityUnitPrice`: `8` (taka per kWh for fridge electricity bills)
- `activeTripId`: null (no active trip on first deploy)

### Partial Unique Index — BazarTrip

Only one BazarTrip with `status = open` may exist at any time. This is enforced at the
database level using a partial unique index. Prisma does not support partial indexes natively
in the schema file — it requires raw SQL added to the migration.

Add this to the migration that creates the BazarTrip table:

```sql
CREATE UNIQUE INDEX "unique_open_bazar_trip"
ON "BazarTrip" ("status")
WHERE "status" = 'open';
```

This index makes it physically impossible for two open trips to exist simultaneously,
regardless of application logic.

### Transactions

Use Prisma transactions for any operation that writes to more than one table.
If any part fails, nothing should persist.

```typescript
// Example: bulk cycle close — must be atomic
await db.$transaction([
  db.bulkCycle.update({
    where: { id: cycleId },
    data: { status: "finished", finishedAt: now, finishedById: userId },
  }),
  db.bulkAllocation.createMany({ data: allocationRows }),
]);
```

Operations that MUST use transactions:

- Marking a BulkCycle as finished (updates cycle + creates BulkAllocation rows)
- Completing a BazarTrip (updates trip status + clears shopping notes + updates SystemConfig.activeTripId)
- Running month-end settlement (creates all MonthlySettlement rows atomically)
- Approving a MembershipRequest (creates User row + updates MembershipRequest.userId)
- Midnight meal lock job (locks MealRecord rows + expires pending MealEditRequests)
- Deactivating a member (updates User.status + User.deactivatedAt + sets meal_count = 0 on all future MealRecord rows from tomorrow onwards)
- Posting a FridgeBill (creates FridgeBill row + may trigger related operations)
- Auto-applying maid charges (creates multiple MaidCharge rows for all active members)

---

## Financial Accuracy — Hard Rules

These rules are not negotiable. Breaking them corrupts real money calculations.

### Rule 1 — Never use JavaScript `number` for money

`number` in JavaScript is a floating point type. It cannot represent decimal values exactly.
`0.1 + 0.2 === 0.30000000000000004` — this is not acceptable in a financial system.

```typescript
// WRONG — never do this
const amount: number = 700.5;
const total = amount * 5; // floating point error

// CORRECT — always do this
import Decimal from "decimal.js";
const amount = new Decimal("700.50");
const total = amount.mul(5); // exact
```

All monetary values from the database come back as Prisma `Decimal` objects automatically.
Keep them as `Decimal` throughout all calculations. Only convert to string for display.

### Rule 2 — Never store a derived value as a database field

The following are ALWAYS computed at query time. They must never be columns in any table.

- User running balance
- Bazar visit count per user
- Bazar spending total per user
- Meal rate for a month
- Current month total meals
- Current month total bazar spending

Computing them live from transaction records is the design. It is not a performance concern
for fewer than 10 users.

### Rule 3 — The meal rate formula is exact

```
Meal Rate = Total BazarExpense.amount for the month ÷ Total MealRecord.meal_count for the month
```

- Maid charges do NOT enter this formula
- MaidPayment amounts do NOT enter this formula
- BulkCycle costs do NOT enter this formula
- Bulk purchases recorded in BulkCycle are NEVER in BazarExpense

### Rule 4 — The bulk allocation formula is exact

```
Cost per meal = BulkCycle.cost ÷ sum of all MealRecord.meal_count during cycle period
User allocation = Cost per meal × user's MealRecord.meal_count during cycle period
```

- Allocation is calculated once, at the moment a cycle closes
- It is stored as a snapshot in BulkAllocation.amount
- It is never recalculated after that point
- This is safe because all MealRecord rows within a closed cycle are permanently locked

### Rule 5 — The net balance formula is exact

```
Net Balance =
  sum(BazarExpense.amount for user)
  + sum(MaidPayment.amount for user)
  + sum(FridgePayment.amount for user)
  + sum(BulkPayment.amount for user)
  - sum(MealRecord.meal_count × meal rate for that month)
  - sum(MaidCharge.amount for user)
  - sum(FridgeBill.per_member_amount for user)
  - sum(BulkAllocation.amount for user)
```

Positive = member is owed money. Negative = member owes money.

### Rule 6 — Settlement algorithm is exact (greedy matching)

```
1. Compute net balance for every member
2. Separate into creditors (positive) and debtors (negative)
3. Sort both lists largest-first by absolute value
4. Match largest debtor with largest creditor
5. Transfer = min(abs(debtor balance), creditor balance)
6. Reduce both by transfer amount
7. Remove any member whose balance reaches zero
8. Repeat from step 3 until all balances are zero
9. Each transfer becomes one MonthlySettlement row
```

---

## Business Rules the Agent Must Never Get Wrong

Read System1DataModel.md for full system 1 data model.
These are the rules most likely to be broken by a code agent.

### Meal Rules

- Future individual meal records (tomorrow onwards) can be edited directly without changing the global pattern.
- Today's meal record can be edited directly before the admin-configurable `mealDeadline`.
- After the deadline passes, today's meal can only be edited by submitting a `MealEditRequest`, which requires Admin approval.
- After midnight, `is_locked = true` permanently for member access. Admin corrections may update only `meal_count` without unlocking the row, and only when the month is unsettled and no finished bulk cycle covers the date.
- A `MealEditRequest` always references today's record only — never a past or future day.
- Pending `MealEditRequests` auto-expire at midnight — the cron job sets their status to `expired`.
- When a `MealPattern` changes, auto-update all future `MealRecord` rows from today onwards for the current month. Past records are never touched.
- There is exactly one `MealPattern` per user, updated in place. No history is kept.
- A deactivated user's future `MealRecords` (from tomorrow onwards) are set to meal_count = 0.

### Bazar Rules

- Only one BazarTrip with status = open may exist at any time. Enforced via partial unique
  index (see Database section above).
- A member cannot submit a BazarExpense for another member. user_id must always equal the
  authenticated user's id.
- Being assigned to a trip never increments visit count. Only submitting a BazarExpense does.
- A zero-amount BazarExpense is valid. It still closes the trip and increments the visit count.
- BazarExpense.date can be backdated within the current calendar month. Prior month backdating
  is blocked — the date is forced to today.
- shopping_notes is cleared in the same transaction that marks the trip as completed.
- SystemConfig.activeTripId is updated in the same transaction that opens or closes a trip.

### Bulk Item Rules

- BulkCycle cost is NEVER recorded as a BazarExpense. It goes into BulkCycle.cost only.
- Only one BulkCycle with status = active may exist per BulkItem at any time.
- A new cycle's started_at is system-set to the exact moment the previous cycle was marked
  finished — not user-input.
- For the very first cycle of an item, started_at is set to the moment the record is created.
- BulkAllocation rows are created immediately when a cycle closes — not at month end.
- Deactivated members who had meals during the cycle period still receive a BulkAllocation row.
- BulkAllocation rows are permanent snapshots. Never recalculate or delete them.

### Maid Rules

- MaidCharge is a flat fee per active member per month. It does not depend on meal count.
- MaidPayment is separate from BazarExpense and must never affect the meal rate.
- Changing SystemConfig.maidChargeDefault does not automatically affect already-posted MaidCharge rows. Admins must use the "Reset Current Month Charges" action to delete and reapply charges for the current month based on the new rate.
- Deactivated members do not receive a MaidCharge for months where they are fully deactivated.

### Fridge Bill Rules

- FridgeBill.month refers to the previous month being settled — not the current month
- Meter readings (previousReading, currentReading) are stored for record-keeping
- totalAmount is calculated at posting time: (currentReading - previousReading) × unitPrice
- per_member_amount is calculated at posting time: totalAmount ÷ count of all members
  who were active at any point during the bill month
- Deactivated members are included if they were active during the bill month — identical
  behaviour to BulkAllocation
- per_member_amount is a frozen snapshot — never recalculated after posting
- Only one FridgeBill per month. Block duplicates at the application layer.
- FridgePayment mirrors MaidPayment exactly — payer gets credit, all members carry their debit
- FridgeBill never enters the meal rate formula
- SystemConfig.electricityUnitPrice is the default unit price, but can be overridden per bill

### Settlement Rules

- A month can only be settled once. Block duplicate settlement at the application layer.
- MonthlySettlement rows are permanent. Never recalculate or delete them.
- After settlement, System 1 balance effectively resets for the next month because the
  underlying transaction records for the past month are frozen.
- Settlement output feeds into System 2 as debt entries (design for this handoff —
  do not build System 2 yet).

### Membership Rules

- A User row is created ONLY when a MembershipRequest is approved by an admin. Not at sign-up.
- On Google sign-in: check for existing User row. If none exists, create a MembershipRequest
  and show a waiting screen.
- Rejected MembershipRequests are kept permanently. Never delete them.
- A member's account stays active until all balances are settled. Admin deactivates after
  full resolution.
- Multiple admins are allowed. Any admin can perform any admin action.

---

## Authentication and Session Rules

### Flow

```
Google OAuth sign-in
    ↓
Auth.js callback
    ↓
Check: does a User row exist for this email?
    ├── Yes, active → create session, allow access
    ├── Yes, deactivated → show deactivated message, no access
    ├── No User, but MembershipRequest exists (pending) → show pending-approval screen
    ├── No User, but MembershipRequest exists (rejected) → show rejected screen
    └── No User, no request → create MembershipRequest (pending), show pending-approval screen
```

### Session Shape

The session must include the user's id, email, name, role, and status from the User table.
Do not rely on the OAuth profile alone — always cross-reference with the database User row.

```typescript
// types/index.ts
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  nickname: string | null;
  avatarUrl: string | null;
  role: "member" | "admin";
  status: "active" | "deactivated";
};
```

### Protecting Routes and API Endpoints

Every API route must validate the session before doing anything else.
Admin-only actions must check `session.user.role === 'admin'` explicitly.
Never trust role information from the request body or query params.

```typescript
// Pattern for every API route handler
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user)
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  if (session.user.status === "deactivated")
    return Response.json({ error: "Account deactivated" }, { status: 403 });

  // Admin check where required
  if (session.user.role !== "admin")
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // proceed
}
```

---

## Real-Time Updates

### Current Implementation

Real-time updates are currently handled via client-side polling and manual page refreshes.
The infrastructure for Server-Sent Events (SSE) exists in `lib/utils/sse.ts` but is not
yet fully implemented.

### Planned SSE Implementation

SSE will be used for one-directional server-to-browser updates. Do not use WebSockets.

#### What should get pushed via SSE (when implemented)

- Meal count changes on the dashboard (so the maid's view updates live)
- Bazar trip status changes (trip opened, trip completed)
- Shopping notes changes (any member editing the notes)
- Balance changes after any transaction

#### SSE Pattern (for future implementation)

```typescript
// app/api/sse/route.ts
export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      // attach listeners, send initial state, clean up on close
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

---

## Background Jobs (Vercel Cron)

### vercel.json structure

```json
{
  "crons": [
    {
      "path": "/api/cron/midnight-lock",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/auto-maid-charges",
      "schedule": "0 0 28 * *"
    },
    {
      "path": "/api/cron/auto-settle",
      "schedule": "0 0 5 * *"
    }
  ]
}
```

Three cron jobs are configured:

1. **Midnight Lock** (daily at 00:00 UTC) — locks yesterday's meals and expires pending edit requests
2. **Auto Maid Charges** (monthly at 00:00 UTC on the 28th) — applies maid charges for the current month (gives members notice before month-end)
3. **Auto Settle** (monthly at 00:00 UTC on the 5th) — runs settlement for the previous month (allows buffer for late entries)

### Cron Endpoint Authentication

Vercel sends an `Authorization` header with every cron request. Your endpoint must validate
it before doing anything else.

```typescript
// app/api/cron/midnight-lock/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }
  // proceed with the job
}
```

`CRON_SECRET` is set in your Vercel environment variables and also in `.env.local`.
Vercel automatically injects it into cron requests as: `Authorization: Bearer <CRON_SECRET>`
You do not send this header manually — Vercel sends it on every scheduled execution.

### Midnight Lock Job — Critical

This job runs at midnight every day. It is a hard, irreversible operation.

```
1. Find all MealRecord rows where date = yesterday AND is_locked = false
2. Set is_locked = true on all of them
3. Find all MealEditRequest rows where status = 'pending'
   AND their linked MealRecord.date = yesterday
4. Set status = 'expired' on all of them
5. All of the above in a single Prisma transaction
```

This job must be idempotent — running it twice must produce the same result as running
it once. Locking an already-locked record or expiring an already-expired request must
not cause an error.

### Auto Maid Charges Job

This job runs at 01:00 on the 1st of every month. It automatically applies maid charges
for the new month to all active members.

```
1. Get the current month (first day of the month)
2. Get SystemConfig.maidChargeDefault
3. Find all active users (status = 'active')
4. For each active user, create a MaidCharge row with:
   - userId = user.id
   - amount = maidChargeDefault
   - month = current month (first day)
   - appliedAt = now
5. Use a transaction to create all charges atomically
6. Skip users who already have a charge for this month (idempotent)
```

### Auto Settle Job

This job runs at 02:00 on the 1st of every month. It automatically runs settlement
for the previous month.

```
1. Get the previous month (first day of last month)
2. Check if settlement already exists for this month
3. If not, run the settlement algorithm (see Settlement Rules)
4. Create MonthlySettlement rows for all transfers
5. All in a single transaction
```

---

## TypeScript Rules

### Strict Mode

`tsconfig.json` must have:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

### No `any`

Never use `any`. If the type is genuinely unknown, use `unknown` and narrow it.

### Decimal Imports

```typescript
import Decimal from "decimal.js";
```

Use this for all arithmetic involving money. Never use native `+`, `-`, `*`, `/` operators
on monetary values.

### Null Safety

The database has many nullable fields (all the contact fields, avatarUrl, etc.).
Always handle nulls explicitly. Do not assume a nullable field has a value.

### Enums

Define enums in `prisma/schema.prisma` and let Prisma generate the TypeScript types.
Do not duplicate them as TypeScript enums or string unions.

---

## Error Handling

### API Routes

All API routes return consistent error shapes:

```typescript
// Success
Response.json({ data: result }, { status: 200 });

// Client error (bad input, rule violation)
Response.json(
  { error: "Human-readable message explaining what went wrong" },
  { status: 400 },
);

// Auth error
Response.json({ error: "Unauthorised" }, { status: 401 });

// Permission error
Response.json({ error: "Forbidden" }, { status: 403 });

// Server error
Response.json(
  { error: "Something went wrong. Please try again." },
  { status: 500 },
);
```

### Business Rule Violations

Return 400 with a clear message. Examples:

- `'Meal records can only be edited on the same day'`
- `'A bazar trip is already open'`
- `'Backdating to a prior month is not allowed'`
- `'This month has already been settled'`

Never return a raw Prisma error or stack trace to the client.

---

## What the Agent Must Never Do

These are hard stops. Do not do any of these under any circumstances.

```
NEVER use float or number type for any monetary value
NEVER store a running balance as a database column
NEVER blend BulkCycle cost into a BazarExpense record
NEVER blend MaidPayment into BazarExpense
NEVER allow a member to edit a MealRecord for any day other than today
NEVER allow a past day's MealRecord to be unlocked under any condition
NEVER allow an admin meal correction in a settled month or for a date covered by a finished BulkCycle
NEVER allow two BazarTrips with status = open simultaneously
NEVER allow two BulkCycles with status = active for the same BulkItem simultaneously
NEVER allow backdating a BazarExpense into a prior calendar month
NEVER allow a member to submit a BazarExpense on behalf of another member
NEVER recalculate a BulkAllocation after it has been posted
NEVER run month-end settlement twice for the same month
NEVER delete a MembershipRequest, MealRecord, BazarExpense, BulkAllocation, or MonthlySettlement
NEVER set MealEditRequest.status = expired from any code path except the midnight cron job
NEVER expose the Anthropic API key to the client (browser)
NEVER instantiate PrismaClient outside of lib/db.ts
NEVER write business logic inside a route handler
NEVER write database calls inside a domain function
NEVER use the Pages Router — this project uses the App Router only
NEVER use getServerSideProps or getStaticProps — they do not exist in App Router
NEVER recalculate FridgeBill.per_member_amount after it has been posted
NEVER recalculate FridgeBill.totalAmount after it has been posted
NEVER post a FridgeBill for the current or a future month
NEVER allow more than one FridgeBill per month
NEVER blend FridgeBill cost into the meal rate formula
NEVER create horizontal scrolling on mobile — all layouts must fit within 390px width
NEVER use touch targets smaller than 44px height for buttons and interactive elements
NEVER ignore mobile-first design principles — mobile is the primary platform
```

---

## What to Design For (But Not Build Yet)

### System 2 — Money Management

The User entity already has the contact and banking fields for System 2.
When writing any code that touches User data, do not strip or ignore those fields.
The monthly settlement output (MonthlySettlement rows) must be structured so they can be
exported to System 2 as debt entries later. Keep this handoff clean.

### AI Features

The three planned features are: smart bazar shopping assistant, anomaly detection (stage 2),
and AI data analyst. All will call the Anthropic Claude API from Next.js API routes via a
dedicated service layer in `lib/ai/`.

The rule-based anomaly detection (stage 1) should be built inside System 1 — no AI needed.
Flag these anomalies:

- Any BazarExpense more than 2× the user's personal monthly average
- Any member with 0 meals for more than 5 consecutive days
- Any BulkCycle closing significantly faster than the historical average for that item
- Any member with 0 bazar contributions for 2+ consecutive months

When the AI features are eventually built:

- All Claude API calls go through a service layer in `lib/ai/`
- The API key lives in environment variables only — never hardcoded
- AI responses about money must always include a disclaimer linking to raw data

---

## Environment Variables

```bash
# .env.local

# Database
DATABASE_URL=""              # Neon PostgreSQL connection string

# Auth.js
NEXTAUTH_SECRET=""           # Random secret for session encryption
NEXTAUTH_URL=""              # Your deployment URL e.g. https://yourapp.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Vercel Cron Security
CRON_SECRET=""               # Random secret — Vercel injects this into cron requests
                             # Vercel sends it as: Authorization: Bearer <CRON_SECRET>

# AI — not needed until AI features are built
ANTHROPIC_API_KEY=""
```

Never commit `.env.local` to the repository.
Always maintain `.env.example` with empty values as a reference.

---

## Testing Rules

Only test business logic in `lib/domain/*`. Do not test route handlers or components
with unit tests. The formulas and algorithms are the highest-risk code in this system.
They must be tested.

### What must have tests

- `lib/domain/settlement.ts` — the greedy matching algorithm with multiple scenarios
- `lib/domain/bulk.ts` — allocation formula with edge cases (member with 0 meals,
  deactivated member)
- `lib/domain/meal.ts` — meal rate formula, pattern application logic
- `lib/utils/decimal.ts` — all arithmetic helpers

### Test file naming

```
__tests__/domain/settlement.test.ts
__tests__/domain/bulk.test.ts
__tests__/domain/meal.test.ts
__tests__/utils/decimal.test.ts
```

### Run tests

```bash
npx vitest run            # single run
npx vitest                # watch mode
```

---

## Developer Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Database: create and apply a migration
npx prisma migrate dev --name your-migration-name

# Database: apply migrations in production
npx prisma migrate deploy

# Database: regenerate Prisma client after schema change
npx prisma generate

# Database: open visual database browser
npx prisma studio

# Type check without compiling
npx tsc --noEmit

# Run tests
npx vitest run

# Lint
npx eslint .
```

---

## Design System

### Color Palette — Warm Charcoal + Muted Terracotta

**Backgrounds:**

- `--color-bg-base`: #1C1714 (warm charcoal, not cold black)
- `--color-bg-surface`: #231E1A
- `--color-bg-elevated`: #2C2520
- `--color-bg-hover`: rgba(210, 120, 60, 0.08)

**Borders:**

- `--color-border`: #3A302A
- `--color-border-subtle`: #302820

**Brand (Muted Terracotta):**

- `--color-primary`: #D4724A
- `--color-primary-dark`: #C0623C
- `--color-primary-light`: #E08860
- `--color-primary-glow`: rgba(212, 114, 74, 0.15)

**Accent (Muted Sage Green):**

- `--color-accent`: #5A9E82

**Semantic Colors (Desaturated):**

- Success: #4E9E6A
- Warning: #C49A3C
- Danger: #C05050
- Locked: #4A4540

**Text (Warm Whites and Tans):**

- `--color-text-primary`: #EDE0D4
- `--color-text-secondary`: #A89080
- `--color-text-muted`: #6A5A50

### Typography

**Font Family:**

- Sans: "Inter", system-ui, sans-serif
- Mono: "JetBrains Mono", monospace

**Font Sizes:**

- Body: 0.875rem (14px)
- Small: 0.75rem (12px)
- Large: 1rem (16px)
- H1: 1.75rem (28px)
- Stat value: 1.625rem (26px)

**Font Weights:**

- Regular: 400
- Semibold: 600
- Bold: 700
- Extra bold: 800

### Spacing

**Base Unit:** 4px (0.25rem)

**Common Gaps:**

- Small: 0.5rem (8px)
- Medium: 0.75rem (12px)
- Large: 1rem (16px)
- Extra large: 1.25rem (20px)

**Padding:**

- Card: 1.125rem (18px)
- Card elevated: 1.25rem (20px)
- Button: 0.5rem 1.125rem
- Input: 0.5625rem 0.875rem

### Border Radius

- Small: 6px
- Medium: 10px
- Large: 14px
- Extra large: 18px
- Full (pills): 9999px

### Components

**Cards:**

- `.card` — standard surface card with border and shadow
- `.card-elevated` — elevated card with stronger shadow
- `.card-hero` — hero card with extra padding
- `.glass` — glassmorphism effect with backdrop blur

**Buttons:**

- `.btn` — base button (pill-shaped, no glow)
- `.btn-primary` — terracotta brand color
- `.btn-secondary` — elevated background with border
- `.btn-danger` — danger red
- `.btn-ghost` — transparent background
- Sizes: `.btn-sm`, `.btn-lg`

**Inputs:**

- `.input` — standard input with focus ring (no glow)

**Badges:**

- `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-primary`, `.badge-muted`

**Layout:**

- `.page-container` — max-width 768px, centered, responsive padding
- `.section-header` — flex header with responsive stacking
- `.layout-wrapper` — main layout container
- `.layout-sidebar` — fixed sidebar (desktop only)
- `.layout-main` — main content area
- `.layout-mobile-nav` — bottom navigation (mobile only)

**Utilities:**

- `.text-primary`, `.text-secondary`, `.text-muted`
- `.text-positive`, `.text-negative`
- `.gradient-text` — warm terracotta to amber gradient
- `.spinner` — loading spinner
- `.skeleton` — warm shimmer loading state
- `.fade-in`, `.slide-up`, `.scale-in` — entrance animations
- `.divider` — horizontal rule

**Tables:**

- `.table-container` — scrollable wrapper
- `.table` — data table with hover states

**Avatars:**

- `.avatar` — circular image
- Sizes: `.avatar-sm` (28px), `.avatar-md` (36px), `.avatar-lg` (48px), `.avatar-xl` (64px)
- `.avatar-fallback` — gradient background for initials

**Stats:**

- `.stat-card` — card for displaying statistics
- `.stat-label` — uppercase label
- `.stat-value` — large tabular number
- `.stat-sub` — subtitle text

### Design Rules

1. **No Pure White or Black** — use warm charcoal (#1C1714) and warm white (#EDE0D4)
2. **No Neon Colors** — all colors are desaturated and muted
3. **No Glows** — use subtle shadows instead of glowing effects
4. **Pill-Shaped Buttons** — use `border-radius: 9999px` for all buttons
5. **Tabular Numbers** — use `font-variant-numeric: tabular-nums` for all monetary values
6. **Max Content Width** — 768px centered for optimal readability
7. **Mobile-First** — design for 390px width first, desktop is secondary
8. **Warm Palette** — terracotta, sage green, warm tans — no cold blues or grays

```

---

*This file is the agent instruction layer.
System1DataModel.md are the domain knowledge layer.
All three files together are what the agent needs to work correctly.*


```
