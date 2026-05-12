# Shared Meal & Expense Management System
## Consolidated Requirements Document — Updated
*Incorporates all design decisions, clarifications, and rule changes*

| Field | Detail |
|---|---|
| Project Type | Household meal, bazar, and expense management |
| Primary Purpose | Replace manual spreadsheet tracking with automated shared accounting |
| Core Logic | Bazar = contribution \| Meal = consumption |
| Scope | Single household group, fewer than 10 members |
| Platform | Web application, browser-based |
| Authentication | Google Gmail sign-in with admin approval |
| Architecture | System 1: Meal & Expense \| System 2: Money Management (future scope) |
| AI Features | Shopping Assistant, Anomaly Detection, Data Analyst (post System 2) |

---

## 1. Project Overview

The application is designed for a single household group — generally 5 to 6 members, always fewer than 10 — who share meal expenses, bulk goods, bazar duty, and monthly household charges. The system replaces a manual spreadsheet process and formalises the rules the group already follows, automating calculations while keeping the real-world workflow intact.

The system is not a generic accounting platform. It is a domain-specific household management tool built around the exact way the group operates: a maid cooks, members record meals, members go to bazar, and certain costs such as gas and rice are tracked across multiple months until the resource is finished.

### System Architecture

The application is split into two systems with a clear handoff point:

| System | Scope | Status |
|---|---|---|
| System 1 — Meal & Expense | Meal tracking, bazar, maid charges, bulk items, monthly settlement | Current scope |
| System 2 — Money Management | Debt tracking, personal transfers, money requests, settlement of System 1 debts | Future scope |

At the end of each month, System 1 calculates who owes whom from the shared expense pool and exports this as structured debt entries into System 2. System 1 balance resets for the new month. System 2 carries all debts forward indefinitely and tracks their resolution.

---

## 2. Core Accounting Philosophy

Bazar represents what a person contributed to the system. Meals and shared costs represent what a person consumed. Every transaction reflects one of these two directions.

### Balance Formula — System 1

| Component | Effect | Reason |
|---|---|---|
| Bazar expense entry | + credit | User contributed money to the shared system |
| Meal cost allocated | - debit | User consumed shared food |
| Maid charge applied | - debit | Fixed monthly household cost per member |
| Bulk item allocation | - debit | User consumed a share of a bulk item |
| Maid payment on behalf of group | + credit | User paid the maid for the whole group |

- **Net Balance** = Bazar contributions + Maid payments made + Bulk purchases made - Meal cost - Maid charge - Bulk item allocations. Always derived at query time, never stored. Positive = member is owed money. Negative = member owes money.
- Money sent and received between members belongs to System 2 only and does not affect the System 1 balance.

---

## 3. Expense Calculation Formulas

### 3.1 Meal Rate

```
Meal Rate = Total bazar spending for the month / Total meals taken by all members that month
```

### 3.2 Per-User Monthly Expense

```
User Total Expense = (Meal rate x meals taken by user) + Maid fixed charge + Bulk item allocation
```

### 3.3 Important Distinctions

- Maid cost is a fixed charge per member — not proportional to meal count and not blended into the meal rate.
- Bazar spending alone drives the meal rate. Maid and bulk costs are completely separate line items.
- Bulk item cost is allocated immediately when a cycle closes — not at month end and not in the meal rate.
- A bulk purchase is recorded separately from bazar expenses to keep it out of the meal rate formula.

### 3.4 Bulk Item Allocation Formula

```
Cost per meal = Bulk item total cost / Total meals by all members during the entire cycle
User allocation = Cost per meal x meals taken by that user during the cycle
```

---

## 4. People, Roles, and Permissions

### 4.1 Member Joining

- Any person signs up using their Gmail account via Google OAuth. No passwords are stored.
- After sign-up, a MembershipRequest is created in pending state. The person does not yet have a User account.
- An admin reviews the request and approves or rejects it.
- On approval, a User account is created and the person gains full access.
- Rejected requests are retained permanently for audit purposes.

### 4.2 Member Leaving

- When a member deactivates, all future scheduled meal records are immediately set to 0 from the next day onwards.
- From the following month, the deactivated member is not charged the maid fee.
- If a member deactivates before a month starts and stays deactivated all month, they are charged neither maid fee nor meal costs for that month.
- Bulk item charges still apply: meals taken during any open cycle at time of deactivation are counted in the final allocation when the cycle closes.
- A departing member's account remains active until all balances are settled. Admin deactivates the account only after full resolution.

### 4.3 Roles

| Role | Permissions |
|---|---|
| Regular Member | Record own meals, record own bazar spending, record maid payment, view balances and reports, trigger bazar trip, edit shopping notes, add bulk item type, record bulk purchase, mark bulk cycle as finished |
| Admin | All member permissions + set and change daily meal deadline + approve or reject membership requests + grant post-deadline meal edit permission + change maid charge default + deactivate member accounts + run month-end settlement |

- Multiple admins are allowed. Any number of admin accounts can exist. Any admin can perform all admin actions.
- Design intent: admin is a lightweight permission gate. The normal flow is user-driven. Admin intervention occurs only for rule exceptions.

---

## 5. Meal System

### 5.1 Default Meal Pattern

- Each user sets a default meal pattern on joining. The pattern is day-of-week based — Monday through Sunday — each day stores a meal count of 0, 1, 2, or more.
- A user who takes 2 meals every day simply sets 2 for all 7 days. One pattern design covers all cases.
- The calendar is pre-filled from this default. Users only edit days where their plan differs.
- When a user changes their pattern, the system auto-updates all remaining future days of the current month from today onwards. Past days are never affected.
- There is exactly one active pattern per user. When updated, it is changed in place. No history of past patterns is stored.

### 5.2 Planned vs Actual Meals

- Future dates are pre-scheduled from the default pattern and can be edited before the deadline.
- Past dates reflect what actually happened and are permanently locked once the day ends.

### 5.3 Daily Deadline and Meal Locking

- A single daily deadline applies to all meal types for that day. Set and changed by admin only.
- Before the deadline: users can freely edit today's meals.
- After the deadline: today's meals are locked. The user may request admin permission to edit.
- At midnight: today's record is permanently locked. This is a hard, irreversible lock. No admin override exists for past days — ever.
- Future days remain freely editable until their own deadline arrives.

### 5.4 Meal Edit Rules

| Situation | Who Acts | Permission Needed |
|---|---|---|
| Edit meal before deadline | User | No |
| Edit meal after deadline, same day only | User after admin approval | Yes — admin grants via MealEditRequest |
| Edit any past day before today | Not permitted | Hard block — no exception, no override, ever |
| Admin edits meal directly | Not permitted by design | N/A |

The same-day-only restriction eliminates all complexity around bulk cycle allocations and monthly settlements. By the time any cycle closes or any month settles, all meal records within it are already permanently frozen.

### 5.5 MealEditRequest Lifecycle

- A user submits a MealEditRequest for today's record after the deadline has passed.
- An admin approves or rejects the request.
- If approved, the user performs the edit themselves. The admin never edits on the user's behalf.
- At midnight, any pending MealEditRequest auto-expires — it is meaningless once the day ends.

### 5.6 Forgotten and Missed Meals

If someone forgets to cancel a meal and the food is cooked, the cost stays with that user. It is a real consumption event with no exception.

### 5.7 Today's Meal Dashboard

The dashboard shows a list of who is taking meals today. Primary purpose: the maid knows how many meals to cook. Displays each active member's name and meal count for today plus a total at the bottom. Deactivated members are excluded.

---

## 6. Bazar System

### 6.1 Core Rules

- The person who enters the bazar expense is the person who spent the money. Cannot record for another member.
- A bazar entry with zero taka is valid — the member went but spent nothing. Still counts as a completed visit.
- Submitting a bazar expense entry automatically marks the current trip as complete.

### 6.2 Bazar Trip Triggering

- Any member can trigger a bazar trip at any time. Only one trip can be open at a time.
- When triggered, the system suggests the 2 members with the lowest visit counts as assignees.
- Assignment is a suggestion only — any member can go and submit the expense.
- If an assignee does not go, their visit count stays the same. They will be suggested again on the next trip.
- Being assigned never changes a visit count. Only submitting a BazarExpense does.
- All members can see who is currently assigned on the dashboard.

### 6.3 Shopping Notes

Each active bazar trip has a single shared plain-text notes field. Any member can write or overwrite it while the trip is open. When any member submits a bazar expense completing the trip, the notes clear automatically. Shopping notes are not stored permanently — they exist only for the duration of the active trip.

### 6.4 Expense Date and Backdating

- The bazar expense date defaults to today.
- A member can backdate within the current month freely.
- Backdating into a prior month is blocked. If the actual trip date was last month, the system forces today's date. No exceptions.
- Two timestamps: actual run date (user-set, used in calculations) and submission timestamp (system-set, audit only).

### 6.5 Visit Count and Leaderboard

Visit count is always derived by counting completed bazar expense entries per user — never stored separately.

| Leaderboard View | Metric Used |
|---|---|
| Bazar visits ranking | Total completed expense entries submitted |
| Bazar spending ranking | Total taka spent across all bazar entries |
| Suggestion for next trip | Visit count only — lowest 2 are suggested |

---

## 7. Maid Cost

### 7.1 Maid Charge

- Fixed monthly charge per active member. Does not depend on meal count.
- Applied as a separate line item each month — never blended into the meal rate.
- Default charge is 700 taka per member per month, stored in system configuration.
- Admin can change the default. Changes do not automatically affect already-posted charges. However, admins have a "Reset Current Month Charges" action to delete and reapply charges for the current month based on the new rate.
- Deactivated members are not charged for any month where they are fully deactivated.

### 7.2 Maid Payment

One member often pays the full maid bill on behalf of the whole group. This is handled as follows:

- The paying member records a Maid Payment entry with the total amount paid (e.g. 3500 taka for 5 members).
- This gives the paying member a credit of the full amount to their System 1 balance.
- Each member already has their individual maid charge deducted from their balance separately.
- Net result: the paying member is owed the group's share minus their own portion. This surfaces naturally in the monthly settlement.
- Maid Payment is recorded separately from bazar expenses — it must never affect the meal rate calculation.
- Any member can record a Maid Payment.

---

## 8. Bulk Items: Gas and Rice

### 8.1 What Are Bulk Items

Bulk items are goods purchased in large quantities lasting across multiple weeks or months — currently Gas cylinders and Rice bags. Their cost per meal is not known at purchase time. It is calculated only when the item runs out, divided based on actual meals consumed across the item's entire lifetime.

### 8.2 Recording a Bulk Purchase

- Recorded as a standalone entry — separate from regular bazar expenses. This is critical: bulk item cost must never enter the meal rate formula.
- Records: which item type, who bought it, total cost, and purchase date.
- Purchase date is for audit reference only. Any date is accepted — no backdating restriction applies here.
- Any member can add a new bulk item type. Any member can record a bulk purchase.

### 8.3 Bulk Cycle Lifecycle

- Each bulk item is tracked as a lifecycle record called a cycle — from when the previous item ran out to when this one runs out.
- A cycle's start time is system-set: the exact moment the previous cycle was marked finished.
- For the very first cycle of an item, start time is set to the moment the record is created.
- A cycle ends when any member marks it as finished. No overlap — new cycle starts only after the previous one closes.

### 8.4 Cost Allocation

- When a cycle is marked finished, the system immediately calculates and posts each member's share.
- Formula: Cost per meal = Total cost / Total meals during cycle. User allocation = Cost per meal x user's meals during cycle.
- Posted immediately as a separate balance line item — not at month end.
- Deactivated members who had meals during the cycle period still receive their allocation.
- Allocation is a frozen snapshot — calculated once, never recalculated. Safe because all underlying meal records are permanently locked by this point.

---

## 9. Settlement and Running Balance

### 9.1 Running Balance

- Every user has a running balance reflecting all events in real time.
- Balance is always derived from underlying records — never stored as a field.

### 9.2 Month-End Settlement

- At the end of each month, smart settlement calculates the minimum transactions needed to resolve all member balances.
- A month can only be settled once. Once settled it cannot be recalculated or reopened.
- Settlement records are permanent snapshots.
- After settlement, System 1 balance resets for the new month. Settlement amounts pass to System 2 as debt entries.

### 9.3 Smart Settlement Algorithm

1. Identify all users with positive balances (creditors) and negative balances (debtors).
2. Match the largest debtor with the largest creditor.
3. Transfer the minimum amount needed to reduce one side to zero.
4. Repeat until all balances are resolved.
5. Output a clean payment plan: who pays whom and how much.

The settlement output becomes entries in System 2 where actual money movement is tracked and confirmed. System 1 does not track whether the money was physically exchanged.

---

## 10. Dashboard and Reporting

### 10.1 Global Daily View

- Today's meals: each active member's name and meal count, plus a total. Primary purpose is for the maid to know how many meals to cook.
- Current bazar trip status: who is assigned and the shared shopping notes.
- Bazar duty reminder: visible to all when a trip is open, persists until completed.

### 10.2 Global Monthly Summary

- Total bazar spending for the month.
- Total number of meals taken in the month.
- Current estimated or actual cost per meal.
- Month-to-date balance trend.

### 10.3 Per-User Summary

- Meals taken this month.
- Bazar expense contributed this month.
- Per-person expense breakdown: meal cost, maid charge, bulk allocations.
- Current balance — positive or negative taka.
- Meal calendar showing scheduled future meals and locked past actual meals.

### 10.4 Leaderboard and Participation

- Bazar visits leaderboard — total completed trips per member.
- Bazar spending leaderboard — total taka spent per member.
- Current bazar assignees and shopping notes visible to all members.

---

## 11. Permission Model

| Action | Who Can Do It | Admin Approval |
|---|---|---|
| Record own meals | Any member | No |
| Edit meals before deadline | Any member | No |
| Edit meals after deadline — same day only | Member after approval | Yes — MealEditRequest |
| Edit any past day's meals | Not permitted | Hard block, no exception ever |
| Record own bazar expense | Any member | No |
| Record bazar for another member | Not permitted | N/A |
| Trigger a bazar trip | Any member | No |
| Edit shopping notes | Any member | No |
| Mark bazar trip done via expense entry | Any member | No |
| Add bulk item type | Any member | No |
| Record bulk item purchase | Any member | No |
| Mark bulk cycle as finished | Any member | No |
| Record maid payment | Any member | No |
| Set or change daily meal deadline | Admin only | N/A |
| Change maid charge default | Admin only | N/A |
| Approve or reject membership request | Admin only | N/A |
| Grant post-deadline meal edit permission | Admin only | N/A |
| Deactivate a member account | Admin only | N/A |
| Run month-end settlement | Admin only | N/A |

---

## 12. Edge Cases and Rules

| Topic | Rule |
|---|---|
| Group size | One group only, fewer than 10 members |
| Authentication | Gmail sign-in via Google OAuth only. No passwords stored. |
| Multiple admins | Allowed. Any number of admin accounts can exist. |
| Meal cost sharing | By meals consumed, not equally. |
| Meal rate formula | Total bazar spending / total meals. Bulk and maid costs excluded. |
| Maid cost | Fixed charge per member, separate line item, default 700 taka. |
| Maid payment | Recorded separately from bazar. Paying member gets full amount as credit. |
| Bulk item cost | Usage-based, separate line item, posted immediately on cycle close. |
| Bulk purchase recording | Separate from bazar expense. Never enters meal rate calculation. |
| Meal edit restriction | Can only edit on that exact calendar day. Midnight = permanent lock. No override ever. |
| Post-deadline edit | Admin grants permission only. User performs the edit. Admin never edits directly. |
| MealEditRequest expiry | Auto-expires at midnight if still pending. |
| Default pattern change | Auto-updates all remaining future days of current month. Past records untouched. |
| Forgotten meal | If food is cooked, cost stays with that user. No exception. |
| Bazar entry ownership | Self-entered only. Cannot record for another member. |
| Bazar zero entry | Valid participation event. Increments visit count. |
| Assignee visit count | Only increments on expense submission. Being assigned has no effect. |
| Ungoing assignee | Count stays lowest. They are suggested again on the next trip. |
| Bazar backdating | Within current month: allowed. Prior month: date forced to today. |
| Shopping notes | Plain text, editable by anyone, not stored permanently, cleared on trip completion. |
| Bulk cycle start | System-set when previous cycle closes. First-ever cycle: set to creation moment. |
| Bulk cycle closing | Any member can mark finished. Triggers immediate allocation for all members. |
| Bulk cycles overlap | Never. New cycle starts only after previous one is marked finished. |
| Bulk allocation freeze | Calculated once at cycle close. Never recalculated. |
| Deactivated — meals | Future records set to 0. Excluded from all active meal views. |
| Deactivated — maid | Not charged for months where fully deactivated. |
| Deactivated — bulk | Still allocated their share for meals during any open cycle. |
| Member leaving | Account stays active until balance settled. Admin deactivates after full resolution. |
| Monthly settlement | One settlement per month, ever. Permanent record. Cannot be redone. |
| System 1 balance reset | After month-end settlement, System 1 balance resets. Debts move to System 2. |

---

## 13. System 2: Money Management (Future Scope)

System 2 is the debt management and money movement layer. System 1 calculates what everyone owes from the shared expense pool. System 2 tracks whether and how those debts are actually paid, alongside any personal financial interactions between members.

> **Note:** System 2 is intentionally excluded from the current development scope. It will be built after System 1 is complete and stable.

### 13.1 How System 1 and System 2 Relate

| Aspect | System 1 | System 2 |
|---|---|---|
| Purpose | Track shared household expenses | Track money movement between members |
| Data source | Meals, bazar, maid, bulk items | Transfers, requests, meal settlements |
| Balance | Net meal/expense balance | Full debt/credit ledger |
| Resets | Monthly | Never — carries forward |
| Settlement | Calculates who owes whom | Records actual payments made |

### 13.2 Key Features

- **Transfer:** Member A records 'I sent Member B X taka'. Member B must accept or reject. Balance updates only on acceptance.
- **Money Request:** Member A records 'I need X taka from Member B'. If B accepts, a Transfer is spawned (B sent A X). Member A confirms. Balance updates only on confirmation. A request never directly changes any balance.
- **Amount flexibility:** a single transfer can cover multiple debts at once — no tagging or splitting required.
- **Debt ledger:** each member sees their net position with every other member and overall balance.
- **Smart settlement:** suggests minimum transactions to resolve all outstanding debts.
- **Meal settlement import:** System 1 month-end amounts import into System 2 as transfer entries going through the same confirmation flow.

### 13.3 Cancellation Rules

| Scenario | Who Can Cancel | When |
|---|---|---|
| Pending transfer | Sender only | Before receiver accepts or rejects |
| Pending request | Requester only | Before receiver accepts or rejects |
| Accepted transfer | Cannot be cancelled | Use a reverse transfer instead |
| Rejected entry | Cannot be cancelled | Already closed |

### 13.4 User Contact Information

Since System 2 involves real money movement, the User entity includes optional contact and payment fields:

| Field | Type | Purpose |
|---|---|---|
| nickname | String, nullable | Preferred display name for the dashboard and leaderboards |
| phone_number | String, nullable | Local phone number for contact |
| bkash_number | String, nullable | bKash mobile banking number — often same as phone but not always |
| bank_name | String, nullable | e.g. AB Bank, Dutch Bangla |
| bank_account_number | String, nullable | For direct bank transfers |

All fields are nullable — members are not required to fill these in. They are reference information only. The system never initiates payments through these channels; it only shows them to other members so they know where to send money.

---

## 14. AI Features (Post System 2 Scope)

Three AI features have been identified as genuinely valuable additions after System 1 and System 2 are stable. These are not gimmicks — the system generates exactly the kind of structured transactional data that AI reasons over effectively. Timing and data maturity are the key factors.

> **Note:** AI features are planned for the agile roadmap after System 2 is complete. They require real historical data to be meaningful — minimum 3 to 4 months of live usage before AI suggestions become reliable.

### 14.1 Smart Bazar Shopping Assistant

**What it does**

Before a bazar trip, it analyses past bazar expense notes, current bulk item cycle ages, meal patterns for the week, and historical buying behaviour to suggest what likely needs to be bought on this trip. For example: 'Gas cylinder is on day 38 of an average 45-day cycle — worth adding to the list.'

**Usefulness vs Gimmick Assessment**

- Genuinely useful — but only after 3 to 4 months of real data. In the first month it has nothing meaningful to learn from.
- Saves mental effort for whoever is doing the bazar run. Reduces forgotten items.
- Must be framed as a suggestion the member edits — not an instruction to follow blindly.

**Implementation Approach**

- No model training or custom infrastructure needed.
- Pass to Claude API: last 3 months of bazar expense notes, current bulk cycle ages, this week's meal counts, and any manually written shopping notes.
- Ask the AI to suggest a shopping list with reasoning. Display result as an editable starting point.
- Difficulty: Low to Medium. A solo developer can build this in a short sprint once System 1 is live.

### 14.2 Anomaly Detection

**What it does**

Monitors events and flags things that look statistically unusual before month end — when they are still easy to fix. Examples: a bazar expense 3x the user's personal average, a member's meals suddenly dropping to zero for a week, a bulk cycle closing in half the expected time, a member contributing zero taka to bazar for two consecutive months.

**Usefulness vs Gimmick Assessment**

- This is the most genuinely useful of all three features. Household expense disputes almost always start from an honest mistake nobody caught in time. Anomaly detection catches those mistakes before the month closes.
- Prevents settlement disputes. Builds trust in the system.

**Implementation Approach — Two Stages**

Stage 1 — Rule-based (build inside System 1, no AI required):
- Flag any bazar entry more than 2x the user's personal monthly average.
- Flag any member with 0 meals for more than 5 consecutive days.
- Flag bulk cycles closing significantly faster than the historical average for that item.
- Flag any member with 0 bazar contributions for 2+ consecutive months.
- This stage delivers 80% of the value with minimal complexity. Recommended to build here.

Stage 2 — AI-enhanced (upgrade after System 2):
- Pass recent activity data to Claude API and ask it to identify subtle patterns the rule-based system misses.
- AI provides human-readable explanations of why something looks unusual, not just alerts.
- Catches multi-variable anomalies that simple threshold rules cannot detect.
- Difficulty: Medium.

### 14.3 AI Data Analyst

**What it does**

A conversational interface where any member can ask questions about the household data in plain language. Examples: 'Who has contributed the least to bazar this year?', 'What was our most expensive month?', 'How much has gas cost us per meal on average?', 'Is my meal spending going up or down?'

**Usefulness vs Gimmick Assessment**

- The most powerful of the three features. The dashboard answers known questions. The analyst answers unknown questions. That is a fundamentally different and more valuable capability.
- High likelihood of becoming a genuine daily-use feature rather than something people try once.

**Implementation Approach**

Simple approach — conversational query with data context:
- Pass the user's question plus a structured summary of their data to the Claude API.
- Works well for personal balance queries and straightforward comparisons.
- Difficulty: Medium.

Full approach — AI with database query access (tool use):
- The AI decides what data it needs, queries the database, and reasons over the result.
- Significantly more powerful. Handles complex cross-member analysis.
- Requires careful design: what the AI is allowed to query, how results are formatted, and guardrails for financial data accuracy.
- Difficulty: High.

> **Important:** If the AI gives a wrong answer about money it destroys trust immediately. All AI analyst responses must include a clear 'based on available data' disclaimer and link back to the raw data so members can verify the reasoning.

### 14.4 AI Roadmap in Agile Context

| Phase | Feature | Effort | Value |
|---|---|---|---|
| System 1 | Rule-based anomaly alerts | Low | High |
| System 2 | Plain language monthly summary | Low | High |
| Post System 2 | Smart bazar shopping assistant | Medium | Medium-High |
| Post System 2 | AI data analyst — simple queries | Medium | Very High |
| Later | AI data analyst — full tool use | High | Very High |
| Later | AI-enhanced anomaly explanation | Medium | Medium |

---

## 15. Future Direction

- **System 2** (Money Management and Debt Tracking) — next major development phase after System 1 is stable.
- **AI features** (Shopping Assistant, Anomaly Detection, Data Analyst) — post System 2, once sufficient historical data has accumulated.
- **Inventory management** — identified as a valuable addition but excluded from all current scopes. Can be layered on top later.
- **Push or in-app notifications** for bazar duty, meal deadline reminders, and pending transaction approvals.
- **Mobile application** — current scope is browser-based only.

---

*End of Requirements Document*