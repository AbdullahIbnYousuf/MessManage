# DebtSync Product Requirements Document

**Product:** DebtSync, the debt and payment module of MealSync

**Application:** Household Meal and Money Management System

**Release:** Release 1 - Operational DebtSync

**Status:** Build-ready specification

**Primary implementation repository:** `/home/abdullah/Projects/MessManage`

**Last updated:** August 2026

---

## 1. Product Summary

DebtSync is the long-running debt and payment ledger for the existing MealSync household application. MealSync calculates permanent month-end obligations from meals and shared household costs. DebtSync receives those obligations, records actual payments between members, requires the receiver to confirm each payment, and derives the current debt position from the complete history.

DebtSync will be built inside the existing MealSync web application. It will reuse the current Next.js App Router frontend and API routes, PostgreSQL database, Prisma ORM, Google OAuth membership, approved `User` records, member payment details, Vercel deployment, and browser push subscriptions.

The production accounting model deliberately separates two different facts:

- **Obligation:** Member A owes Member B. This increases A's debt to B.
- **Payment:** Member A sent money to Member B. Once B accepts it, this reduces A's debt to B or creates credit for A if no debt existed.

An imported MealSync settlement is an obligation, not proof that payment occurred.

---

## 2. Problem Statement

MealSync currently produces permanent `MonthlySettlement` rows identifying who owes whom after each month. It does not track whether the money was subsequently sent, received, rejected, partially paid, or still outstanding. Members therefore still need an external conversation or spreadsheet to understand payment reality.

DebtSync must close that gap without turning MealSync into a payment processor. It must provide a transparent, confirmation-based ledger in which:

- Every MealSync settlement obligation appears exactly once.
- Members can record money they actually sent.
- A claimed payment has no accounting effect until its receiver confirms it.
- Every balance can be reproduced from immutable source records.
- Debts continue across months until later payments offset them.

---

## 3. Goals and Success Measures

### 3.1 Product Goals

1. Import every MealSync settlement obligation reliably and exactly once.
2. Give members a trustworthy workflow for recording and confirming payments.
3. Show clear overall, pairwise, pending, and historical debt information.
4. Preserve an immutable audit trail without storing calculated balances.
5. Reuse the current MealSync identity, interface, deployment, and notification infrastructure.
6. Work well on both desktop and mobile browsers.

### 3.2 Release Success Measures

- 100 percent of `MonthlySettlement` rows have one matching `DebtObligation`.
- No duplicate obligation is created by retries, manual settlement, cron settlement, or backfill.
- Every settled month has exactly one `MonthlySettlementRun`, including a valid zero-transfer month.
- Pending, rejected, and cancelled payments never change a displayed balance.
- Every accepted payment changes both members' pairwise and overall positions exactly once.
- All displayed balances can be recalculated from obligations and accepted payments.
- No unauthorized user can accept, reject, cancel, or reverse another member's payment.
- Existing MealSync authentication, settlement, reminder, and reporting workflows continue to pass their tests.

---

## 4. Users and Roles

### 4.1 Approved Member

An approved, active MealSync user. Every approved member may:

- View all household DebtSync balances and ledger entries.
- View imported settlement obligations.
- Record a payment to another active member.
- Accept or reject a payment received by them.
- Cancel a payment sent by them while it is pending.
- Return an accepted payment they originally received by initiating a linked reversal.
- View member contact, bKash, and bank information already exposed by MealSync.
- Read and manage their own notifications.

### 4.2 Admin

An admin has the same DebtSync powers as a regular member. Admin status does not allow editing, accepting, rejecting, cancelling, reversing, or deleting another member's financial record.

The existing admin-only member-deactivation action must additionally enforce DebtSync clearance rules.

### 4.3 Inactive or Unapproved User

An inactive, pending, rejected, or unauthenticated user cannot access DebtSync or perform DebtSync actions.

---

## 5. Scope

### 5.1 Release 1 Scope

- MealSync settlement obligation creation and historical backfill
- Direct payment recording
- Receiver acceptance and rejection
- Sender cancellation while pending
- Full reversal of an accepted payment through a new payment record
- Derived pairwise and overall balances
- DebtSync dashboard
- Obligation and payment history
- Ledger filters and pagination
- Member payment-reference information
- Persistent in-app notifications
- Browser push notifications
- Debt-aware member deactivation checks
- Responsive desktop and mobile web interface

### 5.2 Later Releases

**Release 2**

- Money requests that spawn payments after request acceptance
- Group expenses with equal and custom fixed splits
- Participant-level confirmation and dispute handling

**Release 3**

- On-demand smart-settlement suggestions based on the complete DebtSync ledger
- Suggested payments still use the normal receiver-confirmation workflow

### 5.3 Explicit Non-Goals

- Sending money through bKash, banks, cards, or payment gateways
- Verifying payments through an external financial provider
- Native Android or iOS applications
- Receipt or image uploads
- AI-generated financial advice
- Recurring debts or subscription billing
- Multiple households or tenant switching
- Interest, penalties, or due-date enforcement
- Editing or deleting accepted payments or imported obligations
- Automatically allocating one payment to particular obligation rows

---

## 6. Accounting Model

### 6.1 Source Records

DebtSync derives balances from only two Release 1 record classes:

1. Immutable `DebtObligation` records created from MealSync settlements.
2. `Transfer` records whose status is `accepted`.

No balance, debt total, or snapshot is stored in Release 1.

### 6.2 Pairwise Balance Formula

For member A relative to member B:

```text
pairwise(A, B)
  = obligations where B owes A
  - obligations where A owes B
  + accepted payments A sent B
  - accepted payments B sent A
```

Interpretation:

- Positive result: B owes A.
- Negative result: A owes B.
- Zero: neither member currently owes the other.

### 6.3 Overall Position

```text
overall_net(A) = sum of pairwise(A, every other member)
```

- Positive overall net means the member is owed money overall.
- Negative overall net means the member owes money overall.
- The dashboard must also show gross `You owe` and `Owed to you` totals so the net value does not hide obligations in opposite directions.

### 6.4 Payment Effects

- A pending payment contributes zero.
- An accepted payment contributes exactly once.
- A rejected payment contributes zero.
- A cancelled payment contributes zero.
- An accepted reversal contributes as a new payment in the opposite direction and offsets the original payment.
- A payment may partially reduce a debt.
- A payment may cover multiple historical obligations without explicit allocation.
- A payment may exceed the current pairwise debt. The interface must warn the sender, but allow submission because the extra amount represents a real loan or credit in the opposite direction once accepted.

### 6.5 Precision and Currency

- Currency is Bangladeshi taka, displayed as `BDT` or `Tk` consistently with the existing application.
- Stored monetary values use PostgreSQL `Decimal(12,2)`.
- API monetary values are decimal strings, never JavaScript floating-point numbers.
- Domain calculations use `decimal.js`.
- Amounts must be greater than `0.00` and contain no more than two fractional digits.
- Time-based behavior uses `Asia/Dhaka` through the application's existing date utilities.

---

## 7. Core User Journeys

### 7.1 MealSync Settlement Handoff

1. An admin or the scheduled cron runs the existing MealSync settlement. The production cron runs on the 20th of each month for the previous month.
2. MealSync validates the month and calculates debtor-creditor settlement pairs.
3. One permanent `MonthlySettlementRun`, unique by month, is created even when the result contains zero transfer pairs.
4. One permanent `MonthlySettlement` is created for each nonzero pair and linked to the run.
5. In the same database transaction, one `DebtObligation` is created for each settlement row.
6. Each obligation immediately contributes to DebtSync balances.
7. DebtSync creates notifications for both debtor and creditor; a zero-transfer run creates none.
8. Push delivery is attempted after the transaction commits.
9. A push failure is recorded but never rolls back settlement or obligation creation.

### 7.2 Record a Payment

1. An active member selects **Send Payment**.
2. The member chooses another active household member.
3. DebtSync shows the current pairwise position and the receiver's optional payment-reference information.
4. The sender enters an amount and optional description.
5. If the amount exceeds what the sender currently owes the receiver, DebtSync displays a warning explaining that acceptance will create or increase reverse credit.
6. The sender confirms submission.
7. A pending `Transfer` is created using a unique client request ID.
8. The receiver receives an in-app notification and a best-effort push notification.
9. No balance changes yet.

### 7.3 Accept a Payment

1. The receiver opens a pending payment addressed to them.
2. DebtSync clearly shows sender, receiver, amount, description, source, and creation time.
3. The receiver selects **Accept** and confirms the action.
4. DebtSync atomically changes the status from `pending` to `accepted` and sets `respondedAt`.
5. The accepted payment immediately contributes to derived balances.
6. The sender receives an in-app notification and a best-effort push notification.

### 7.4 Reject a Payment

1. The receiver opens a pending payment addressed to them.
2. The receiver selects **Reject**.
3. A rejection reason between 3 and 300 trimmed characters is required.
4. DebtSync atomically changes the status from `pending` to `rejected`, stores the reason, and sets `respondedAt`.
5. The payment never contributes to balances.
6. The sender receives the rejection notification and reason.

### 7.5 Cancel a Pending Payment

1. The original sender opens their pending payment.
2. The sender selects **Cancel payment** and confirms.
3. DebtSync atomically changes the status from `pending` to `cancelled` and sets `cancelledAt`.
4. The payment never contributes to balances.
5. The receiver is notified that the pending claim was withdrawn.

### 7.6 Reverse an Accepted Payment

1. The original receiver opens an accepted direct payment.
2. The receiver selects **Return full payment**.
3. DebtSync creates a new pending reversal payment with:
   - Sender equal to the original receiver
   - Receiver equal to the original sender
   - Amount equal to the original amount
   - `source = reversal`
   - `reversesTransferId` linked to the original payment
4. The original receiver is authenticated as the reversal sender and confirms that they are recording a return payment.
5. The original sender, now the reversal receiver, must accept the return payment before it affects balances.
6. Only one pending or accepted reversal may exist for one original payment. A rejected or cancelled reversal may be retried.
7. Reversal payments cannot themselves be reversed. A new direct payment must be used for any further correction.

### 7.7 View the Ledger

1. Any approved member opens the household ledger.
2. DebtSync shows obligations and payments in one chronological view.
3. Every row visibly identifies whether it is an obligation or payment and shows its accounting status.
4. Members may filter by member, entry type, payment status, and date range.
5. Opening a row shows source, direction, amount, timestamps, status, and related records.

---

## 8. Functional Requirements

### FR-01: Settlement Obligation Creation

- Every successfully settled month must create exactly one immutable `MonthlySettlementRun`, even when no transfer pairs are required.
- `MonthlySettlementRun.month` is the authoritative database-level marker that a month has been settled.
- Every newly created `MonthlySettlement` must create exactly one `DebtObligation` in the same transaction.
- The debtor, creditor, amount, and settlement month must match the source row exactly.
- Obligation creation must be idempotent by unique source reference and settlement relation.
- An obligation cannot be edited, cancelled, rejected, or deleted through the application.
- If obligation creation fails, the corresponding settlement transaction must fail rather than leave a partial handoff.

### FR-02: Historical Backfill

- The backfill must create exactly one `MonthlySettlementRun` for each distinct historical settlement month and link every source settlement row to it.
- A one-time idempotent backfill must create missing obligations for all existing settlement rows.
- Re-running the backfill must create zero duplicates.
- Backfilled records must use the original settlement's amount, direction, month, and settlement time.
- The script must report scanned, created, skipped, and failed counts.

### FR-03: Payment Creation

- Only an authenticated active member may create a payment.
- The authenticated user is always the sender; the client cannot override `senderId`.
- The receiver must be a different active approved member.
- Amount must be a valid positive decimal with at most two fractional digits.
- Description is optional, trimmed, and limited to 300 characters.
- `clientRequestId` must be a client-generated UUID and unique across transfers.
- Repeating the same request ID must return the previously created record rather than create a duplicate.
- New direct payments start as `pending` and have no balance effect.

### FR-04: Payment Response

- Only the payment receiver may accept or reject it.
- Only a `pending` payment may be accepted or rejected.
- Rejection requires a reason; acceptance must not store a rejection reason.
- State changes must use a conditional database update so concurrent responses cannot both succeed.
- A repeated request after a completed transition returns `409 Conflict` with the current payment state.

### FR-05: Cancellation

- Only the sender may cancel a payment.
- Only a `pending` payment may be cancelled.
- Accepted, rejected, and cancelled payments are terminal.
- Cancellation must be race-safe against receiver acceptance or rejection.

### FR-06: Reversal

- Only the original receiver may initiate a reversal of an accepted direct payment.
- A reversal is for the original full amount and opposite direction.
- The reversal remains a separate pending payment and has no effect until accepted.
- An original payment remains immutable and visible after reversal.
- At most one pending or accepted reversal may exist per original payment.
- A PostgreSQL partial unique index on `reversesTransferId` for `pending` and `accepted` rows must enforce this rule during concurrent requests.
- Reversal attempts are idempotent by `clientRequestId`.

### FR-07: Derived Balances

- Balances must be calculated from immutable obligations and accepted payments on every query.
- Pairwise totals must be antisymmetric: `pairwise(A,B) = -pairwise(B,A)`.
- The sum of all members' overall net positions must equal zero.
- All amount calculations and serialization must preserve two-decimal exactness.

### FR-08: Dashboard

- Show `You owe`, `Owed to you`, and signed `Net position` separately.
- Show one pairwise row for every member with whom the current user has a nonzero balance or pending payment.
- Show pending incoming actions before informational activity.
- Show recent obligations and payments in reverse chronological order.
- Provide clear links to send a payment, review pending payments, view the ledger, and open notifications.
- Never use color alone to communicate debt direction or payment status.

### FR-09: Shared Ledger

- All approved active members may read the complete ledger.
- The default order is newest first with deterministic ID tie-breaking.
- Results use cursor pagination with a default limit of 25 and maximum of 50.
- Filters must be reflected in the URL so views can be refreshed and shared within the authenticated application.

### FR-10: Notifications

- DebtSync must create a persistent in-app notification for every required financial event.
- Notifications belong only to their recipient and cannot be read or modified by another user.
- Creating the financial record and in-app notification occurs in one transaction.
- Push delivery occurs after commit and is best effort.
- Push failure updates delivery state but does not change the financial action.
- The sidebar or mobile navigation shows the current user's unread count.

### FR-11: Member Deactivation

- An admin cannot deactivate a member if any pairwise balance involving that member is nonzero.
- An admin cannot deactivate a member with any pending incoming or outgoing payment.
- The block response must identify the outstanding total and pending-action count without exposing secrets.
- Historical obligations and payments remain visible after eventual deactivation.

### FR-12: Auditability

- Obligations, accepted payments, rejected payments, cancelled payments, and reversals are retained permanently.
- Financial records are never hard-deleted through application APIs.
- Every state transition stores the responsible actor through sender/receiver ownership and transition timestamps.
- Server logs must include entity ID and transition name but must not log bank account numbers or push-subscription secrets.

---

## 9. State Models

### 9.1 Transfer State Machine

```text
created -> pending
pending -> accepted   (receiver only)
pending -> rejected   (receiver only, reason required)
pending -> cancelled  (sender only)
```

`accepted`, `rejected`, and `cancelled` are terminal states. Reversal never changes the original status.

### 9.2 Obligation Lifecycle

```text
MonthlySettlementRun committed
  -> zero or more MonthlySettlement rows
  -> exactly one DebtObligation per MonthlySettlement row
```

A settlement run and its rows are immutable. An obligation has no mutable workflow status. Whether its economic effect has been offset is visible through the current pairwise balance, not by mutating the source obligation.

---

## 10. Data Model

The following fields are the required logical Prisma design. Relation field names may follow existing repository conventions, but stored meanings and constraints must remain unchanged.

### 10.1 MonthlySettlementRun

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key |
| `month` | Date | Required and unique; first day of the settled month |
| `trigger` | `SettlementTrigger` | `manual`, `cron`, or `backfill` |
| `settledById` | User UUID, nullable | Admin actor for manual runs; null for cron and backfill |
| `settledAt` | Timestamp | Commit time; earliest source timestamp for historical backfill |

`MonthlySettlementRun` has zero or more `MonthlySettlement` rows. A run with zero rows is a valid settled zero-balance month.

Required indexes:

- Unique `(month)`
- `(settledAt)`

### 10.2 DebtObligation

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key |
| `debtorId` | User UUID | Required; differs from creditor |
| `creditorId` | User UUID | Required; differs from debtor |
| `amount` | Decimal(12,2) | Greater than zero |
| `source` | `DebtObligationSource` | Release 1 value: `meal_settlement` |
| `sourceReference` | String | Unique; `meal-settlement:<settlement-id>` |
| `monthlySettlementId` | UUID | Required and unique in Release 1 |
| `createdAt` | Timestamp | Original settlement time for backfill; commit time for new rows |

Required indexes:

- `(debtorId, createdAt)`
- `(creditorId, createdAt)`
- `(source, createdAt)`

### 10.3 Transfer

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key |
| `senderId` | User UUID | Authenticated creator for direct payment |
| `receiverId` | User UUID | Different active member |
| `amount` | Decimal(12,2) | Greater than zero |
| `description` | String, nullable | Maximum 300 trimmed characters |
| `status` | `TransferStatus` | `pending`, `accepted`, `rejected`, `cancelled` |
| `source` | `TransferSource` | Release 1: `direct`, `reversal` |
| `clientRequestId` | UUID string | Unique idempotency key |
| `reversesTransferId` | UUID, nullable | Original accepted direct payment |
| `rejectionReason` | String, nullable | Required only when rejected; 3-300 characters |
| `createdAt` | Timestamp | Server-generated |
| `respondedAt` | Timestamp, nullable | Set on accept or reject |
| `cancelledAt` | Timestamp, nullable | Set on cancellation |

Required indexes:

- `(senderId, status, createdAt)`
- `(receiverId, status, createdAt)`
- `(status, createdAt)`
- `(reversesTransferId)`
- Partial unique `(reversesTransferId)` where the value is non-null and status is `pending` or `accepted`

The partial unique index is a database requirement, not only an application pre-check, so concurrent reversal requests cannot both create active reversals.

### 10.4 DebtNotification

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key |
| `userId` | User UUID | Notification owner |
| `type` | `DebtNotificationType` | Event-specific enum |
| `entityType` | `DebtNotificationEntity` | `obligation` or `transfer` |
| `entityId` | UUID | Related entity identifier |
| `title` | String | Short display title |
| `body` | String | Concise event summary, no sensitive banking data |
| `readAt` | Timestamp, nullable | Null means unread |
| `pushStatus` | `PushDeliveryStatus` | `pending`, `sent`, `failed`, `skipped` |
| `pushAttemptedAt` | Timestamp, nullable | Last attempt time |
| `createdAt` | Timestamp | Server-generated |

Required indexes:

- `(userId, readAt, createdAt)`
- `(userId, createdAt)`
- `(entityType, entityId)`

### 10.5 Required Enum Values

```text
DebtObligationSource: meal_settlement
SettlementTrigger: manual, cron, backfill
TransferStatus: pending, accepted, rejected, cancelled
TransferSource: direct, reversal
DebtNotificationEntity: obligation, transfer
DebtNotificationType:
  obligation_created
  payment_received
  payment_accepted
  payment_rejected
  payment_cancelled
  reversal_received
  reversal_accepted
  reversal_rejected
  reversal_cancelled
PushDeliveryStatus: pending, sent, failed, skipped
```

### 10.6 Existing Model Changes

- Add nullable `runId` and a `run` relation to `MonthlySettlement` for the rollout; all new rows must require it in application logic.
- Add `obligation` as an optional one-to-one relation on `MonthlySettlement` to support migration before backfill completes.
- Add `@@unique([month, fromUserId, toUserId])` to `MonthlySettlement`.
- Add obligation, transfer, and debt-notification relations to `User` using explicit relation names for both sides.
- Add the optional manual-run actor relation from `MonthlySettlementRun` to `User`.
- Preserve the existing meal-reminder `NotificationDelivery` model; do not repurpose or delete it.

---

## 11. API Contract

All endpoints require an approved active session unless explicitly noted. Success responses use `{ "data": ... }`; failures use `{ "error": "...", "code": "..." }`. Decimal amounts are strings and timestamps are ISO 8601 strings.

### 11.1 `GET /api/debts/summary`

Returns the current member's dashboard data.

```json
{
  "data": {
    "youOwe": "1850.00",
    "owedToYou": "920.00",
    "net": "-930.00",
    "pendingIncomingCount": 1,
    "pendingOutgoingCount": 0,
    "unreadNotificationCount": 2,
    "pairwise": [
      {
        "memberId": "uuid",
        "memberName": "Abdullah",
        "avatarUrl": null,
        "position": "-930.00",
        "direction": "you_owe"
      }
    ],
    "recentActivity": []
  }
}
```

### 11.2 `GET /api/debts/ledger`

Query parameters:

- `memberId`: optional user UUID
- `type`: `all`, `obligation`, or `payment`; default `all`
- `status`: optional payment status
- `from`: optional `YYYY-MM-DD`
- `to`: optional `YYYY-MM-DD`
- `cursor`: optional opaque cursor
- `limit`: default 25, maximum 50

Returns a discriminated list of obligation and payment ledger entries plus `nextCursor`.

### 11.3 `GET /api/debts/obligations`

Query parameters:

- `memberId`: optional user UUID
- `month`: optional `YYYY-MM`
- `cursor`: optional opaque cursor
- `limit`: default 25, maximum 50

### 11.4 `GET /api/debts/payments`

Query parameters:

- `memberId`: optional user UUID
- `direction`: `all`, `incoming`, or `outgoing`
- `status`: optional transfer status
- `cursor`: optional opaque cursor
- `limit`: default 25, maximum 50

### 11.5 `POST /api/debts/payments`

Request:

```json
{
  "receiverUserId": "uuid",
  "amount": "850.00",
  "description": "July settlement payment",
  "clientRequestId": "client-generated-uuid"
}
```

Response: `201 Created` with the serialized pending payment. An idempotent retry returns `200 OK` with the same record.

### 11.6 `POST /api/debts/payments/[id]/respond`

Accept request:

```json
{ "decision": "accept" }
```

Reject request:

```json
{
  "decision": "reject",
  "reason": "I did not receive this payment."
}
```

Returns the updated payment. Invalid ownership returns `403`; a completed race returns `409` with current status.

### 11.7 `POST /api/debts/payments/[id]/cancel`

No request body. Only the pending payment's sender may call this endpoint.

### 11.8 `POST /api/debts/payments/[id]/reverse`

Request:

```json
{ "clientRequestId": "client-generated-uuid" }
```

Only the original payment receiver may call this endpoint. The server makes that authenticated user the reversal sender, derives the opposite direction and original amount, and returns the new pending reversal.

### 11.9 `GET /api/notifications/inbox`

Query parameters:

- `unreadOnly`: optional boolean
- `cursor`: optional opaque cursor
- `limit`: default 25, maximum 50

Returns only the authenticated user's notifications and unread count.

### 11.10 `PATCH /api/notifications/[id]/read`

Marks one notification owned by the current user as read. The operation is idempotent.

### 11.11 `POST /api/notifications/read-all`

Marks all unread DebtSync notifications owned by the current user as read.

### 11.12 Error Codes

Required stable codes:

```text
AUTH_REQUIRED
ACCOUNT_INACTIVE
MEMBER_NOT_FOUND
SELF_PAYMENT_NOT_ALLOWED
INVALID_AMOUNT
INVALID_DESCRIPTION
DUPLICATE_REQUEST_CONFLICT
PAYMENT_NOT_FOUND
PAYMENT_NOT_PENDING
PAYMENT_FORBIDDEN
REJECTION_REASON_REQUIRED
REVERSAL_NOT_ALLOWED
ACTIVE_REVERSAL_EXISTS
DEACTIVATION_BLOCKED_BY_DEBT
VALIDATION_ERROR
INTERNAL_ERROR
FEATURE_DISABLED
```

During rollout, disabled DebtSync mutation endpoints return `503` with `FEATURE_DISABLED`. The server-side mutation gate never disables the MealSync settlement-to-obligation handoff.

---

## 12. Permissions Matrix

| Action | Sender | Receiver | Other Member | Admin Not Involved |
|---|---:|---:|---:|---:|
| View shared ledger | Yes | Yes | Yes | Yes |
| Create direct payment | Yes | N/A | N/A | Yes, as self |
| Accept/reject payment | No | Yes | No | No |
| Cancel pending payment | Yes | No | No | No |
| Return an accepted direct payment | No | Yes | No | No |
| Edit/delete obligation | No | No | No | No |
| Edit/delete accepted payment | No | No | No | No |
| Read another user's notification | No | No | No | No |
| Deactivate a debt-free member | No | No | No | Existing admin only |

All authorization checks must occur on the server even when the interface hides unavailable actions.

---

## 13. Interface Requirements

### 13.1 Navigation

- Add **DebtSync** as a primary authenticated navigation destination at `/debts`.
- Add a notification bell with unread count to desktop and mobile authenticated layouts.
- Keep the existing MealSync brand and visual tokens; DebtSync is a module, not a separate landing page.

### 13.2 DebtSync Dashboard (`/debts`)

Required sections in order:

1. Compact summary strip: `You owe`, `Owed to you`, and `Net position`.
2. Pending actions: incoming confirmations first, then pending outgoing payments.
3. Pairwise balances with member identity and explicit text direction.
4. Recent activity combining obligations and payments.

Primary command: **Send Payment**.

Zero state: state that the household has no current debt and provide ledger access without celebratory or misleading financial claims.

### 13.3 New Payment (`/debts/payments/new`)

- Member selector with active members only and no self-option.
- Current pairwise position beside the selected member.
- Receiver's optional bKash/bank reference information, masked where appropriate.
- Decimal amount input with `BDT` label.
- Optional description and character count.
- Overpayment warning when applicable.
- Final confirmation step summarizing sender, receiver, and amount.
- Disable repeat submission while the request is active and reuse one client request ID for retries.

### 13.4 Payment Detail (`/debts/payments/[id]`)

- Direction, people, amount, description, status, source, and timestamps.
- Accept/reject controls only for the pending receiver.
- Cancel control only for the pending sender.
- Return-payment control only for the original receiver of an eligible accepted direct payment.
- Related original/reversal link when applicable.
- Rejection reason when rejected.
- Clear note that DebtSync records confirmation but does not send money.

### 13.5 Ledger (`/debts/ledger`)

- One filter bar for member, type, status, and date range.
- Visually distinct but consistent obligation and payment rows.
- Show human-readable direction such as `Rakin owes Abdullah` or `Rakin paid Abdullah`.
- Show source month for imported obligations.
- Show payment status as icon plus text, not color alone.
- Preserve stable dimensions while loading and paginating.

### 13.6 Notifications (`/notifications`)

- Unread-first inbox with chronological grouping.
- Mark one or all as read.
- Selecting a notification opens its related obligation or payment context.
- Notification copy must describe recorded activity, never imply that DebtSync moved money.

### 13.7 Responsive Behavior

- Desktop uses the existing sidebar and constrained content width.
- Mobile keeps primary summary, pending actions, and send-payment command in the first viewport.
- Tables become labeled stacked rows rather than horizontally clipped tables.
- Financial amounts and status controls must not overlap or truncate.
- Touch targets must be at least 44 by 44 CSS pixels.
- Confirmation and rejection actions require deliberate taps and cannot be preselected.

### 13.8 Accessibility and Content

- Use semantic headings, labels, buttons, and status text.
- Maintain visible keyboard focus and full keyboard operation.
- Do not communicate positive/negative balances by red/green alone.
- Use precise copy: `Record payment`, `Accept payment`, `Reject payment`, `You owe`, and `Owed to you`.
- Never use `Paid` for a pending claim.
- Dates and amounts must use the same formatting utilities throughout the module.

---

## 14. Notification Rules

| Event | Recipient | In-App | Push |
|---|---|---:|---:|
| MealSync obligation created | Debtor and creditor | Yes | Yes |
| Direct payment created | Receiver | Yes | Yes |
| Payment accepted | Sender | Yes | Yes |
| Payment rejected | Sender | Yes | Yes |
| Payment cancelled | Receiver | Yes | Yes |
| Return payment created | Original sender, now reversal receiver | Yes | Yes |
| Reversal accepted/rejected/cancelled | Other involved member | Yes | Yes |

Push rules:

- Skip push cleanly when VAPID configuration or an active subscription is unavailable.
- Mark permanently invalid subscriptions inactive using the existing push utility behavior.
- Never include bank account numbers, phone numbers, or private push keys in push content.
- Deep links must lead to an authenticated DebtSync route.

---

## 15. Validation and Edge Cases

- **Duplicate click or network retry:** unique `clientRequestId` returns the existing payment.
- **Manual settlement and cron race:** the unique `MonthlySettlementRun.month` constraint selects one winner; the losing request returns already settled.
- **Zero balance household:** create the month-level settlement run, but do not fabricate settlement, obligation, or payment rows.
- **Overpayment:** warn, allow, and let the accepted event reverse pairwise direction.
- **Opposing historical obligations:** net them through the formula without deleting source rows.
- **Partial payment:** reduce pairwise debt by the accepted amount only.
- **Receiver deactivated after creation:** deactivation must have been blocked while payment was pending, so this should not occur through valid application behavior.
- **Concurrent accept and cancel:** only one conditional update succeeds; the loser receives `409`.
- **Push failure:** keep the financial action committed and record failed delivery state.
- **Missing payment details:** allow payment recording; show `Not provided` for bKash/bank reference.
- **Historical member deactivation:** keep their name, obligations, payments, and balances visible in history.
- **Existing duplicate settlement pairs:** migration preflight must report and stop before adding the unique constraint.
- **Reversal rejected or cancelled:** original accepted payment remains effective; another reversal attempt may be created.

---

## 16. Security, Privacy, and Reliability

- Use the existing Auth.js session and `requireAuth` server helper.
- Re-read relevant database state inside every financial mutation; never trust client-supplied status or actor IDs.
- Use Prisma transactions for financial record plus persistent notification creation.
- Use conditional `updateMany` or equivalent status predicates for race-safe state transitions.
- Payment creation and member deactivation must both use serializable transactions with bounded retry. Both must re-read user status and pending-transfer state inside the transaction so neither can commit an invalid race outcome.
- Do not expose push-subscription keys through API responses.
- Do not log full bank accounts, phone numbers, or request payloads containing sensitive contact data.
- Keep financial history permanently unless a future documented retention policy supersedes this PRD.
- Use database constraints as a second layer beneath application validation.
- Keep user-facing navigation behind `NEXT_PUBLIC_DEBTSYNC_ENABLED` and user-initiated DebtSync mutations behind the server-only `DEBTSYNC_MUTATIONS_ENABLED` rollout flag. Settlement obligation creation is never controlled by the mutation flag.
- Return generic `500` responses while logging entity IDs and safe diagnostic context server-side.
- Rate-limit payment creation and response endpoints if infrastructure support is added; authorization and idempotency remain mandatory regardless.

---

## 17. Acceptance Criteria

Release 1 is accepted only when all of the following are true:

1. A new MealSync settlement run, settlement rows, and obligations commit atomically.
2. Every historical settlement has exactly one obligation after backfill.
3. Dashboard figures match an independently calculated fixture ledger.
4. Pairwise balances are equal and opposite for every member pair.
5. Household overall nets sum to exactly `0.00`.
6. Pending, rejected, and cancelled payments do not affect balances.
7. Accepted payments and accepted reversals affect balances exactly once.
8. Sender, receiver, other-member, inactive-user, and admin permission tests pass.
9. Double submission and concurrent response tests cannot create duplicate effects.
10. In-app notification creation is transactional and push failure is non-blocking.
11. Debt-aware deactivation blocks users with nonzero balances or pending payments.
12. Desktop and mobile interfaces support the complete payment-confirmation workflow.
13. Existing MealSync automated tests pass without regression.
14. Production backfill totals are reviewed before the DebtSync navigation is enabled.
15. Concurrent reversal creation cannot produce more than one pending or accepted reversal for an original payment.
16. A zero-transfer month is permanently marked settled exactly once.

---

## 18. Future Compatibility

Release 1 must leave the following enum extensions and source relationships possible without changing its accounting principles:

- Money requests create a pending payment but never directly affect balances.
- Confirmed group-expense participant shares create obligations.
- Smart settlement produces suggestions only; accepted payments remain the only payment events that affect balances.
- A future multi-household version would require a household entity and tenant scoping across all financial records. It is not part of this release and must not be partially introduced now.

---

## 19. Final Product Principle

**MealSync calculates authoritative household obligations. DebtSync records confirmed payment reality. Neither system treats a claimed payment as completed until the receiver accepts it.**
