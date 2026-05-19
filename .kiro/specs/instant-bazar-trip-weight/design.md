# Technical Design Document

## Feature Overview

The instant-bazar-trip-weight feature introduces a two-level trip weight system for bazar expenses, allowing members to differentiate between regular shopping trips (weight 1.0) and quick instant purchases (weight 0.1). This enables more accurate tracking of shopping effort while maintaining the existing expense recording and trip closure workflow.

## Architecture

### System Components

This feature touches four layers of the application:

1. **Database Layer** — Add `trip_weight` column to `BazarExpense` table
2. **Domain Layer** — Add trip weight validation logic to `lib/domain/bazar.ts`
3. **API Layer** — Modify expense submission endpoint to accept and validate trip weight
4. **UI Layer** — Replace single submit button with two-button layout in `ExpenseForm` component

### Data Flow

```
User taps "Regular Bazar" or "Instant Bazar"
    ↓
ExpenseForm sends tripWeight (1.0 or 0.1) to API
    ↓
API validates tripWeight via domain layer
    ↓
Domain layer validates tripWeight ∈ {1.0, 0.1}
    ↓
API creates BazarExpense with trip_weight field
    ↓
Trip closure transaction executes (existing logic)
    ↓
Visit count calculations use SUM(trip_weight) instead of COUNT(*)
```

## Database Schema Changes

### BazarExpense Table Modification

Add a new column to store the trip weight value:

```prisma
model BazarExpense {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id])
  tripId      String    @map("trip_id")
  trip        BazarTrip @relation(fields: [tripId], references: [id])
  amount      Decimal   @db.Decimal(12, 2)
  tripWeight  Decimal   @default(1.0) @map("trip_weight") @db.Decimal(3, 2)
  note        String?
  date        DateTime  @db.Date
  submittedAt DateTime  @map("submitted_at")

  @@map("BazarExpense")
}
```

**Column Specifications:**

- **Name:** `trip_weight`
- **Type:** `Decimal(3, 2)` — supports values from 0.00 to 9.99 with two decimal places
- **Constraint:** `NOT NULL` — every expense must have a trip weight
- **Default:** `1.0` — backward compatibility for existing records and any code that doesn't specify weight

### Migration Strategy

**Migration File:** `add_trip_weight_to_bazar_expense`

```sql
-- Add trip_weight column with default value
ALTER TABLE "BazarExpense"
ADD COLUMN "trip_weight" DECIMAL(3, 2) NOT NULL DEFAULT 1.0;

-- Backfill existing records (redundant due to DEFAULT, but explicit for clarity)
UPDATE "BazarExpense"
SET "trip_weight" = 1.0
WHERE "trip_weight" IS NULL;
```

**Rationale:**

- Default value of 1.0 ensures all existing expenses are treated as regular bazars
- Decimal(3, 2) provides sufficient precision for current weights (1.0, 0.1) and potential future weights
- NOT NULL constraint ensures data integrity — no expense can exist without a weight

## Domain Logic Updates

### Trip Weight Validation

Add validation function to `lib/domain/bazar.ts`:

```typescript
/**
 * Valid trip weight values for bazar expenses.
 * 1.0 = Regular Bazar (full shopping trip)
 * 0.1 = Instant Bazar (quick purchase)
 */
const VALID_TRIP_WEIGHTS = [1.0, 0.1] as const;
export type TripWeight = (typeof VALID_TRIP_WEIGHTS)[number];

/**
 * Validates a trip weight value.
 * Returns an error string or null if valid.
 */
export function validateTripWeight(weight: unknown): string | null {
  if (typeof weight !== "number") {
    return "Trip weight must be a number.";
  }

  if (!VALID_TRIP_WEIGHTS.includes(weight as TripWeight)) {
    return "Invalid trip weight. Must be 1.0 or 0.1.";
  }

  return null;
}

/**
 * Type guard for trip weight values.
 */
export function isTripWeight(value: unknown): value is TripWeight {
  return (
    typeof value === "number" &&
    VALID_TRIP_WEIGHTS.includes(value as TripWeight)
  );
}
```

**Design Decisions:**

- Use const array for valid weights — easy to extend if new weight levels are added
- Separate validation function follows existing pattern in `bazar.ts` (see `validateBazarAmount`)
- Type guard provides type-safe usage in TypeScript code
- Error messages match existing error message style in the codebase

### Visit Count Calculation Update

Update the `suggestAssignees` function signature to work with decimal visit counts:

```typescript
/**
 * Given a list of users with their visit counts (sum of trip weights),
 * returns the two with the lowest visit counts as suggested assignees.
 * In case of tie, the order from the input array is preserved (first-come).
 */
export function suggestAssignees<T extends { id: string; visitCount: number }>(
  members: T[],
): [T | null, T | null] {
  if (members.length === 0) return [null, null];

  const sorted = [...members].sort((a, b) => a.visitCount - b.visitCount);
  return [sorted[0] ?? null, sorted[1] ?? null];
}
```

**Note:** The existing function already works with decimal values since `visitCount` is typed as `number`. No code changes needed — only the calculation of `visitCount` changes at the database query level.

## API Endpoint Modifications

### POST /api/bazar/expense

Update the expense submission endpoint to accept and validate trip weight:

**Request Body Schema:**

```typescript
interface ExpenseSubmissionRequest {
  amount: number | string;
  note?: string;
  date?: string;
  tripWeight: 1.0 | 0.1; // NEW FIELD
}
```

**Updated Handler Logic:**

```typescript
export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = (await request.json()) as {
      amount: number | string;
      note?: string;
      date?: string;
      tripWeight: number; // NEW
    };

    // Validate amount (existing)
    const amountError = validateBazarAmount(body.amount);
    if (amountError) {
      return Response.json({ error: amountError }, { status: 400 });
    }

    // Validate trip weight (NEW)
    const tripWeightError = validateTripWeight(body.tripWeight);
    if (tripWeightError) {
      return Response.json({ error: tripWeightError }, { status: 400 });
    }

    const amount = new Decimal(String(body.amount));
    const tripWeight = new Decimal(String(body.tripWeight)); // NEW
    const requestedDate = body.date ?? getNow().toISOString().slice(0, 10);
    const expenseDate = effectiveBazarDate(requestedDate);

    // Get active trip (existing)
    const config = await db.systemConfig.findFirst();
    if (!config?.activeTripId) {
      return Response.json(
        { error: "No active bazar trip found." },
        { status: 400 },
      );
    }

    const trip = await db.bazarTrip.findUnique({
      where: { id: config.activeTripId },
    });

    if (!trip || trip.status !== "open") {
      return Response.json(
        { error: "No active bazar trip found." },
        { status: 400 },
      );
    }

    // Submit expense + close trip (existing transaction, add tripWeight field)
    await db.$transaction(async (tx) => {
      await tx.bazarExpense.create({
        data: {
          userId: user.id,
          tripId: trip.id,
          amount,
          tripWeight, // NEW
          note: body.note ?? null,
          date: new Date(expenseDate),
          submittedAt: getNow(),
        },
      });

      await tx.bazarTrip.update({
        where: { id: trip.id },
        data: {
          status: "completed",
          completedAt: getNow(),
          shoppingNotes: null,
        },
      });

      await tx.systemConfig.updateMany({
        data: { activeTripId: null },
      });
    });

    return Response.json(
      {
        data: {
          submitted: true,
          date: expenseDate,
          amount: amount.toFixed(2),
          tripWeight: tripWeight.toFixed(1), // NEW
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Response) return err;
    console.error(err);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
```

**Changes:**

1. Add `tripWeight` to request body type
2. Validate `tripWeight` using domain layer function
3. Convert `tripWeight` to Decimal for database storage
4. Include `tripWeight` in expense creation
5. Return `tripWeight` in response for confirmation

### GET /api/bazar/history

Update visit count calculation to use `SUM(trip_weight)`:

**Current Query:**

```typescript
const leaderboard = await db.bazarExpense.groupBy({
  by: ["userId"],
  _count: { id: true },
  orderBy: { _count: { id: "desc" } },
});
```

**Updated Query:**

```typescript
const leaderboard = await db.bazarExpense.groupBy({
  by: ["userId"],
  _sum: { tripWeight: true },
  orderBy: { _sum: { tripWeight: "desc" } },
});
```

**Response Transformation:**

```typescript
const leaderboardData = await Promise.all(
  leaderboard.map(async (entry) => {
    const user = await db.user.findUnique({
      where: { id: entry.userId },
      select: { name: true, avatarUrl: true },
    });
    return {
      userId: entry.userId,
      name: user?.name ?? "Unknown",
      avatarUrl: user?.avatarUrl ?? null,
      visits: entry._sum.tripWeight?.toNumber() ?? 0, // Changed from _count.id
    };
  }),
);
```

### GET /api/members/[id]

Update member profile aggregate to use `SUM(trip_weight)`:

**Current Query:**

```typescript
const bazarStats = await db.bazarExpense.aggregate({
  where: { userId: id },
  _count: { id: true },
  _sum: { amount: true },
});
```

**Updated Query:**

```typescript
const bazarStats = await db.bazarExpense.aggregate({
  where: { userId: id },
  _sum: {
    tripWeight: true,
    amount: true,
  },
});
```

**Response:**

```typescript
{
  bazarVisits: bazarStats._sum.tripWeight?.toNumber() ?? 0,  // Changed from _count.id
  bazarSpending: bazarStats._sum.amount?.toFixed(2) ?? "0.00"
}
```

### POST /api/bazar/trip

Update assignee suggestion to use `SUM(trip_weight)`:

**Current Query:**

```typescript
const members = await db.user.findMany({
  where: { status: "active" },
  select: {
    id: true,
    name: true,
    avatarUrl: true,
    bazarExpenses: {
      select: { id: true },
    },
  },
});

const membersWithCounts = members.map((m) => ({
  id: m.id,
  name: m.name,
  avatarUrl: m.avatarUrl,
  visitCount: m.bazarExpenses.length,
}));
```

**Updated Query:**

```typescript
const members = await db.user.findMany({
  where: { status: "active" },
  select: {
    id: true,
    name: true,
    avatarUrl: true,
    bazarExpenses: {
      select: { tripWeight: true },
    },
  },
});

const membersWithCounts = members.map((m) => ({
  id: m.id,
  name: m.name,
  avatarUrl: m.avatarUrl,
  visitCount: m.bazarExpenses.reduce(
    (sum, exp) => sum + (exp.tripWeight?.toNumber() ?? 0),
    0,
  ),
}));
```

### GET /api/settlement/monthly-report

Update monthly report to use `SUM(trip_weight)`:

**Current Query:**

```typescript
const bazarVisits = await db.bazarExpense.count({
  where: {
    userId: member.id,
    date: { gte: monthStart, lte: monthEnd },
  },
});
```

**Updated Query:**

```typescript
const bazarVisitsSum = await db.bazarExpense.aggregate({
  where: {
    userId: member.id,
    date: { gte: monthStart, lte: monthEnd },
  },
  _sum: { tripWeight: true },
});

const bazarVisits = bazarVisitsSum._sum.tripWeight?.toNumber() ?? 0;
```

## UI Component Changes

### ExpenseForm Component

Replace the single "Check & Submit" button with two submission buttons:

**Current Structure:**

```tsx
<button type="submit" className="btn btn-primary">
  Check & Submit
</button>
```

**New Structure:**

```tsx
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginTop: "0.5rem",
  }}
>
  <button
    type="button"
    className="btn btn-primary"
    onClick={() => handleSubmit(1.0)}
    style={{
      minHeight: "44px",
      width: "100%",
      fontSize: "0.875rem",
    }}
  >
    🛒 Regular Bazar
  </button>

  <button
    type="button"
    className="btn btn-secondary"
    onClick={() => handleSubmit(0.1)}
    style={{
      minHeight: "44px",
      width: "100%",
      fontSize: "0.875rem",
    }}
  >
    ⚡ Instant Bazar
  </button>
</div>
```

**Handler Function:**

```typescript
function handleSubmit(tripWeight: 1.0 | 0.1) {
  if (!amount || parseFloat(amount) < 0) {
    setError("Please enter a valid amount.");
    return;
  }
  setError(null);
  setSelectedTripWeight(tripWeight);
  setConfirming(true);
}
```

**Confirmation Screen Update:**

Add trip weight information to the confirmation screen:

```tsx
<div style={{ marginBottom: "0.5rem" }}>
  <span className="text-secondary" style={{ fontSize: "0.8125rem" }}>
    Trip Type:{" "}
  </span>
  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
    {selectedTripWeight === 1.0 ? "🛒 Regular Bazar" : "⚡ Instant Bazar"}
  </span>
</div>
```

**Submit Function Update:**

```typescript
async function submit() {
  setLoading(true);
  setError(null);

  try {
    const res = await fetch("/api/bazar/expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(amount) || 0,
        note: note.trim() || undefined,
        date,
        tripWeight: selectedTripWeight, // NEW
      }),
    });
    // ... rest of existing logic
  } catch {
    setError("Network error. Please try again.");
  } finally {
    setLoading(false);
  }
}
```

**Mobile-First Design Considerations:**

- Buttons stacked vertically (not side-by-side) for easy thumb access
- Minimum 44px height for comfortable tapping
- Full width buttons to maximize touch target
- Clear visual distinction: Primary button for Regular, Secondary for Instant
- Emoji icons for quick visual recognition
- 0.75rem gap between buttons for accidental tap prevention

### BazarClient Component

Update leaderboard display to show decimal visit counts:

**Current Display:**

```tsx
<span className="badge badge-primary">{entry.visits} trips</span>
```

**Updated Display:**

```tsx
<span
  className="badge badge-primary"
  style={{ fontVariantNumeric: "tabular-nums" }}
>
  {entry.visits.toFixed(1)} trips
</span>
```

**Rationale:**

- `toFixed(1)` ensures consistent one decimal place display
- `fontVariantNumeric: 'tabular-nums'` ensures numbers align vertically in the leaderboard
- No other changes needed — expense history remains unchanged per requirements

## Error Handling

### Validation Errors

**Invalid Trip Weight:**

```json
{
  "error": "Invalid trip weight. Must be 1.0 or 0.1."
}
```

**Missing Trip Weight:**

```json
{
  "error": "Trip weight must be a number."
}
```

**Invalid Amount (existing):**

```json
{
  "error": "Amount must be a non-negative number."
}
```

### Database Errors

**Transaction Failure:**

If any part of the trip closure transaction fails, the entire operation rolls back. No partial state is persisted.

**Migration Failure:**

If the migration fails, the application continues to work with the old schema. The feature cannot be used until the migration succeeds.

## Backward Compatibility

### Existing Data

All existing `BazarExpense` records receive `trip_weight = 1.0` via the migration default value. This ensures:

- Historical visit counts remain accurate
- No recalculation of past data is needed
- Existing reports and aggregates work correctly

### API Compatibility

The API endpoint change is **not backward compatible** — clients must send `tripWeight` in the request body. However, since this is an internal application with no external API consumers, this is acceptable.

**Migration Path:**

1. Deploy database migration
2. Deploy backend API changes
3. Deploy frontend UI changes

All three must be deployed together to avoid runtime errors.

## Testing Strategy

### Unit Tests

**Domain Layer (`lib/domain/bazar.ts`):**

```typescript
describe("validateTripWeight", () => {
  it("accepts 1.0", () => {
    expect(validateTripWeight(1.0)).toBeNull();
  });

  it("accepts 0.1", () => {
    expect(validateTripWeight(0.1)).toBeNull();
  });

  it("rejects 0.5", () => {
    expect(validateTripWeight(0.5)).toBe(
      "Invalid trip weight. Must be 1.0 or 0.1.",
    );
  });

  it("rejects non-numbers", () => {
    expect(validateTripWeight("1.0")).toBe("Trip weight must be a number.");
  });
});
```

**Visit Count Calculation:**

```typescript
describe("suggestAssignees with decimal visit counts", () => {
  it("sorts by decimal visit count ascending", () => {
    const members = [
      { id: "a", visitCount: 3.5 },
      { id: "b", visitCount: 2.1 },
      { id: "c", visitCount: 4.0 },
    ];
    const [first, second] = suggestAssignees(members);
    expect(first?.id).toBe("b");
    expect(second?.id).toBe("a");
  });
});
```

### Integration Tests

**Expense Submission:**

```typescript
describe("POST /api/bazar/expense", () => {
  it("creates expense with trip weight 1.0", async () => {
    const response = await fetch("/api/bazar/expense", {
      method: "POST",
      body: JSON.stringify({
        amount: 500,
        tripWeight: 1.0,
      }),
    });
    expect(response.status).toBe(201);

    const expense = await db.bazarExpense.findFirst({
      orderBy: { submittedAt: "desc" },
    });
    expect(expense?.tripWeight.toNumber()).toBe(1.0);
  });

  it("creates expense with trip weight 0.1", async () => {
    const response = await fetch("/api/bazar/expense", {
      method: "POST",
      body: JSON.stringify({
        amount: 50,
        tripWeight: 0.1,
      }),
    });
    expect(response.status).toBe(201);

    const expense = await db.bazarExpense.findFirst({
      orderBy: { submittedAt: "desc" },
    });
    expect(expense?.tripWeight.toNumber()).toBe(0.1);
  });

  it("rejects invalid trip weight", async () => {
    const response = await fetch("/api/bazar/expense", {
      method: "POST",
      body: JSON.stringify({
        amount: 500,
        tripWeight: 0.5,
      }),
    });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid trip weight. Must be 1.0 or 0.1.");
  });
});
```

**Visit Count Aggregation:**

```typescript
describe("GET /api/bazar/history", () => {
  it("calculates visit count as sum of trip weights", async () => {
    // Create test data: 3 regular (1.0 each) + 2 instant (0.1 each)
    await createTestExpenses(userId, [
      { tripWeight: 1.0 },
      { tripWeight: 1.0 },
      { tripWeight: 1.0 },
      { tripWeight: 0.1 },
      { tripWeight: 0.1 },
    ]);

    const response = await fetch("/api/bazar/history");
    const json = await response.json();

    const userEntry = json.data.leaderboard.find((e) => e.userId === userId);
    expect(userEntry.visits).toBe(3.2);
  });
});
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Trip weight assignment for Regular Bazar

_For any_ expense submitted via the Regular Bazar button, the system SHALL assign a trip_weight value of exactly 1.0 to the BazarExpense record.

**Validates: Requirements 1.2**

### Property 2: Trip weight assignment for Instant Bazar

_For any_ expense submitted via the Instant Bazar button, the system SHALL assign a trip_weight value of exactly 0.1 to the BazarExpense record.

**Validates: Requirements 1.3**

### Property 3: Trip closure for Regular Bazar

_For any_ expense submitted via Regular Bazar, the system SHALL mark the active trip status as 'completed', set completedAt to the current timestamp, clear shopping_notes, and set SystemConfig.activeTripId to null.

**Validates: Requirements 2.1, 2.3, 2.4, 2.5**

### Property 4: Trip closure for Instant Bazar

_For any_ expense submitted via Instant Bazar, the system SHALL mark the active trip status as 'completed', set completedAt to the current timestamp, clear shopping_notes, and set SystemConfig.activeTripId to null.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5**

### Property 5: Non-negative amount acceptance

_For any_ non-negative decimal amount (including zero), the system SHALL accept the expense submission for both Regular Bazar and Instant Bazar.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Negative amount rejection

_For any_ negative amount value, the system SHALL reject the expense submission and return the error message "Amount must be a non-negative number".

**Validates: Requirements 3.5**

### Property 7: Visit count calculation

_For any_ member with a set of bazar expenses, the visit count SHALL equal the sum of all trip_weight values from that member's BazarExpense records.

**Validates: Requirements 4.2**

### Property 8: Visit count display format

_For any_ visit count value, the system SHALL display it as a decimal number with exactly one decimal place precision in the format "X.Y trips".

**Validates: Requirements 4.3, 4.4**

### Property 9: Trip weight validation

_For any_ trip weight value that is not 1.0 or 0.1, the system SHALL reject the expense submission and return the error message "Invalid trip weight. Must be 1.0 or 0.1".

**Validates: Requirements 7.2, 7.3**

### Property 10: Assignee suggestion with decimal visit counts

_For any_ set of active members, the system SHALL calculate visit count as the sum of trip_weight values, sort members by visit count in ascending order, and select the two members with the lowest visit counts as suggested assignees.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 11: Expense history display uniformity

_For any_ set of bazar expenses regardless of trip_weight values, the expense history SHALL display all expenses in a unified list showing amount, date, note, and submitter name without displaying trip_weight values or type badges.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

## Performance Considerations

### Database Query Impact

**Before:**

```sql
SELECT user_id, COUNT(*) as visit_count
FROM "BazarExpense"
GROUP BY user_id;
```

**After:**

```sql
SELECT user_id, SUM(trip_weight) as visit_count
FROM "BazarExpense"
GROUP BY user_id;
```

**Impact:** Negligible. Both `COUNT(*)` and `SUM(trip_weight)` are O(n) operations. For fewer than 10 users with typical expense counts (< 100 per user), the performance difference is unmeasurable.

### Index Considerations

No new indexes are required. The existing indexes on `userId` and `date` are sufficient for all queries.

## Security Considerations

### Input Validation

Trip weight is validated at two levels:

1. **Domain layer** — `validateTripWeight()` ensures only 1.0 or 0.1 are accepted
2. **Database layer** — Decimal(3, 2) constraint prevents invalid precision

### Authorization

No changes to authorization logic. Existing rules apply:

- Only authenticated members can submit expenses
- Members can only submit expenses for themselves
- Admins can edit any expense

## Future Extensibility

### Adding New Trip Weight Levels

To add a new trip weight (e.g., 0.5 for "Medium Bazar"):

1. Update `VALID_TRIP_WEIGHTS` array in `lib/domain/bazar.ts`
2. Add new button to `ExpenseForm` component
3. Update UI labels and documentation

No database migration needed — Decimal(3, 2) already supports values from 0.00 to 9.99.

### Analytics and Reporting

The trip weight data enables future analytics:

- Average trip weight per member
- Trend analysis (are members doing more instant bazars over time?)
- Effort-based leaderboards (weighted by trip size)

All of these can be implemented as read-only queries without schema changes.

## Deployment Checklist

- [ ] Run database migration: `npx prisma migrate dev --name add_trip_weight_to_bazar_expense`
- [ ] Verify migration applied default value to existing records
- [ ] Deploy backend API changes
- [ ] Deploy frontend UI changes
- [ ] Verify two-button layout renders correctly on mobile (390px width)
- [ ] Test expense submission with both Regular and Instant options
- [ ] Verify visit counts display with one decimal place
- [ ] Verify leaderboard uses tabular-nums font variant
- [ ] Test assignee suggestion with decimal visit counts
- [ ] Verify expense history shows no trip weight indicators

## Rollback Plan

If issues are discovered after deployment:

1. **UI Rollback:** Revert `ExpenseForm` to single button, hardcode `tripWeight: 1.0`
2. **API Rollback:** Make `tripWeight` optional with default 1.0
3. **Database Rollback:** Not recommended — existing data with trip_weight = 1.0 is valid

**Preferred approach:** Fix forward rather than rollback, since the default value ensures backward compatibility.

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** AI Agent (Kiro)
