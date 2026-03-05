# Phase A — Subscription & Usage Infrastructure (Backend)

> Step-by-step prompts for Claude Code.
> Prerequisite: backend API is functional with auth, sessions, and processing pipeline.
>
> This phase is **self-contained** — it can be implemented without Phase B (UI) or Phase C (Groq).
> After this phase, the backend has full subscription management and usage tracking.

---

## Overview

Add subscription management and usage tracking to the backend:

- **Free:** Up to 2 hours of analyzed conversation per week (rolling 7 days). €0.
- **Pro (€14.99/month):** Up to 50 hours of analyzed conversation per month (calendar month).
- **Team (€12.99/user/month, min 5 seats):** Pro features + admin dashboard, team analytics.

All thresholds are stored in the `plans` table and configurable via an admin endpoint — never hardcoded.

---

## FASE 1: Database — Usage tracking and plan configuration

### Prompt 1.1 — Schema updates

```
We need to add subscription management and usage tracking to the database.

1. Create a new table 'plans' for plan configuration:
   - id (varchar, PK) — e.g. 'free', 'pro', 'team'
   - name (varchar, not null) — display name: 'Free', 'Pro', 'Team'
   - max_seconds_per_period (integer, not null) — usage limit in seconds
     (Free: 7200 = 2 hours, Pro: 180000 = 50 hours, Team: 180000 = 50 hours)
   - period_type (varchar, not null) — 'weekly' or 'monthly'
   - analysis_provider (varchar, not null) — 'anthropic' for all tiers for now
   - stt_provider (varchar, not null) — 'openai' for all tiers for now
   - price_cents (integer, not null) — monthly price in euro cents
     (Free: 0, Pro: 1499, Team: 1299)
   - is_active (boolean, default true)
   - created_at (timestamp, default now())

   NOTE: analysis_provider and stt_provider columns exist for future use
   (Phase C — Groq integration). For now, all tiers use 'anthropic' and
   'openai' respectively. Do NOT implement provider switching in this phase.

2. Seed the plans table with three rows:
   - { id: 'free', name: 'Free', max_seconds_per_period: 7200,
       period_type: 'weekly', analysis_provider: 'anthropic',
       stt_provider: 'openai', price_cents: 0 }
   - { id: 'pro', name: 'Pro', max_seconds_per_period: 180000,
       period_type: 'monthly', analysis_provider: 'anthropic',
       stt_provider: 'openai', price_cents: 1499 }
   - { id: 'team', name: 'Team', max_seconds_per_period: 180000,
       period_type: 'monthly', analysis_provider: 'anthropic',
       stt_provider: 'openai', price_cents: 1299 }

3. Create a new table 'subscriptions':
   - id (uuid, PK)
   - user_id (uuid, FK → users, unique) — one active sub per user
   - plan_id (varchar, FK → plans)
   - status (varchar) — 'active', 'canceled', 'past_due'
   - stripe_subscription_id (varchar, nullable) — for paid users
   - stripe_customer_id (varchar, nullable)
   - current_period_start (timestamp)
   - current_period_end (timestamp)
   - created_at (timestamp, default now())
   - updated_at (timestamp)

4. Create a new table 'usage_records':
   - id (uuid, PK)
   - user_id (uuid, FK → users)
   - session_id (uuid, FK → sessions)
   - duration_seconds (integer, not null)
   - recorded_at (timestamp, default now())

   This table logs every completed session's duration for usage
   calculation. We query it with a time window to get current usage.

5. Update the 'users' table:
   - Remove subscription_tier column (it's now in subscriptions table)
   - Add a default: when a new user is created via OAuth, also create
     a subscription row with plan_id='free', status='active',
     current_period_start=now(),
     current_period_end=now()+7 days (for weekly plan).

6. Update packages/shared types to reflect the new schema.
```

**Checkpoint:** schema migrated, seed data inserted. Commit: `feat(api): subscription and usage tracking schema`

---

## FASE 2: Usage calculation service

### Prompt 2.1 — Usage service

```
Create a usage tracking service at apps/api/src/services/usage.ts.

This service is the single source of truth for "how much has this user
used in their current period?"

Implement these functions:

1. getUserUsage(userId: string): Promise<UsageInfo>

   Returns:
   {
     plan: {
       id: string,              // 'free', 'pro', or 'team'
       name: string,
       maxSeconds: number,       // e.g. 7200
       periodType: 'weekly' | 'monthly'
     },
     currentPeriod: {
       start: Date,
       end: Date
     },
     usedSeconds: number,        // total seconds used in current period
     remainingSeconds: number,   // maxSeconds - usedSeconds (min 0)
     isLimitReached: boolean,    // usedSeconds >= maxSeconds
     percentUsed: number         // 0-100, for UI progress bar
   }

   How to calculate usedSeconds:
   - Get the user's subscription to find their plan and period
   - For 'weekly' plans: sum duration_seconds from usage_records
     WHERE user_id = userId AND recorded_at >= (now - 7 days)
     This is a ROLLING window, not calendar week.
   - For 'monthly' plans: sum duration_seconds from usage_records
     WHERE user_id = userId
     AND recorded_at >= current_period_start
     AND recorded_at < current_period_end

2. recordUsage(userId: string, sessionId: string, durationSeconds: number): Promise<void>

   Inserts a row into usage_records. Called by the processing pipeline
   after a session is fully processed.

3. canStartRecording(userId: string): Promise<{
     allowed: boolean,
     remainingSeconds: number,
     reason?: string
   }>

   Quick check used by the extension before starting a recording.
   Returns allowed=false with a reason if limit is reached.
   If allowed=true, also returns how many seconds the user can
   still record (so the extension can show a warning when close
   to the limit).

All time thresholds must come from the plans table, never hardcoded.
If someone changes max_seconds_per_period in the database, it takes
effect immediately.
```

### Prompt 2.2 — Test the usage service

```
Create a test script at apps/api/scripts/test-usage.ts that:

1. Creates a test user with a free plan subscription
2. Records 3 fake sessions of 20 minutes each (3600 seconds total)
3. Calls getUserUsage and verifies:
   - usedSeconds = 3600
   - remainingSeconds = 3600 (7200 - 3600)
   - isLimitReached = false
   - percentUsed = 50
4. Records 2 more sessions of 30 minutes each (3600 more)
5. Calls getUserUsage and verifies:
   - usedSeconds = 7200
   - isLimitReached = true
   - percentUsed = 100
6. Calls canStartRecording and verifies allowed = false
7. Cleans up test data

Print results clearly so I can see if everything works.
```

**Checkpoint:** usage service works correctly. Commit: `feat(api): usage calculation service`

---

## FASE 3: API endpoints and pipeline integration

### Prompt 3.1 — Usage and subscription endpoints

```
Add the following API endpoints. All protected by auth unless noted.

1. GET /users/me/usage

   Calls getUserUsage() and returns the full UsageInfo object.
   This is what the extension polls to know if recording is allowed.

   Response 200:
   {
     "plan": { "id": "free", "name": "Free", "maxSeconds": 7200, "periodType": "weekly" },
     "currentPeriod": { "start": "...", "end": "..." },
     "usedSeconds": 3600,
     "remainingSeconds": 3600,
     "isLimitReached": false,
     "percentUsed": 50
   }

2. GET /users/me/subscription

   Returns the user's current subscription details.

   Response 200:
   {
     "id": "...",
     "plan": { "id": "free", "name": "Free", "maxSeconds": 7200, ... },
     "status": "active",
     "currentPeriodStart": "...",
     "currentPeriodEnd": "...",
     "stripeSubscriptionId": null
   }

3. GET /plans

   Public endpoint (no auth required). Returns all active plans.
   Used by the frontend to show pricing and plan comparison.

   Response 200:
   {
     "plans": [
       { "id": "free", "name": "Free", "maxSeconds": 7200,
         "periodType": "weekly", "priceCents": 0 },
       { "id": "pro", "name": "Pro", "maxSeconds": 180000,
         "periodType": "monthly", "priceCents": 1499 },
       { "id": "team", "name": "Team", "maxSeconds": 180000,
         "periodType": "monthly", "priceCents": 1299 }
     ]
   }
```

### Prompt 3.2 — Integrate usage recording into the processing pipeline

```
Update the session processing worker to record usage after
a session is successfully processed.

In the worker, after the report is generated and saved:

1. Get the session's duration_seconds.
   If duration_seconds is null (shouldn't happen at this point),
   calculate it from the transcription timestamps
   (last word end time - first word start time).

2. Call usage.recordUsage(userId, sessionId, durationSeconds).

3. Also update the session row with the final duration_seconds
   if it was null.

Make sure recordUsage is called ONLY on successful processing,
not on errors. We don't want to count failed sessions against
the user's quota.
```

### Prompt 3.3 — Plan switching endpoint

```
Add backend endpoint for switching plans (without Stripe for now).

1. POST /users/me/subscription/change-plan
   Body: { planId: 'free' | 'pro' | 'team' }

   - Validates the plan exists and is active
   - Updates the subscription row:
     - plan_id = new plan
     - Recalculate current_period_start and current_period_end
       based on the new plan's period_type
     - If downgrading from a paid plan, set stripe_subscription_id = null
   - Returns the updated subscription

2. For now, any user can switch to Pro/Team without payment.
   When we add Stripe, we'll gate paid upgrades behind payment.
   Add a TODO comment where the Stripe check should go.

3. After plan change, the usage limits take effect immediately.
   The user's existing usage_records still count — if they
   downgrade from Pro (50h/month) to Free (2h/week) mid-period,
   they might already be over the Free limit. That's fine —
   the usage service will correctly report isLimitReached=true.
```

**Checkpoint:** usage endpoints work, pipeline records usage, plan switching works. Commit: `feat(api): usage and subscription endpoints`

---

## FASE 4: Environment variables and admin configuration

### Prompt 4.1 — Centralize configuration

```
Make sure all thresholds and limits are configurable and documented.

1. Update .env.example with ALL new variables:

   # Admin
   ADMIN_API_KEY=your_admin_api_key

   # Plan defaults (used only for initial seed, after that use DB)
   # These are NOT read at runtime — the plans table is the source of truth.
   # To change limits, update the plans table directly or use the admin endpoint.

2. Create an admin-only endpoint to update plan configuration:
   PATCH /admin/plans/:id
   Body: { maxSecondsPerPeriod?: number, isActive?: boolean }

   Protect this with a simple API key check (ADMIN_API_KEY from env).
   This lets you change limits without redeploying.

   Add ADMIN_API_KEY to .env.example.

3. Add a comment block at the top of the usage service explaining:
   - How the rolling weekly window works for Free
   - How the calendar monthly window works for Pro
   - How to change limits (update plans table or use admin endpoint)
   - Edge cases: what happens when a user downgrades mid-period
```

**Checkpoint:** all configuration is clean and documented. Commit: `feat(api): admin plan configuration endpoint`

---

## Summary of new API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/plans` | Public | List all active plans |
| GET | `/users/me/usage` | JWT | Current usage and limits |
| GET | `/users/me/subscription` | JWT | Current subscription details |
| POST | `/users/me/subscription/change-plan` | JWT | Switch plan |
| PATCH | `/admin/plans/:id` | Admin API key | Update plan config |

## New database tables

| Table | Purpose |
|-------|---------|
| `plans` | Plan configuration (id, name, limits, period, providers, price) |
| `subscriptions` | One active subscription per user (links user → plan, Stripe fields, period dates) |
| `usage_records` | Logs each session's duration for quota calculation |

## Data flow

```
User clicks Record in extension
        │
        ▼
Extension calls GET /users/me/usage
        │
        ├── isLimitReached=true → Disable Record, show upgrade CTA
        │
        └── isLimitReached=false → Allow recording
                │
                ▼
        Recording happens (with countdown based on remainingSeconds)
                │
                ▼
        Upload audio → Processing pipeline
                │
                ▼
        Report generated → usage.recordUsage(duration)
                │
                ▼
        Next time user opens extension → updated usage shown
```

## Notes

- The Free tier's rolling weekly window means the limit resets gradually, not all at once. If a user recorded 1h on Monday and 1h on Wednesday, by next Monday the Monday hour "falls off" and they get it back.
- For the Pro tier, the monthly window is tied to the subscription period (current_period_start to current_period_end), not calendar month.
- Stripe integration is intentionally deferred. Plan switching works without payment for now — gate it behind Stripe later.
- Provider switching (Groq vs OpenAI/Anthropic) is deferred to Phase C. The `analysis_provider` and `stt_provider` columns exist in the `plans` table but are not used for routing in this phase.
