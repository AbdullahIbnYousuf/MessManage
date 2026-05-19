# Production Deployment Checklist

## Pre-Deployment

### 1. Code Quality

- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Run tests: `npm test`
- [ ] Build succeeds: `npm run build`

### 2. Database

- [ ] Database is clean (only admin user exists)
- [ ] SystemConfig exists with correct defaults
- [ ] All migrations are applied
- [ ] Prisma client is generated

### 3. Environment Variables (Vercel)

Verify these are set in Vercel project settings:

- [ ] `DATABASE_URL` (Neon PostgreSQL connection string)
- [ ] `DIRECT_URL` (Neon direct connection string)
- [ ] `AUTH_SECRET` (random secret for session encryption)
- [ ] `GOOGLE_CLIENT_ID` (Google OAuth client ID)
- [ ] `GOOGLE_CLIENT_SECRET` (Google OAuth client secret)
- [ ] `CRON_SECRET` (random secret for cron job authentication)
- [ ] **DO NOT** set `MOCK_CURRENT_TIME` in production

### 4. Google OAuth Configuration

- [ ] Production domain added to authorized redirect URIs
  - Format: `https://yourdomain.com/api/auth/callback/google`
- [ ] Production domain added to authorized JavaScript origins
  - Format: `https://yourdomain.com`

### 5. Vercel Cron Jobs

Verify `vercel.json` has correct schedules:

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

---

## Deployment

### 1. Commit and Push

```bash
git add .
git commit -m "Production deployment"
git push origin main
```

### 2. Verify Deployment

- [ ] Vercel deployment succeeds
- [ ] No build errors
- [ ] No runtime errors in function logs

### 3. First Sign-In

- [ ] Sign in with admin email: a.a.y.tonmoy@gmail.com
- [ ] Admin access works
- [ ] Can access Admin panel

---

## Post-Deployment Verification

### Immediate Checks (Day 1)

#### Authentication

- [ ] Admin can sign in successfully
- [ ] New users can sign in and create membership requests
- [ ] Admin can see pending membership requests
- [ ] Admin can approve/reject membership requests
- [ ] Approved members can access the app

#### Core Features

- [ ] Dashboard loads correctly
- [ ] Meal calendar displays
- [ ] Members can set meal patterns
- [ ] Members can record today's meal (before deadline)
- [ ] Meal deadline enforcement works
- [ ] Balance calculations display correctly

#### Admin Features

- [ ] System settings page loads
- [ ] Can update meal deadline
- [ ] Can update maid charge default
- [ ] Can update electricity unit price
- [ ] Member management works
- [ ] Can deactivate/reactivate members

### Week 1 Checks

#### Daily Operations

- [ ] Midnight lock cron runs successfully (check Vercel logs)
- [ ] Yesterday's meals are locked at midnight
- [ ] Pending meal edit requests expire at midnight
- [ ] Meal edit request workflow works
- [ ] Admin can approve/reject meal edit requests

#### Bazar Features

- [ ] Can open a bazar trip
- [ ] Only one trip can be open at a time
- [ ] Can add shopping notes
- [ ] Can assign members to trip
- [ ] Can record bazar expenses
- [ ] Trip closes when expense is submitted
- [ ] Visit count increments correctly
- [ ] Balance updates after expense

#### Bulk Items

- [ ] Can create bulk items
- [ ] Can start a bulk cycle
- [ ] Only one active cycle per item
- [ ] Can finish a cycle
- [ ] Allocations are calculated correctly
- [ ] Balance updates after allocation

### Month 1 Checks

#### Maid Charges

- [ ] Maid charges auto-apply on the 28th (check Vercel logs)
- [ ] All active members receive charges
- [ ] Charge amount matches system setting
- [ ] Can record maid payments
- [ ] Balance updates correctly

#### Fridge Bills

- [ ] Can post fridge bill for previous month
- [ ] Meter readings are recorded
- [ ] Total amount calculates correctly
- [ ] Per-member amount calculates correctly
- [ ] Can record fridge payment
- [ ] Balance updates correctly

#### Settlement

- [ ] Settlement runs on the 5th (check Vercel logs)
- [ ] Settlement calculates correctly
- [ ] Monthly report displays all transfers
- [ ] Balance resets for new month
- [ ] Settlement history is preserved

---

## Monitoring

### Vercel Dashboard

- [ ] Check deployment status regularly
- [ ] Monitor cron job execution logs
- [ ] Review function invocation metrics
- [ ] Check for error logs

### Database Health

Use `npx prisma studio` to verify:

- [ ] Data integrity
- [ ] No orphaned records
- [ ] SystemConfig is correct
- [ ] User data is accurate

### Performance

- [ ] Page load times are acceptable
- [ ] API responses are fast
- [ ] No timeout errors
- [ ] Mobile performance is good

---

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets committed to repository
- [ ] All API routes validate session
- [ ] Admin routes check role === 'admin'
- [ ] Cron endpoints validate CRON_SECRET
- [ ] No sensitive data in client-side code
- [ ] Database credentials are secure
- [ ] Google OAuth is properly configured

---

## Rollback Plan

If critical issues occur:

1. **Revert Deployment**
   - Go to Vercel dashboard
   - Find previous working deployment
   - Click "Promote to Production"

2. **Database Backup**
   - Neon provides automatic backups
   - Can restore from Neon dashboard if needed

3. **Emergency Contact**
   - Vercel Support: https://vercel.com/support
   - Neon Support: https://neon.tech/docs

---

## Known Limitations

- Cron jobs only run on production deployments (not preview)
- Free tier limits:
  - Vercel: 100GB bandwidth/month
  - Neon: 0.5GB storage, 191 hours compute/month
- Mobile-first design (desktop is secondary)
- Single household only (< 10 members)

---

## Success Criteria

✅ All users can sign in
✅ Meal tracking works daily
✅ Bazar expenses are recorded accurately
✅ Balances calculate correctly
✅ Cron jobs run on schedule
✅ No data loss or corruption
✅ Mobile experience is smooth
✅ Admin can manage members

---

## 🎉 Launch Complete!

Once all checks pass, your meal management system is live and ready for daily use.

**Remember:**

- This system handles real money — monitor closely
- Keep Neon database backups
- Check Vercel logs regularly
- Document any issues for future reference
