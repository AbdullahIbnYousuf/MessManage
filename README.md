# MessManage

**Meals, expenses, and balances for your household.**

MessManage is a mobile-first household management application for a single group of fewer than ten members. It replaces spreadsheet-based meal and expense tracking with shared workflows, exact financial calculations, monthly closing, and confirmed money records between members.

Production: [mess-manage.vercel.app](https://mess-manage.vercel.app)

## What it manages

- **Home:** today’s complete meal list, active bazar trip, tasks needing attention, and a month-to-date snapshot.
- **Meals:** weekly patterns, rolling two-month schedules, configurable deadlines, exact monthly correction requests, locking, and protected admin corrections.
- **Bazar:** shared shopping notes, fair assignee suggestions, trip completion, expenses, history, and participation statistics.
- **Expenses:** operational summaries and full workflows for bulk items, maid charges, and fridge bills.
- **Money:** provisional household accounting, monthly closing, permanent member obligations, confirmed money sent or received, pairwise statements, and a shared ledger.
- **Members and administration:** Google sign-in, membership approval, profiles, roles, lifecycle controls, and system settings.
- **Notifications:** persistent in-app notifications with optional web push delivery.

The interface is designed for 390px mobile screens first, with desktop navigation as a secondary layout.

## Interface

MessManage uses a light **Warm Editorial** visual system: Newsreader display headings, DM Sans interface text, warm paper-like surfaces, restrained terracotta accents, and tabular numerals for money. The design keeps household information—not decorative artwork—as the primary visual content.

- Mobile navigation stays focused on Home, Meals, Bazar, Money, and More, with safe-area spacing and 44px touch targets.
- Desktop uses a compact espresso sidebar and responsive content widths suited to forms, operational pages, and financial reports.
- Statuses always include explicit wording; financial direction, errors, and required actions never depend on color alone.
- Motion is intentionally subtle and nonessential animation is disabled when reduced motion is requested.
- The application currently ships as one consistent light theme; a theme toggle is outside the present release.

## Accounting model

MessManage deliberately separates two accounting stages:

1. **Provisional monthly balance** is derived from meals and household expenses for the open month.
2. **Confirmed debt position** carries permanent monthly obligations and accepted money records forward until resolved.

Monthly closing converts an exact past-month household balance into permanent obligations. Pending, rejected, or cancelled money records have no accounting effect. Accepted records affect the confirmed position exactly once.

All money is calculated with decimal arithmetic. Running balances, meal rates, and participation totals are derived from source records rather than stored as mutable totals. Closed months and finished allocation periods are protected from later source-record changes.

## Technology

| Area | Stack |
|---|---|
| Application | Next.js 15 App Router, React 19, TypeScript strict mode |
| Styling | Tailwind CSS |
| Database | PostgreSQL on Neon |
| ORM | Prisma 6 |
| Authentication | Auth.js v5 with Google OAuth |
| Testing | Vitest |
| Notifications | In-app notifications and Web Push/VAPID |
| Hosting and jobs | Vercel and Vercel Cron |

## Local development

### Prerequisites

- Node.js 20 or newer
- npm
- A PostgreSQL database
- Google OAuth web credentials

### Setup

```bash
git clone https://github.com/AbdullahIbnYousuf/MessManage.git
cd MessManage
npm install
cp .env.example .env.local
```

Fill in `.env.local`, then apply migrations:

```bash
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Seed only a new disposable development database when seed data is required:

```bash
npm run db:seed
```

Do not run `npm run db:reset` against production or any shared database; it is intentionally destructive.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled PostgreSQL connection used by the application |
| `DIRECT_URL` | Direct PostgreSQL connection used for migrations and maintenance |
| `NEXTAUTH_SECRET` | Auth.js session-signing secret |
| `NEXTAUTH_URL` | Canonical application URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `CRON_SECRET` | Bearer secret protecting scheduled-job endpoints |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser-visible Web Push public key |
| `VAPID_PRIVATE_KEY` | Server-side Web Push private key |
| `VAPID_SUBJECT` | Web Push contact URI, normally a `mailto:` address |
| `NEXT_PUBLIC_DEBTSYNC_ENABLED` | Shows confirmed Money features when exactly `true` |
| `DEBTSYNC_MUTATIONS_ENABLED` | Allows Money writes when exactly `true` |
| `MOCK_CURRENT_TIME` | Development/test-only clock override |

Keep `DEBTSYNC_MUTATIONS_ENABLED=false` during migrations, reconciliation, and read-only deployment validation. The public flag controls visibility; it does not authorize writes.

For local Google sign-in, register:

- JavaScript origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/auth/callback/google`

For production, register the equivalent origin and callback for the final public domain. Do not register temporary Vercel deployment URLs.

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npx tsc --noEmit` | Run TypeScript validation |
| `npx prisma validate` | Validate the Prisma schema |
| `npx prisma migrate deploy` | Apply committed migrations |
| `npm run db:preflight:financial-indexes` | Read-only duplicate check before financial index migration |

Database migrations are the only supported production schema-change mechanism. Never use `prisma db push` in production.

## Scheduled jobs

Vercel runs three authenticated jobs configured in `vercel.json`:

| Job | UTC schedule | Responsibility |
|---|---|---|
| Midnight lock | Daily at `00:00` | Lock completed meal records and expire pending legacy same-day edit requests |
| Auto close | Monthly on the 20th at `00:00` | Attempt closing for the previous month |
| Meal reminders | Daily at `14:30` | Send configured reminders without creating financial records |

The monthly job is idempotent and still applies all readiness and closed-month safeguards.

## Release safety

Before a production migration or Money rollout:

1. Take and verify a database backup.
2. Run required read-only preflight checks.
3. Deploy with Money mutations disabled.
4. Apply committed migrations with `prisma migrate deploy`.
5. Reconcile settlement and obligation counts, totals, and checksums.
6. Smoke-test authentication and read-only financial views.
7. Enable mutations only after a controlled two-account confirmation test.

Historical settlements, obligations, allocations, and accepted money records are authoritative. Do not edit, delete, backfill, or recalculate them without a separate reviewed remediation plan.

## Project documentation

- [Project requirements](./ProjectRequirements.md)
- [System 1 data model](./System1DataModel.md)
- [DebtSync product requirements](./DebtSync_PRD.md)
- [DebtSync implementation plan](./DebtSync_Implementation_Plan.md)
- [Contributor agent rules](./AGENTS.md)

## License

This repository is currently private-purpose software for one household. No open-source license has been granted.
