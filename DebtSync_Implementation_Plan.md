# DebtSync Implementation Plan

**Target repository:** `/home/abdullah/Projects/MessManage`

**Product specification:** `DebtSync_PRD.md`

**Target release:** Release 1 - Operational DebtSync

**Application stack:** Next.js 15 App Router, React 19, TypeScript, Prisma 6, PostgreSQL, Auth.js 5, Vercel, Vitest, web-push

**Currency and timezone:** BDT, Asia/Dhaka

---

## 1. Purpose

This document is the execution plan for the internal DebtSync accounting module inside MessManage. It is ordered so database and accounting invariants are proven before financial mutations or user-facing pages are enabled. The user-facing destination is named **Money**, while technical models, routes, flags, and service names retain **DebtSync**.

The implementation must preserve the central distinction in `DebtSync_PRD.md`:

- MealSync `MonthlySettlement` rows create immutable debt obligations.
- DebtSync `Transfer` rows describe claimed payments.
- Obligations affect balances immediately.
- Transfers affect balances only after confirmation by the non-initiating participant.

The implementation is complete only when every Release 1 acceptance criterion in the PRD passes.

---

## 2. Current Repository Baseline

The existing application already provides:

- Google OAuth and approved-user sessions through `lib/auth.ts` and `lib/session.ts`
- Active/member/admin identity in the `User` model
- Contact, bKash, and bank-reference fields on `User`
- Permanent `MonthlySettlement` rows
- Manual settlement through `app/api/settlement/run/route.ts`
- Scheduled settlement through `app/api/cron/auto-settle/route.ts`
- Shared Decimal-based settlement logic in `lib/domain/settlement.ts`
- Shared month-balance retrieval in `lib/queries/balance.ts`
- Existing browser push subscriptions and push utility
- Meal-specific notification-delivery history
- Vitest domain tests
- Responsive authenticated layout and sidebar
- Vercel deployment and cron configuration

Important implementation constraints:

- Manual and cron settlement routes currently duplicate validation and persistence logic.
- `MonthlySettlement` currently has no DebtSync relation or pair uniqueness constraint.
- Existing `NotificationDelivery` is specific to meal reminders and must remain intact.
- The application is single-household and has no household or tenant key.
- Balance calculations must continue using `decimal.js`; JavaScript numbers are forbidden for money.

---

## 3. Delivery Strategy

Use one feature branch and deliver in independently verifiable milestones. Keep DebtSync navigation hidden until migration, backfill, API validation, and balance reconciliation are complete.

Recommended environment flag:

```text
NEXT_PUBLIC_DEBTSYNC_ENABLED=false
```

Add a separate server-only rollout flag:

```text
DEBTSYNC_MUTATIONS_ENABLED=false
```

`NEXT_PUBLIC_DEBTSYNC_ENABLED` controls user-facing navigation and pages. The server-only flag blocks sender- and receiver-initiated payment creation, response, cancellation, and reversal until migration and reconciliation pass. It does not disable the atomic MealSync settlement handoff, which must remain active once its schema and service are deployed. Authentication and authorization remain mandatory regardless of either flag.

### Milestones

1. Schema and migration safety
2. Historical obligation backfill
3. Atomic MealSync handoff
4. Balance and ledger domain
5. Payment state machine and APIs
6. Persistent notifications and push
7. DebtSync user interface
8. Debt-aware deactivation
9. End-to-end verification and rollout

---

## 4. Phase 0: Baseline and Safety Checks

### Work

1. Run and record the current baseline:

```bash
npm test
npm run lint
npm run build
```

2. Inspect production or staging data before migration:

- Count `MonthlySettlement` rows.
- Count distinct settlement months and identify any month with financial activity but no settlement rows.
- Group by `(month, from_user_id, to_user_id)` and verify no duplicate pair exists.
- Verify every amount is positive and every source pair contains different users.
- Record counts by settlement month for later reconciliation.

3. Add `NEXT_PUBLIC_DEBTSYNC_ENABLED` to `.env.example` with a default of `false`.

### Exit Criteria

- Existing tests, lint, and build pass or all pre-existing failures are documented.
- No settlement duplicates block the planned unique constraint.
- A before-migration settlement count report exists.

### Phase 0 Execution Record — 2026-08-05

Branch baseline: `feature/debtsync` from commit `6b8a6de`.

Command results:

- `npm test`: passed; 8 test files and 122 tests.
- `npm run lint`: passed with zero errors and two pre-existing warnings in `__tests__/domain/meal.test.ts` for unused `beforeEach` and `afterEach` imports.
- `npm run build`: passed; Next.js 15.5.18 production compilation, type checking, and generation completed successfully.

Read-only production settlement preflight:

- 10 `MonthlySettlement` rows across 2 settled months.
- May 2026: 5 pairs totaling BDT 4,995.96; all rows share one settlement timestamp.
- June 2026: 5 pairs totaling BDT 2,509.19; all rows share one settlement timestamp.
- Duplicate `(month, fromUserId, toUserId)` pairs: 0.
- Non-positive settlement amounts: 0.
- Self-directed settlement pairs: 0.
- July 2026 has activity and no settlement rows, as expected before its scheduled August 20 settlement.
- August 2026 is the active current month and is correctly unsettled.

Phase 0 decision: preflight passes. The planned pair uniqueness constraint and historical settlement-run/obligation backfill are safe against the inspected production data.

---

## 5. Phase 1: Prisma Schema and Migration

### 5.1 Add Models and Enums

Update `prisma/schema.prisma` with the exact Release 1 models specified by the PRD:

- `DebtObligation`
- `MonthlySettlementRun`
- `Transfer`
- `DebtNotification`
- `DebtObligationSource`
- `SettlementTrigger`
- `TransferStatus`
- `TransferSource`
- `DebtNotificationEntity`
- `DebtNotificationType`
- `PushDeliveryStatus`

Add explicit `User` relations for:

- Obligations as debtor
- Obligations as creditor
- Sent transfers
- Received transfers
- Initiated transfers through a nullable relation that preserves legacy rows
- Owned debt notifications

Add an explicit self-relation on `Transfer` between an original payment and its reversal attempts.

Extend `MonthlySettlement` with:

- Optional many-to-one `MonthlySettlementRun` relation and nullable `runId` for rollout
- Optional one-to-one `DebtObligation` relation
- `@@unique([month, fromUserId, toUserId])`

Keep the run and obligation relations optional at schema level during rollout because old settlement rows exist before backfill. Application logic must require both relations for all newly committed settlement rows. `MonthlySettlementRun.month` is unique and is the authoritative marker that a month is settled, including when no transfer rows are needed.

### 5.2 Database Constraints

Prisma models provide keys, foreign keys, uniqueness, and indexes. Add SQL check constraints in the generated migration where Prisma cannot express them:

- Obligation amount greater than zero
- Transfer amount greater than zero
- Obligation debtor differs from creditor
- Transfer sender differs from receiver
- Rejected transfer requires non-null rejection reason
- Non-rejected transfer has null rejection reason
- A partial unique index permits at most one `pending` or `accepted` reversal for each non-null `reversesTransferId`

Generate the partial index in the migration with the stable name `unique_active_reversal_per_transfer`; target `reverses_transfer_id` where it is non-null and status is `pending` or `accepted`.

Do not add a mutable or cached balance column.

### 5.3 Migration Verification

Generate a named migration such as `add_debtsync_release_1`. Review its SQL before applying it outside development.

After migration:

- Run `prisma generate`.
- Verify all new tables, foreign keys, indexes, enums, and checks.
- Verify existing MealSync tables and data are unchanged.

### Exit Criteria

- Migration applies cleanly to a copy of current data.
- Migration rolls forward without dropping or rewriting MealSync financial records.
- Prisma client generation, TypeScript compilation, and existing tests succeed.

---

## 6. Phase 2: Historical Obligation Backfill

### 6.1 Backfill Command

Create an idempotent TypeScript command at `scripts/backfill-debt-obligations.ts` and add a package script:

```json
"debts:backfill": "tsx scripts/backfill-debt-obligations.ts"
```

First, create one idempotent `MonthlySettlementRun` for each distinct historical settlement month:

- `month = settlement.month`
- `trigger = backfill`
- `settledById = null`
- `settledAt = earliest settledAt among that month's source rows`

Attach every historical `MonthlySettlement` to its month run. Then, for every settlement without an obligation:

- `debtorId = fromUserId`
- `creditorId = toUserId`
- `amount = settlement.amount`
- `source = meal_settlement`
- `sourceReference = meal-settlement:<settlement.id>`
- `monthlySettlementId = settlement.id`
- `createdAt = settlement.settledAt`

Process records in deterministic ID order and bounded batches. Use unique constraints and an upsert or create-with-conflict handling so retries remain safe.

### 6.2 Output and Failure Behavior

Print a final machine-readable and human-readable summary:

```text
scanned=<n> created=<n> skipped=<n> failed=<n>
```

- Stop with a nonzero exit code if any row is invalid or fails.
- Never delete or modify a source settlement.
- Do not send historical push notifications during backfill.
- Persistent historical notifications are also skipped to avoid flooding users.

### 6.3 Reconciliation

After backfill, verify:

- Settlement count equals meal-settlement obligation count.
- Settlement-run count equals the distinct historical settlement-month count.
- Every historical settlement row is linked to its month run.
- Every obligation matches source debtor, creditor, amount, and timestamp.
- No obligation has a missing or duplicate source reference.
- Running the command again reports `created=0` and `failed=0`.

### Exit Criteria

- All existing settlement rows have exactly one matching obligation.
- All existing settlement months have exactly one run.
- Reconciliation output is saved for deployment review.

### Phase 1-2 Execution Record — 2026-08-05

- Applied migration: `20260805194500_add_debtsync_release_1`
- Migration SQL was verified to contain no `DROP`, `TRUNCATE`, `DELETE`, or data-rewriting `UPDATE` statements.
- Pre-migration settlement snapshot: `count=10`, `months=2`, `total=7505.15`, `duplicates=0`, `invalid=0`.
- Settlement financial-field checksum before migration: `ada1d18dbc9e08cd113fc9a15c2d10c44b072b533f9592928adb77b8d16a6de8`.
- First backfill: `scanned=10 created=10 skipped=0 failed=0 runsCreated=2 runsSkipped=0 settlementsLinked=10`.
- Idempotency rerun: `scanned=10 created=0 skipped=10 failed=0 runsCreated=0 runsSkipped=2 settlementsLinked=0`.
- Final reconciliation: `settlements=10`, `obligations=10`, `runs=2`, `reconciliationIssues=0`, `duplicateSourceReferences=0`.
- Post-backfill settlement financial-field checksum remained `ada1d18dbc9e08cd113fc9a15c2d10c44b072b533f9592928adb77b8d16a6de8`; existing settlement amounts, parties, months, and timestamps were unchanged.

---

## 7. Phase 3: Atomic MealSync Settlement Handoff

### 7.1 Shared Settlement Service

Create a shared service, for example `lib/services/run-month-settlement.ts`, and move duplicated behavior out of the manual and cron routes:

- Month selection and duplicate check
- Aggregate readiness validation
- Month-balance retrieval
- Smart-settlement calculation
- Transactional persistence
- Safe result classification

Service input:

```ts
type RunMonthSettlementInput = {
  monthKey: string; // YYYY-MM-01
  trigger: "manual" | "cron";
  actorId?: string;
};
```

Service result:

```ts
type RunMonthSettlementResult =
  | { status: "completed"; month: string; transfers: SettlementTransfer[]; notificationIds: string[] }
  | { status: "already_settled"; month: string }
  | { status: "no_data"; month: string }
  | { status: "blocked"; month: string; reasons: string[] };
```

The manual route continues to require admin authorization. The cron route continues to require `CRON_SECRET`. Neither route may duplicate accounting logic after this refactor.

### 7.2 Transactional Persistence

Inside one Prisma transaction, create each small settlement pair individually so its generated ID can be used immediately:

1. Create the unique `MonthlySettlementRun` for the month.
2. Create each `MonthlySettlement` linked to that run.
3. Create its linked `DebtObligation`.
4. Create one persistent notification for the debtor and one for the creditor.

If the computed transfer list is empty, commit the run with zero settlement rows. All existing settled-month checks, protected meal-edit checks, settlement history queries, and monthly report guards must use `MonthlySettlementRun`, not the existence of a settlement row.

If any step fails, roll back the entire settlement run.

Catch the unique `MonthlySettlementRun.month` race and return `already_settled` rather than a generic server error when another manual or cron request won. Keep pair uniqueness as a secondary integrity constraint.

### 7.3 Push Delivery

After transaction commit:

- Load subscriptions for notification recipients.
- Attempt push through the existing `lib/utils/push.ts` utility.
- Update each `DebtNotification.pushStatus` and `pushAttemptedAt`.
- Never fail or undo settlement because push delivery failed.

### Exit Criteria

- Manual and cron routes call one shared service.
- A new settlement creates matching obligations and notifications atomically.
- Retry and race tests produce no duplicate settlement pair or obligation.
- A zero-transfer month creates one run, no pairs, and is permanently read-only.

---

## 8. Phase 4: Debt Balance and Ledger Domain

### 8.1 Pure Domain Functions

Create a DebtSync domain area such as `lib/domain/debts/` containing:

- Decimal-safe pairwise calculation
- Overall, gross owed, and gross owing calculation
- Ledger-entry normalization
- Transfer state-transition predicates
- Input validation and decimal parsing
- API serializers

Core domain types belong in `types/debts.ts`. API amounts remain strings at every boundary.

### 8.2 Query Layer

Create `lib/queries/debts.ts` to fetch:

- All obligations involving selected members
- Accepted transfers for balance calculations
- Pending incoming and outgoing transfers
- Pairwise positions
- Combined ledger activity
- Dashboard summary
- Unread notification count

The household has fewer than ten members, so Release 1 should query source records and fold them using `Decimal`. Do not introduce `DebtSnapshot`, materialized balances, or cache invalidation.

### 8.3 Required Invariants

Every calculation must satisfy:

```text
pairwise(A, B) = -pairwise(B, A)
sum(overall net for all members) = 0.00
pending/rejected/cancelled transfer contribution = 0.00
```

### 8.4 Cursor Design

Use a base64url-encoded cursor containing `createdAt`, discriminated entry type, and ID. Sort by:

1. `createdAt DESC`
2. Entry-type key for deterministic cross-table ordering
3. `id DESC`

Reject malformed cursors with `VALIDATION_ERROR` rather than silently restarting pagination.

### Exit Criteria

- Domain tests cover all accounting formulas and invariants.
- Fixture balances independently match expected values.
- No domain API accepts or returns floating-point money.

### Phase 3-4 Execution Record — 2026-08-05

- Manual and cron settlement routes now call one shared `runMonthSettlement` service.
- A settlement run, settlement pairs, linked obligations, and two persistent notifications per obligation are committed in one transaction.
- Best-effort push delivery runs only after commit and cannot roll back the financial transaction.
- Unique settlement-run races are classified as `already_settled`; a data-bearing zero-transfer month still creates one permanent run.
- All existing settled-month guards, history queries, and monthly reports now use `MonthlySettlementRun`, including zero-transfer months.
- Added Decimal-only pairwise, member-total, ledger normalization, transfer-predicate, validation, serialization, cursor, dashboard-summary, and query functions.
- Automated validation: `141` tests passed, TypeScript and production build passed, and lint reported zero errors with two pre-existing warnings.
- No live database mutation was performed while implementing or testing Phases 3-4.

---

## 9. Phase 5: Payment Commands and APIs

### 9.1 Command Services

Implement server-only command functions before route handlers:

- `createPayment`
- `createReceivedMoney`
- `respondToPayment`
- `cancelPayment`
- `createReturnPayment`

Each command must:

- Accept the authenticated actor separately from request data.
- Load and validate current database state.
- Use one transaction for the transfer state change and persistent notifications.
- Return a typed result or stable domain error.
- Return notification IDs for after-commit push delivery.

### 9.2 Payment Creation

`createPayment` must enforce:

- Actor is an active user.
- Receiver exists, is active, and differs from actor.
- Amount and description satisfy PRD limits.
- `clientRequestId` is a valid UUID.
- A duplicate request ID returns the existing matching transfer.
- If a request ID exists with different payload or actor, return `DUPLICATE_REQUEST_CONFLICT`.

Create the pending transfer and receiver notification atomically.

`createReceivedMoney` uses the same validation, idempotency, serializable bounded-retry, and notification rules, but stores the selected lender as `senderId`, the authenticated borrower as both `receiverId` and `initiatedById`, and notifies the lender to confirm that the money was sent. New sender-initiated payments explicitly store the sender as `initiatedById`; existing null values remain legacy sender-initiated rows.

### 9.3 Race-Safe Responses

Use a conditional update whose predicate includes both ID and `status = pending`.

- Accept/reject actor must equal the non-initiating participant.
- Cancel actor must equal the initiating participant.
- When `initiatedById` is null, derive legacy ownership as sender initiates and receiver responds.
- Exactly one concurrent terminal transition may update one row.
- If affected row count is zero, reload and return either `403`, `404`, or `409` based on current state.

### 9.4 Return Payment

`createReturnPayment` must enforce:

- Original transfer exists and is `accepted`.
- Original source is `direct`.
- Authenticated actor equals the original receiver.
- No pending or accepted reversal already exists.
- New sender is the authenticated original receiver.
- New receiver is the original sender.
- Amount is copied exactly from the original transfer.
- Source is `reversal` and the original link is stored.
- Rejected or cancelled reversal attempts do not prevent a later retry.
- Rely on the partial unique active-reversal index as the final concurrency guard and map its conflict to `ACTIVE_REVERSAL_EXISTS`.

### 9.5 Route Handlers

Implement the exact API surface and response shapes from the PRD under:

```text
app/api/debts/summary/route.ts
app/api/debts/ledger/route.ts
app/api/debts/obligations/route.ts
app/api/debts/payments/route.ts
app/api/debts/payments/received/route.ts
app/api/debts/payments/[id]/respond/route.ts
app/api/debts/payments/[id]/cancel/route.ts
app/api/debts/payments/[id]/reverse/route.ts
```

Centralize error-to-HTTP mapping so stable error codes do not drift between routes.
While `DEBTSYNC_MUTATIONS_ENABLED` is not `true`, payment create/respond/cancel/reverse routes return `503` with `FEATURE_DISABLED`. Read APIs and the MealSync settlement handoff remain available.

### Exit Criteria

- All API contracts, permissions, idempotency rules, and state transitions pass automated tests.
- No endpoint trusts actor IDs or transfer status supplied by the browser.

---

## 10. Phase 6: Persistent Notifications and Push

### 10.1 Notification Service

Keep pure notification copy/building functions under `lib/domain/debts/notifications.ts`. Put database persistence and after-commit push delivery in a server-only service such as `lib/services/debts/notifications.ts`, preserving the rule that domain files never access Prisma.

The server-only notification service has two responsibilities:

1. Build and persist event-specific notification records inside the financial transaction.
2. Deliver web push after commit and update delivery status.

Do not modify the semantics or uniqueness constraints of the existing meal-reminder `NotificationDelivery` model.

### 10.2 Notification APIs

Implement:

```text
app/api/notifications/inbox/route.ts
app/api/notifications/[id]/read/route.ts
app/api/notifications/read-all/route.ts
```

All reads and writes are scoped to the authenticated `userId`. Mark-one and mark-all operations are idempotent.

### 10.3 Push Behavior

- Reuse current `PushSubscription` and `sendPushNotification`.
- Use short, non-sensitive titles and messages.
- Include only an authenticated deep link and safe summary.
- Mark missing configuration/subscription as `skipped`.
- Mark delivery success as `sent` and terminal delivery failure as `failed`.
- Deactivate invalid subscriptions according to existing push conventions.

### Exit Criteria

- Every required event creates the correct recipient notification.
- Notification ownership tests prevent cross-user access.
- Forced push failure leaves the financial transaction committed.

### Phase 5-6 Execution Record — 2026-08-05

- Added authenticated DebtSync summary, ledger, obligation, and payment read routes.
- Added direct payment creation, receiver response, sender cancellation, and full return-payment commands and routes.
- Payment creation and return-payment creation use serializable transactions with bounded retry; accept, reject, and cancel use conditional `status = pending` updates.
- Client request IDs are database-backed idempotency keys; exact retries return the existing payment and conflicting payloads return `DUPLICATE_REQUEST_CONFLICT`.
- The server derives every sender and transition actor from the authenticated session and never accepts actor IDs or status from request data.
- All user-initiated payment mutations are gated by `DEBTSYNC_MUTATIONS_ENABLED`; read APIs and the settlement handoff remain available.
- Added pure event-specific notification builders, transactional persistence, after-commit push delivery, invalid-subscription deactivation, and notification inbox/read APIs scoped to their owner.
- Added stable error-code-to-HTTP mapping for all DebtSync routes.
- Automated validation: `173` tests passed, TypeScript and production build passed, and lint reported zero errors with two pre-existing warnings.
- No live database mutation or live DebtSync API mutation was performed while implementing or testing Phases 5-6.

---

## 11. Phase 7: DebtSync Interface

### 11.1 Route Structure

Create authenticated pages:

```text
app/debts/page.tsx
app/debts/payments/new/page.tsx
app/debts/payments/received/new/page.tsx (compatibility redirect)
app/debts/payments/[id]/page.tsx
app/debts/ledger/page.tsx
app/notifications/page.tsx
```

Create focused client components under `components/domain/debts/`; keep server pages responsible for authentication and initial data boundaries.

### 11.2 Shared UI Types and Fetching

- Define discriminated API types in `types/debts.ts`.
- Reuse existing `ApiSuccess`, `ApiError`, member summaries, date utilities, and Decimal string conventions.
- Add loading, empty, success, validation, authorization, conflict, and retry states for every mutation.
- Refresh dashboard and affected detail data after a successful transition.

### 11.3 Dashboard

Build in this order:

1. `You owe`, `Owed to you`, and `Net position`
2. Pairwise member positions
3. Payment records needing the current member's response
4. Pending records initiated by the current member
5. Recent mixed activity

Use explicit labels and direction sentences. Never rely on color alone.

### 11.4 Payment Form and Detail

- Generate one `clientRequestId` when the form session begins and reuse it for network retries.
- Show selected member's current pairwise position and available payment-reference details.
- Use one **Record money** form with **I sent money** and **I received money** choices.
- Show the projected pairwise position so loans, repayments, and overpayments are explicit without blocking a valid transfer.
- Dynamically identify whether the other member confirms receiving or sending the money.
- Require a final confirmation before creating a payment.
- Require a rejection reason before rejection.
- Confirm cancellation and return-payment actions.
- Disable conflicting controls while a request is in flight.
- On `409`, reload and display the actual current status.

### 11.5 Navigation and Responsive Design

- Use the single visible application brand **MessManage**.
- Add an always-visible **Money** hub at `/money`; show confirmed-balance, Record money, and ledger cards inside it only when the DebtSync interface flag is enabled.
- Group `/money`, `/debts`, `/settlement`, and the current member's own running-balance page under one Money navigation state while preserving every existing URL.
- Add an accessible notification icon and unread count when DebtSync is enabled.
- Keep Money in the five-item mobile navigation without relying on hover interactions.
- Label `/debts` as **Balances & Payments** and `/settlement` as **Monthly closing** in user-facing copy.
- During rollout, update the Google OAuth consent-screen application name to **MessManage** without changing client credentials or redirect URIs.
- Convert desktop tabular ledger information into labeled mobile rows.
- Keep summary amounts, status text, and action controls within stable responsive containers.
- Follow existing CSS variables and visual language rather than creating a separate design system.

### Exit Criteria

- All Release 1 journeys work at desktop and mobile viewports.
- Long member names, large amounts, errors, and empty states do not overlap or shift controls.
- Keyboard navigation and visible focus work across all financial actions.

### MessManage UX rollout record

- UX Phase 1 established the MessManage brand, grouped desktop/mobile navigation, and stable `/expenses` and `/money` hubs.
- UX Phase 2 upgrades `/expenses` to a read-only operational summary of active Bulk cycles, current-month Maid records, and the previous-month Fridge bill. Full entry workflows and all existing routes remain unchanged.
- The Expenses summary introduces no schema migration, financial mutation, historical recalculation, or change to DebtSync accounting.

---

## 12. Phase 8: Debt-Aware Member Deactivation

Extend the existing admin deactivation route before changing user status:

1. Calculate all pairwise positions involving the target member.
2. Count pending incoming and outgoing transfers and pending debt requests involving the member.
3. Block if any pairwise amount is nonzero or pending count is greater than zero.
4. Return `409` with `DEACTIVATION_BLOCKED_BY_DEBT`, gross amount owed, gross amount owing, and pending count.
5. Preserve current MealSync deactivation checks and execute all checks before mutation.

The existing `GET` preview must return the debt-clearance result so the confirmation interface can explain a blocked deactivation. The `POST` must recalculate the same result and commit the clearance check and status change using a serializable transaction with bounded retry for serialization conflicts.

Payment and debt-request creation must use the same serializable isolation and bounded-retry policy. Inside those transactions they must re-read both participants' status before creating the pending record. Deactivation must re-read pairwise balances, pending transfers, and pending debt requests inside its transaction. This symmetric policy ensures concurrent deactivation and financial-action creation cannot both commit an invalid result.

Do not allow admin override. Historical records remain linked to the deactivated user.

### Exit Criteria

- Debt-free members can still be deactivated under current MealSync rules.
- Members with debt, pending payment actions, or pending debt requests cannot be deactivated.
- Reactivation and historical reporting continue to work.

---

## 12A. Phase 9: Member Debt Requests (Implemented, Now Dormant)

This workflow was implemented, but the product decision after validation was to remove it from the Release 1 interface because direct lending is already represented by recording money sent. Retain the schema, services, APIs, records, and safety checks without destructive rollback. Creation and history pages redirect to the dashboard, participant detail compatibility remains, and no active navigation or dashboard section exposes this workflow.

Original implementation record:

1. Add an additive `DebtRequest` model with requester, named debtor, exact amount, required description, terminal status timestamps, and a unique client request ID.
2. Extend `DebtObligation` with a nullable unique request relation while preserving all existing settlement relations and rows.
3. Create participant-scoped list/detail APIs plus idempotent creation, debtor-only response, and requester-only cancellation commands.
4. On acceptance, conditionally transition the request and create its `member_request` obligation and notification atomically in a serializable transaction.
5. Keep pending/rejected/cancelled requests out of accounting and private to their participants; expose only the accepted obligation to the shared ledger.
6. Add request creation, history, and detail pages, dashboard pending-action sections, deep-linked notifications, and mobile-first controls.
7. Count pending requests in the serializable deactivation clearance check.

No existing database row is updated by the migration. There is no backfill for member requests.

### Exit Criteria

- A request cannot change debt without confirmation from the named debtor.
- Acceptance creates exactly one correctly directed immutable obligation.
- Non-participants cannot read private request details.
- Creation, response, cancellation, notification, and deactivation races are safe and tested.

---

## 12B. Phase 10: Record Money Received

Add the borrower-initiated workflow without changing accepted-transfer accounting:

1. Add nullable `Transfer.initiatedById` and its `User` relation through an additive migration. Do not backfill, recalculate, or modify existing transfers.
2. Add `createReceivedMoney` and `POST /api/debts/payments/received` using the existing mutation flag, exact decimal validation, idempotency, serializable bounded retry, transactional notifications, and best-effort push delivery.
3. Generalize pending response and cancellation ownership around the initiator while treating a null initiator as a legacy sender-initiated payment.
4. Add `needs_response` and `initiated_by_me` payment filters while preserving incoming/outgoing as actual money-direction filters.
5. Add contextual payment-detail actions and notification wording for both initiation directions.
6. Reuse the existing direct transfer row after acceptance; never create a duplicate obligation or accounting record.

### Exit Criteria

- Pending, rejected, and cancelled receiver-initiated records never affect balances.
- Acceptance makes the receiver owe the sender by the exact amount using the existing transfer formula.
- Sender-initiated and legacy-null behavior remains unchanged.
- Participant permissions, idempotency, concurrency, notification, deactivation, mobile, and desktop cases pass.

---

## 12C. Phase 11: Unified Record Money Interface

1. Replace separate **Record payment** and **Record money received** commands with one primary **Record money** action.
2. Begin the form with mobile-first **I sent money** and **I received money** choices, followed by one dynamic member, amount, description, current-position, projected-position, and confirmation flow.
3. Continue calling the separate tested sender-initiated and receiver-initiated APIs; make no accounting, schema, or historical-data change.
4. Redirect the old received-money form URL to the unified form.
5. Remove debt-request creation, history, buttons, and pending sections from the active interface while preserving its backend, records, deactivation checks, and participant detail compatibility.

### Exit Criteria

- One form clearly handles both money directions without ambiguous `from`/`to` wording.
- Mobile controls are at least 44px, vertically stack at 390px, and never scroll horizontally.
- Confirmation copy identifies the direction, member, amount, and who must confirm.
- No database migration or live-data mutation is required.

---

## 13. Automated Test Plan

### 13.1 Domain Tests

Add Vitest suites for:

- One obligation in each direction
- Multiple obligations across months
- Partial payment
- Full payment
- Overpayment and direction reversal
- Opposing obligations
- Multiple accepted payments
- Pending/rejected/cancelled exclusion
- Accepted full reversal
- Decimal precision and two-decimal serialization
- Pairwise antisymmetry
- Household net sum equal to zero
- Ledger ordering and cursor validation

### 13.2 Command and Route Tests

Cover:

- Auth required and inactive account handling
- Self-payment rejection
- Unknown/inactive receiver rejection
- Unknown/inactive selected lender rejection
- Invalid amount, description, reason, and UUID input
- Idempotent payment retry
- Conflicting payload with reused request ID
- Receiver-only accept/reject
- Non-initiator-only accept/reject in both initiation directions
- Initiator-only cancellation in both initiation directions
- Original-receiver-only return payment
- Concurrent accept/reject/cancel winner behavior
- Terminal state immutability
- Reversal eligibility and retry after rejection/cancellation
- Notification ownership
- Push failure isolation
- Debt-aware deactivation
- Debt-request creation idempotency and participant-only visibility
- Debtor-only acceptance/rejection and requester-only cancellation
- Accepted request obligation direction and exactness
- Pending debt-request deactivation blocking
- Receiver-initiated creation idempotency and conflicting request IDs
- Legacy null-initiator ownership

### 13.3 Settlement Integration Tests

Cover manual and cron calls through the shared service:

- New settlement creates matching obligation and two notifications per pair.
- A failure in obligation creation rolls back settlement creation.
- Retry creates no duplicate.
- Manual/cron race resolves to one committed result.
- Zero-transfer settlement creates one month run and remains idempotently settled.
- Concurrent reversal requests with different client request IDs produce only one active reversal.
- Concurrent payment creation and deactivation force one transaction to retry or fail safely.
- Backfill is idempotent and preserves source values.
- Concurrent request acceptance creates one obligation.
- Concurrent debt-request creation and deactivation force one transaction to retry or fail safely.

### 13.4 Regression Tests

Run the full existing test suite and specifically verify:

- Meal settlement calculations
- Balance queries used by MealSync
- Automatic settlement cron authorization
- Google session behavior
- Member deactivation/reactivation
- Meal-reminder subscriptions and delivery
- Monthly settlement reports

### 13.5 Browser Tests

Add Playwright for critical browser journeys if it is not already present:

- Use **I sent money**, receiver accepts, and both dashboards update
- Use **I received money**, sender confirms, and both dashboards update
- Lender rejects a received-money record and borrower cancels a pending record
- Receiver rejects with reason
- Sender cancels pending payment
- Original receiver returns accepted payment and original sender accepts
- Filter shared ledger
- Read one and all notifications
- Confirm debt-request creation/history controls are absent while retained historical detail links remain safe
- Mobile workflow at a 390 by 844 viewport
- Desktop workflow at a 1440 by 900 viewport

Capture screenshots for dashboard, payment detail, ledger, notifications, and all modal states. Check that no text, amount, status, or action overlaps.

---

## 14. Deployment and Rollout

### 14.1 Staging

1. Deploy the additive schema migration with navigation and DebtSync user mutations disabled.
2. Deploy the atomic dual-write settlement service and gated DebtSync APIs.
3. Run the backfill once, then again to prove idempotency.
4. Compare settlement-run, settlement-row, and obligation counts by month.
5. Calculate fixture balances independently and compare them with the summary API.
6. Enable DebtSync mutations in staging and exercise both directions through the unified Record money form.
7. Force a push failure and verify accounting remains committed.
8. Run full automated and browser tests.
9. Confirm debt-request creation/history entry points redirect and no dashboard request controls remain.
10. Exercise sent-money and received-money creation, confirmation/rejection, initiator cancellation, and full reversal using two staging accounts.

### 14.2 Production

1. Take a database backup or verified restore point.
2. Record existing transfer counts, accepted totals, and a deterministic transfer checksum; then apply the reviewed additive migration with navigation and DebtSync mutations disabled.
3. Deploy the atomic settlement writer and DebtSync APIs/pages; keep `NEXT_PUBLIC_DEBTSYNC_ENABLED=false` and `DEBTSYNC_MUTATIONS_ENABLED=false`.
4. Run the settlement-run and obligation backfill, then save its reconciliation output.
5. Verify every settlement month has one run, every settlement row has one obligation, household net sums to zero, and transfer counts, accepted totals, and checksum are unchanged by the migration.
6. Enable `DEBTSYNC_MUTATIONS_ENABLED` and complete one controlled sender-initiated payment, one receiver-initiated received-money confirmation, and one controlled debt-request acceptance using team accounts.
7. Enable `NEXT_PUBLIC_DEBTSYNC_ENABLED` and redeploy.
8. Monitor server errors, conflict responses, failed push delivery, and reconciliation counts.
9. Verify the additive debt-request migration preserved all historical obligation links before enabling mutations.

The existing auto-settlement schedule remains the repository's actual `0 0 20 * *` schedule: 06:00 Asia/Dhaka on the 20th, settling the previous month. Do not replace it with stale 1st- or 5th-of-month documentation.

### 14.3 Rollback Policy

- Before user activity, disable navigation and roll back the application deployment if validation fails.
- Do not delete backfilled obligations or accepted payments as an application rollback technique.
- After user activity begins, disable new DebtSync mutations through deployment or route gating while preserving read-only history until a forward fix is deployed.
- Database rollback must use a verified backup and is permitted only before new financial records are created.

---

## 15. Release Checklist

- [ ] Baseline test, lint, and build results recorded
- [ ] Settlement duplicate preflight passed
- [ ] Prisma migration reviewed and applied in staging
- [ ] Existing settlements backfilled exactly once
- [ ] Every historical settlement month has one settlement-run marker
- [ ] Manual and cron settlement use one service
- [ ] New settlement handoff is atomic
- [ ] Balance invariants pass fixtures
- [ ] Payment commands are idempotent and race-safe
- [ ] Receiver-initiated received-money records preserve existing accepted-transfer accounting
- [ ] Legacy null-initiator payment behavior remains unchanged
- [ ] Active reversal uniqueness is enforced by a partial database index
- [ ] Notifications are persistent and push is non-blocking
- [ ] Dashboard, payment, ledger, and notification pages complete
- [ ] Mobile and desktop browser tests pass
- [ ] Member deactivation respects DebtSync
- [ ] One Record money form handles both directions clearly
- [ ] Debt-request creation/history UI is dormant while retained data and safeguards remain intact
- [ ] Existing MealSync tests pass
- [ ] Production reconciliation reviewed
- [ ] Controlled production workflow passed
- [ ] DebtSync navigation enabled

---

## 16. Definition of Done

DebtSync Release 1 is done when:

- The production database contains one obligation for every MealSync settlement row.
- The production database contains one settlement run for every settled month, including zero-transfer months created after release.
- New settlement obligations are created atomically and idempotently.
- Members can record money sent or received, confirm, reject, cancel, and return payments under the exact permission rules.
- Debt-request creation and history are absent from the active interface while retained records and safeguards remain intact.
- All balances are derived correctly from obligations and accepted transfers.
- All financial actions retain an immutable, inspectable history.
- In-app and push notifications behave according to the PRD.
- DebtSync is usable and readable on supported desktop and mobile browsers.
- Debt-aware member deactivation prevents unresolved records from becoming inaccessible.
- All new tests and existing MealSync tests pass.
- The Release 1 acceptance criteria in `DebtSync_PRD.md` are demonstrably satisfied.
