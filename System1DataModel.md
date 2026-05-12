# Household Meal & Expense Management System
## System 1 — Complete Data Model
*Database-Agnostic Entity Design | Draft v1.1 | User entity updated*

---

## 1. System Overview

This document defines the complete data model for System 1 of the household management application. System 1 covers meal tracking, bazar expenses, maid charges, bulk item lifecycle, and monthly settlement calculations.

System 2 (money management and debt tracking) is a separate future scope. The monthly settlement output of System 1 feeds into System 2 as a debt entry.

### Core Accounting Philosophy

Every transaction reflects one of two directions: contribution (bazar) or consumption (meals, maid, bulk items). The net balance is always derived — never stored — from the sum of all transactions.

### Formula Definitions

| Formula | Definition |
|---|---|
| Meal Rate | Total bazar spending for month / Total meals taken by all members that month |
| User Meal Cost | Meal rate x meals taken by user |
| User Monthly Expense | Meal cost + Maid fixed charge + Fridge bill + Bulk item allocation |
| Net Balance | Bazar contributions + Maid payments + Fridge payments + Bulk payments - Meal costs - Maid charges - Fridge bills - Bulk allocations |

> **Note:** Net balance is always derived at query time. It is never stored as a field. Positive balance = member is owed money. Negative balance = member owes money.

### Key Design Principles

- Database-agnostic — no database-specific types or syntax used.
- All primary keys are UUIDs.
- All monetary values are Decimal to avoid rounding errors.
- All dates use Date type (YYYY-MM-DD). All timestamps use Timestamp type (datetime with timezone).
- Month references always use the first day of the month e.g. 2024-11-01 for November 2024.
- Derived values (balances, leaderboard counts, meal rates) are computed at query time — not stored.
- Historical records are never deleted — accounts are deactivated, records remain.

---

## 2. Entity List

| # | Entity | Purpose |
|---|---|---|
| 1 | User | All household members and admins |
| 2 | MembershipRequest | Pending join requests awaiting admin approval |
| 3 | MealPattern | Each user's default weekly meal schedule |
| 4 | MealRecord | Daily actual or planned meal count per user |
| 5 | MealEditRequest | Post-deadline meal edit permission requests |
| 6 | BazarTrip | Active bazar trip with assignees and shopping notes |
| 7 | BazarExpense | A member's spending record for a completed trip |
| 8 | BulkItem | Catalogue of trackable bulk items (Gas, Rice) |
| 9 | BulkCycle | One lifecycle of a bulk item from purchase to finish |
| 10 | BulkAllocation | Per-member cost share posted when a cycle closes |
| 11 | MaidCharge | Monthly fixed maid fee deducted per active member |
| 12 | MaidPayment | Records who physically paid the maid on behalf of group |
| 13 | FridgeBill | Monthly fridge electricity bill split equally among members |
| 14 | FridgePayment | Records who physically paid the fridge bill on behalf of group |
| 15 | MonthlySettlement | Month-end settlement output — who owes whom |
| 16 | SystemConfig | Global admin-controlled settings, single row |

---

## 3. Entity Definitions

### 1. User

Represents every person in the household system — both regular members and admins. Authentication is via Google OAuth only; no passwords are stored.

> **UPDATED** — New contact and banking fields added in v1.1

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email | String, unique | Gmail address from Google OAuth |
| name | String | Display name from Google profile |
| nickname | String, nullable | Preferred display name for UI |
| avatar_url | String, nullable | Profile photo URL from Google, optional |
| role | Enum: member, admin | Multiple admins allowed |
| status | Enum: active, deactivated | No pending state — pending lives in MembershipRequest |
| joined_at | Timestamp | Set when admin approves the membership request |
| deactivated_at | Timestamp, nullable | Set when admin deactivates the account |
| phone_number | String, nullable | Primary local phone number, for contact |
| phone_number_2 | String, nullable | Optional secondary phone number |
| bkash_number | String, nullable | bKash mobile banking number — often same as phone but not always |
| bank_name | String, nullable | e.g. AB Bank, Dutch Bangla |
| bank_account_number | String, nullable | For direct bank transfers |
| emergency_contact_name | String, nullable | Full name of the emergency contact person |
| emergency_contact_phone | String, nullable | Phone number of the emergency contact |
| emergency_contact_relation | String, nullable | Relationship to member e.g. Father, Spouse, Brother |

#### New Fields — Design Notes (v1.1)

- **phone_number vs bkash_number** — kept separate; bKash numbers frequently differ from the calling SIM.
- **bank_name + bank_account_number** — free-text bank_name accommodates any bank without a separate reference table.
- **phone_number_2** — nullable secondary number for members with a work SIM and a personal SIM.
- **Emergency contact** — split into three fields (name, phone, relation) rather than a free-text blob, making it actionable in the UI.
- All new fields are nullable — existing member rows are unaffected; completion is a profile step.

#### Business Rules

- A User row is created only when a MembershipRequest is approved — not at sign-up.
- Deactivation cancels all future scheduled meals (MealRecord.meal_count set to 0) from the next day onwards.
- Deactivated members are excluded from maid charges from the following month.
- Deactivated members are still included in BulkAllocation for any open cycle they had meals in.
- Multiple admins are allowed. Any admin can approve members, manage settings, and grant edit permissions.

#### Constraints

- email must be unique across all Users.
- joined_at is non-nullable — a User without an approval date should not exist.
- No uniqueness constraint on phone_number or bkash_number — two members may share a family number.
- bank_account_number has no uniqueness constraint — duplication warnings are enforced at the application layer only.

---

### 2. MembershipRequest

Holds the state of a person's request to join the household system before they become a User.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| email | String | Gmail address from Google OAuth at time of request |
| name | String | Display name from Google profile |
| avatar_url | String, nullable | Profile photo from Google, optional |
| status | Enum: pending, approved, rejected | Admin sets this |
| requested_at | Timestamp | When the person first signed up via Google |
| reviewed_at | Timestamp, nullable | When the admin made the decision |
| reviewed_by | UUID -> User, nullable | Which admin approved or rejected |
| user_id | UUID -> User, nullable | Populated only when status = approved |

#### Business Rules

- On approval: a User row is created and user_id is linked back here.
- Rejected requests are kept permanently for audit and to detect repeat attempts.
- reviewed_by tracks which admin made the call since multiple admins are possible.

#### Constraints

- user_id is null for pending and rejected requests; non-null only for approved.

---

### 3. MealPattern

Stores each user's default weekly meal schedule. One row per user, updated in place whenever the user changes their default. No history is kept — past meal history lives in MealRecord.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID -> User | Owner — one row per user always |
| monday | Integer | Default meal count for Monday, 0 or more |
| tuesday | Integer | Default meal count for Tuesday, 0 or more |
| wednesday | Integer | Default meal count for Wednesday, 0 or more |
| thursday | Integer | Default meal count for Thursday, 0 or more |
| friday | Integer | Default meal count for Friday, 0 or more |
| saturday | Integer | Default meal count for Saturday, 0 or more |
| sunday | Integer | Default meal count for Sunday, 0 or more |
| updated_at | Timestamp | When this pattern was last changed |

#### Business Rules

- When a user changes their default pattern, this row is updated in place — not replaced.
- When updated, the system auto-fills all future MealRecord rows for the current month from today onwards with the new counts.
- Past MealRecord rows are never touched when the pattern changes.
- A MealPattern row is created for a user at the time their membership is approved.

#### Constraints

- user_id must be unique — exactly one pattern row per user.
- All day fields must be 0 or greater. Negative values are not allowed.

---

### 4. MealRecord

The daily meal log — one row per user per day. Future dates are pre-filled from MealPattern. Past dates are the actual record and are locked after the day ends.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID -> User | Which member |
| date | Date | The specific day this record is for |
| meal_count | Integer | Number of meals taken or planned that day |
| is_locked | Boolean | True once the day has ended — permanent lock |

#### Business Rules

- Future dates are pre-filled automatically from the user's MealPattern when the month begins or when the pattern changes.
- A meal record can only be edited on that exact day — before the deadline freely, or after the deadline with admin-granted permission via MealEditRequest.
- Once the day ends (midnight), is_locked = true permanently. No override exists for past days.
- When a user deactivates, all future MealRecord rows (from tomorrow onwards) are set to meal_count = 0.
- Deactivated users do not appear in the daily meal dashboard.
- The dashboard shows: each active member's name, their meal_count for today, and the total.

#### Constraints

- user_id + date must be unique — one record per user per day.
- meal_count must be 0 or greater.

---

### 5. MealEditRequest

When a user wants to edit today's meal count after the daily deadline has passed, they submit a request. The admin approves or rejects. If approved, the user performs the edit themselves.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID -> User | Who is requesting the edit |
| meal_record_id | UUID -> MealRecord | Always today's MealRecord for this user |
| status | Enum: pending, approved, rejected | Admin sets this |
| requested_at | Timestamp | When the request was submitted |
| reviewed_by | UUID -> User, nullable | Which admin approved or rejected |
| reviewed_at | Timestamp, nullable | When the decision was made |

#### Business Rules

- A MealEditRequest always references today's MealRecord — never a past day.
- At midnight, any pending request for that day becomes irrelevant and is auto-closed as expired.
- Once approved, the user edits MealRecord.meal_count directly. The request is not updated further.
- The admin grants permission only — they do not perform the edit themselves.

#### Constraints

- meal_record_id must always point to a MealRecord whose date = today.

---

### 6. BazarTrip

Represents a single active bazar run from the moment it is triggered until an expense entry is submitted. Only one trip can be open at a time.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| triggered_by | UUID -> User | Who triggered this trip |
| assignee_1 | UUID -> User, nullable | First suggested member (lowest visit count) |
| assignee_2 | UUID -> User, nullable | Second suggested member (second lowest visit count) |
| shopping_notes | Text, nullable | Shared live text box — cleared when trip completes |
| status | Enum: open, completed | Completed the moment a BazarExpense is submitted |
| triggered_at | Timestamp | When the trip was triggered |
| completed_at | Timestamp, nullable | When the expense entry was submitted |

#### Business Rules

- Any member can trigger a trip at any time.
- Suggestion logic is visit-count based only — the 2 members with the fewest completed BazarExpense entries are suggested.
- Assignment is a suggestion only — any member can actually go and submit the expense.
- Being assigned does NOT increment the visit count. Only submitting a BazarExpense does.
- shopping_notes is a live shared text field. Any member can write or overwrite it. It is cleared automatically when the trip completes.
- When a BazarExpense is submitted, this trip's status => completed, completed_at is set, and shopping_notes is cleared in the same operation.
- SystemConfig.active_trip_id points to the currently open trip. It is cleared when the trip completes.

#### Constraints

- Only one BazarTrip with status = open may exist at any time.

---

### 7. BazarExpense

Records a member's spending for a completed bazar trip. Submitting this entry completes the linked BazarTrip. A member can only record their own expense.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID -> User | Who actually went and spent — always the logged-in user |
| trip_id | UUID -> BazarTrip | Which trip this expense closes |
| amount | Decimal | Amount spent in taka — can be zero |
| note | String, nullable | Optional context e.g. what was bought |
| date | Date | Real-world date of the bazar run. Defaults to today. Backdatable within current month only. |
| submitted_at | Timestamp | When the record was entered into the system |

#### Business Rules

- A zero amount entry is valid — the member went but spent nothing. Still counts as a visit.
- Submitting a BazarExpense automatically marks the linked BazarTrip as completed.
- Visit count is always derived by counting BazarExpense rows per user — never stored separately.
- Bazar spending leaderboard is derived by summing BazarExpense.amount per user.
- If a member forgot to record and the bazar date was last month, the date is forced to today — no prior-month backdating.
- date = when the run actually happened; submitted_at = when it was entered into the system.

#### Constraints

- A member cannot submit a BazarExpense for another user — user_id must always equal the authenticated user.
- amount must be 0 or greater.
- date cannot be in a prior month.

---

### 8. BulkItem

The catalogue of trackable bulk item types. A simple reference table. Currently expected to have two entries: Gas and Rice. Any member can add new item types.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String, unique | e.g. Gas, Rice |
| unit | String, nullable | Display unit e.g. cylinder, kg — for UI only, not used in calculations |
| created_at | Timestamp | When this item type was added |

#### Business Rules

- BulkItem is a stable catalogue. Each purchase creates a BulkCycle row pointing to this item.
- Any member can add a new item type — not restricted to admins.
- unit is display-only. No calculation depends on it.

#### Constraints

- name must be unique.

---

### 9. BulkCycle

Tracks the full lifecycle of one bulk item purchase — from when the previous item ran out (started_at) until this one is marked finished.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| bulk_item_id | UUID -> BulkItem | Which item type this cycle covers |
| purchased_by | UUID -> User | Who bought it |
| cost | Decimal | Total purchase price in taka |
| purchase_date | Date | When it was physically bought — any date, for audit only |
| status | Enum: active, finished | Finished when any member marks it done |
| started_at | Timestamp | Auto-set when the previous cycle is marked finished |
| finished_at | Timestamp, nullable | When any member marked this cycle as done |
| finished_by | UUID -> User, nullable | Who marked it finished |

#### Business Rules

- A bulk purchase is NOT included in BazarExpense — recorded here separately to keep it out of the meal rate calculation.
- started_at is system-set, not user-input. It represents when the household actually started consuming this item.
- purchase_date is user-input and purely for reference. Any date is allowed with no backdating restriction.
- Any member can mark a cycle as finished.
- When a cycle is marked finished: status => finished, finished_at and finished_by are set, BulkAllocation rows are created immediately.
- Deactivated members who had meals during the cycle period are still included in allocation.

#### Constraints

- Only one BulkCycle with status = active may exist per BulkItem at any time.
- A new cycle for an item cannot begin until the previous one is marked finished.

---

### 10. BulkAllocation

Per-member cost share created automatically and immediately when a BulkCycle is marked finished.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| cycle_id | UUID -> BulkCycle | Which cycle this allocation belongs to |
| user_id | UUID -> User | Which member is being charged |
| meals_during_cycle | Integer | Snapshot of meals this member took during the cycle period |
| amount | Decimal | Calculated cost share: (cycle cost / total cycle meals) x this member's meals |
| allocated_at | Timestamp | When the allocation was posted |

#### Business Rules

- Allocation formula: Cost per meal = BulkCycle.cost / total meals of all members during cycle. User allocation = cost per meal x user's meals.
- meals_during_cycle is a snapshot taken at allocation time, not a live reference.
- amount is also stored as a snapshot — not recalculated later.
- Allocation is posted immediately when the cycle closes — not at month end.
- Meal edits cannot affect a closed cycle's allocation because edits are only permitted on the current day.
- Deactivated members with meals during the cycle period still receive an allocation row.

#### Constraints

- user_id + cycle_id must be unique — one allocation per member per cycle.

---

### 11. MaidCharge

The monthly fixed maid fee applied to each active member. It is a separate line item — not blended into the meal rate.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID -> User | Which member is being charged |
| amount | Decimal | Fixed charge for this member for this month. Defaults to SystemConfig.maid_charge_default |
| month | Date | First day of the month this charge applies to e.g. 2024-11-01 |
| applied_at | Timestamp | When the charge was posted |

#### Business Rules

- Maid charge does not depend on meal count — it is a flat fee per active member.
- Deactivated members do not receive a MaidCharge.
- The amount is stored at posting time from SystemConfig.maid_charge_default. Changes to the default do not affect already-posted charges.
- Admin can set a custom amount per member per month if needed, overriding the default.

#### Constraints

- user_id + month must be unique — one charge row per member per month.

---

### 12. MaidPayment

Records when one member physically pays the maid on behalf of the whole group.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| paid_by | UUID -> User | Who physically paid the maid |
| amount | Decimal | Total amount paid e.g. 3500 for 5 members at 700 each |
| month | Date | Which month this payment covers e.g. 2024-11-01 |
| note | String, nullable | Optional context |
| paid_at | Timestamp | When this was recorded |

#### Business Rules

- The member who pays the full maid bill gets +amount credited to their balance.
- Each member's individual MaidCharge of 700 is already deducting from their balance separately.
- The paying member is owed (total paid - own share) from the rest of the group, which surfaces naturally in the monthly settlement.
- MaidPayment is kept separate from BazarExpense to prevent maid costs from corrupting the meal rate calculation.
- Any member can record a MaidPayment.

---

### 13. FridgeBill

Records the monthly fridge electricity bill for a previous month. Split equally among all members active at any point during the bill month.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| month | Date | First day of the month the bill is FOR e.g. 2024-11-01. Always a past month. |
| total_amount | Decimal | Full electricity cost in taka |
| per_member_amount | Decimal | Snapshot: total_amount ÷ active member count during bill month. Frozen, never recalculated. |
| member_count_snapshot | Integer | How many members were included in the split. Audit field. |
| recorded_by | UUID -> User | Which member recorded this bill |
| recorded_at | Timestamp | When the bill was entered into the system |

#### Business Rules

- Any member can record a FridgeBill.
- per_member_amount is calculated once at posting time by counting all User rows active at any point during the bill month — includes members who deactivated during or after that month.
- Identical behaviour to BulkAllocation for deactivated members.
- per_member_amount is a frozen snapshot — never recalculated after posting.
- Only one FridgeBill allowed per month — block duplicates at application layer.
- Cannot post a bill for the current or a future month.
- FridgeBill cost never enters the meal rate formula.

#### Constraints

- month must be unique — one bill per month ever.
- total_amount must be greater than 0.
- month must always be a past month.

---

### 14. FridgePayment

Records when a member pays the fridge bill on behalf of the group. Mirrors MaidPayment exactly.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| bill_id | UUID -> FridgeBill | Which bill this payment covers |
| paid_by | UUID -> User | Who physically paid the fridge bill |
| amount | Decimal | Amount paid in taka |
| month | Date | Same month as the linked FridgeBill, for balance query convenience |
| paid_at | Timestamp | When this was recorded |

#### Business Rules

- Paying member receives +amount credit to their balance.
- Each member already carries their per_member_amount debit via FridgeBill.
- The paying member is owed (total paid - own share) from the rest of the group, which surfaces naturally in monthly settlement.
- FridgePayment is kept separate from BazarExpense to prevent bill costs from corrupting the meal rate calculation.
- Any member can record a FridgePayment.
- A FridgePayment can only be recorded after a FridgeBill exists for that month.

#### Constraints

- amount must be greater than 0.
- bill_id must reference an existing FridgeBill.

---

### 15. MonthlySettlement

The output of the end-of-month settlement calculation. Records who owes whom from the shared meal/expense system. This data is exported to System 2 as debt entries.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| month | Date | First day of the month being settled |
| from_user_id | UUID -> User | Member who owes money |
| to_user_id | UUID -> User | Member who is owed money |
| amount | Decimal | Amount to be transferred |
| settled_at | Timestamp | When this settlement was calculated and posted |

#### Business Rules

- Smart settlement minimises the number of transfers: match largest debtor with largest creditor, transfer minimum needed to reduce one to zero, repeat until all balances zero.
- Each debtor-creditor pair becomes one MonthlySettlement row. For 6 members the maximum is 5 rows per month.
- MonthlySettlement rows are permanent snapshots. They cannot be recalculated or deleted.
- A month can only be settled once. Attempting to settle an already-settled month is blocked at the application layer.
- After settlement, these amounts are exported to System 2 where the actual money movement is tracked.

#### Constraints

- month must be unique across all settlement runs — one settlement per month, ever.
- from_user_id and to_user_id must be different.

---

### 16. SystemConfig

Global system settings managed by admins. There is always exactly one row in this table.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| meal_deadline | Time | Daily cutoff time for meal edits e.g. 22:00. Applies every day. |
| maid_charge_default | Decimal | Default monthly maid fee per member e.g. 700. |
| active_trip_id | UUID -> BazarTrip, nullable | Currently open bazar trip. Set when trip triggered. Cleared when expense submitted. |
| updated_at | Timestamp | When settings were last changed |
| updated_by | UUID -> User, nullable | Which admin made the last change |

#### Business Rules

- meal_deadline is a Time type (time of day only, no date). It applies to every calendar day.
- maid_charge_default is the fallback value used when generating monthly MaidCharge rows. Changing it does not affect already-posted charges.
- active_trip_id is the live state of the current bazar trip.
- updated_by tracks which admin last touched the config since multiple admins are possible.

#### Constraints

- This table must always contain exactly one row.

---

## 4. Entity Relationship Summary

| Entity | References | Relationship |
|---|---|---|
| MembershipRequest | User (reviewed_by, user_id) | Many requests -> reviewed by one admin. One approved request -> one User. |
| MealPattern | User (user_id) | One pattern per user (1:1). |
| MealRecord | User (user_id) | Many records per user, one per day (1:many). |
| MealEditRequest | User (user_id, reviewed_by), MealRecord | Many requests per user. Each request -> one MealRecord (today only). |
| BazarTrip | User (triggered_by, assignee_1, assignee_2) | One open trip at a time. Trip references up to 3 users. |
| BazarExpense | User (user_id), BazarTrip (trip_id) | One expense per trip (completing it). Many expenses per user over time. |
| BulkCycle | BulkItem, User (purchased_by, finished_by) | Many cycles per BulkItem over time. One active cycle per item. |
| BulkAllocation | BulkCycle, User | One allocation per user per cycle. Many allocations per cycle. |
| MaidCharge | User (user_id) | One charge per user per month. |
| MaidPayment | User (paid_by) | Many payments per user over time. |
| FridgeBill | User (recorded_by) | One bill per month. Recorded by one member. |
| FridgePayment | User (paid_by), FridgeBill | Many payments can reference one bill. |
| MonthlySettlement | User (from_user_id, to_user_id) | Many rows per month (one per debtor-creditor pair). |
| SystemConfig | User (updated_by), BazarTrip (active_trip_id) | Single row. References active trip and last admin who updated. |

---

## 5. Key Business Rules Summary

### Meal System

- Default pattern is day-of-week based (Mon-Sun), each day stores a meal count (0 or more).
- Changing the default pattern auto-updates all future MealRecord rows for the current month from today onwards. Past records are never touched.
- A meal record can only be edited on that exact calendar day — before the deadline freely, or after the deadline with admin permission via MealEditRequest.
- Once the day ends (midnight), is_locked = true. This is a hard, permanent lock. No admin override exists for past days.
- MealEditRequest auto-expires at midnight if still pending.
- If a user forgets to cancel a meal and it is cooked, the cost stays with them.

### Bazar System

- Only one BazarTrip can be open at a time.
- Suggestion logic is visit-count based: the 2 members with the fewest BazarExpense entries are suggested. Being assigned never changes the count.
- Assignment is a suggestion only — any member can submit the expense and close the trip.
- A zero-amount BazarExpense is valid (went but spent nothing) and increments the visit count.
- A member cannot record a BazarExpense for another member.
- BazarExpense.date can be backdated within the current month. Prior-month backdating is blocked.

### Bulk Item System

- Bulk item cost is never blended into the meal rate — it is always a separate allocation.
- Only one BulkCycle per BulkItem can be active at a time.
- A new cycle starts automatically (started_at is set) when the previous one is marked finished.
- Any member can mark a cycle as finished.
- BulkAllocation is posted immediately on cycle close — not at month end.
- Deactivated members with meals during the cycle period are still allocated their share.

### Maid System

- Maid charge is a flat fee per active member per month — completely independent of meal count.
- The default charge comes from SystemConfig.maid_charge_default (e.g. 700 taka).
- Deactivated members are not charged for months where they are deactivated for the full month.
- MaidPayment records who paid the maid on behalf of the group. The paying member gets a balance credit.

### Fridge Bill System

- FridgeBill covers the previous month — never the current or future month.
- per_member_amount is calculated once at posting time and never recalculated.
- Deactivated members are included if active at any point during the bill month.
- FridgePayment mirrors MaidPayment — payer gets credit, all members carry their share as debit.
- FridgeBill cost never enters the meal rate formula.

### Member Lifecycle

- A person signs up via Google -> MembershipRequest is created (pending).
- Admin approves -> User row is created, MembershipRequest.user_id is linked.
- Admin rejects -> MembershipRequest stays as a rejected record for audit.
- Member deactivates -> future MealRecords set to 0, excluded from new MaidCharges, still in open BulkCycle allocations.
- Admin deactivates the account only after all balances are settled.

### Settlement

- A month can only be settled once.
- Smart settlement minimises total transactions: match largest debtor with largest creditor, transfer minimum needed, repeat until all balances zero.
- MonthlySettlement rows are permanent snapshots — never recalculated or deleted.
- Settlement output is exported to System 2 as debt entries.

---

*Household Meal & Expense Management System | System 1 Data Model | Database-Agnostic | 16 Entities | Draft v1.2 | User entity updated with contact & banking fields; FridgeBill and FridgePayment entities added*