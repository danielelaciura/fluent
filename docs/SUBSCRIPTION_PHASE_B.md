# Phase B — Extension & Web UI for Usage Awareness

> Step-by-step prompts for Claude Code.
> Prerequisite: Phase A (subscription infrastructure) is complete — the backend
> has `plans`, `subscriptions`, `usage_records` tables and the usage/subscription
> API endpoints.

---

## Overview

Add usage awareness to the Chrome extension and web dashboard:

- **Extension:** check limits before recording, show usage progress, auto-stop at limit, plan badge.
- **Web:** usage card on homepage, subscription page with plan comparison and upgrade/downgrade flow.

---

## FASE 1: Chrome Extension — Usage awareness

### Prompt 1.1 — Usage check before recording

```
Update the Chrome extension to check usage limits before allowing
a recording to start.

1. When the extension popup opens (or when the user navigates to
   a Google Meet tab), call GET /users/me/usage to get current usage.

2. Show usage info in the popup:
   - A progress bar showing used/total hours
     (e.g. "1h 12m / 2h this week" for free,
      or "8h 30m / 50h this month" for pro)
   - The progress bar color changes:
     - Green: < 70% used
     - Amber: 70-90% used
     - Red: > 90% used

3. If isLimitReached === true:
   - DISABLE the Record button (greyed out, not clickable)
   - Show a message: "You've reached your weekly limit."
   - Show a "Upgrade to Pro" button/link that opens the
     web dashboard pricing page
   - For Pro users at limit: "You've reached your monthly limit.
     It resets on {periodEnd date}."

4. If allowed but remainingSeconds < 900 (less than 15 min left):
   - Show a warning: "You have X minutes remaining this week."
   - Still allow recording but make the warning visible.

5. Cache the usage data for 60 seconds to avoid hammering the API.
   Refresh when the popup is opened or when a recording ends.
```

### Prompt 1.2 — Auto-stop at limit during recording

```
Handle the edge case where a user starts recording with some
remaining quota and runs out mid-meeting.

1. When a recording starts, store the remainingSeconds value.

2. Start a countdown timer alongside the recording timer.

3. When remainingSeconds reaches 300 (5 minutes left):
   - Show a non-intrusive notification in the popup:
     "5 minutes of recording remaining."
   - Change the recording indicator to amber.

4. When remainingSeconds reaches 0:
   - Auto-stop the recording.
   - Show a notification: "Recording stopped — weekly limit reached."
   - Proceed with normal upload flow for the audio captured so far.
   - The user still gets a report for whatever was recorded.

5. Do NOT cut the recording abruptly in the middle of a sentence.
   When the countdown hits 0, let the current audio chunk finish
   (MediaRecorder.ondataavailable fires on the next timeslice),
   then stop. A few extra seconds over the limit are acceptable.
```

### Prompt 1.3 — Plan badge in extension

```
Show the user's current plan in the extension popup.

1. Next to the user's name/avatar in the popup, show a small badge:
   - Free plan: "FREE" badge in grey
   - Pro plan: "PRO" badge in brand blue with a subtle glow/shine
   - Team plan: "TEAM" badge in brand blue

2. For Free users, add a small link under the usage bar:
   "Upgrade to Pro for unlimited recording →"
   Opens the pricing/upgrade page in a new tab.

3. For Pro users, show: "Pro Plan · Resets {date}"
```

**Checkpoint:** extension respects usage limits. Commit: `feat(ext): usage limits and plan awareness`

---

## FASE 2: Frontend Dashboard — Usage and subscription UI

### Prompt 2.1 — Usage display on homepage

```
Add usage information to the web dashboard homepage.

1. At the top of the HomePage, above the sessions list, add a
   "Usage" card that shows:
   - Plan name and badge (same styling as extension)
   - Usage progress bar (same logic: green/amber/red)
   - Text: "1h 12m used of 2h this week" (for free)
     or "8h 30m used of 50h this month" (for pro)
   - If limit reached: red text "Limit reached" with reset info

2. For Free users, add a subtle banner below the usage card:
   "Get unlimited sessions and premium AI analysis with Pro."
   With a "View Plans" button.

3. Call GET /users/me/usage on page load. Show skeleton while loading.
```

### Prompt 2.2 — Subscription page

```
Create a new page: /subscription (add to nav as "Plan").

1. Show current plan details:
   - Plan name, price, period type
   - Current usage with progress bar
   - Period dates (start/end)
   - For Pro: Stripe subscription status

2. Plan comparison section:
   - Cards for Free, Pro, and Team
   - Feature comparison:
     Free: 2h/week, Basic AI analysis,
       Grammar + Fluency report
     Pro: 50h/month, Premium AI analysis (Claude),
       Full report with all categories, Progress tracking,
       Priority processing
     Team: Pro features + admin dashboard, team analytics
   - Current plan highlighted with "Current Plan" badge
   - Other plans have CTA buttons:
     - Free → Pro: "Upgrade to Pro — €14.99/month"
     - Pro → Free: "Downgrade to Free" (smaller, less prominent)

3. For now, the Upgrade button opens a placeholder:
   "Stripe integration coming soon. Contact us to get Pro access."
   We'll add Stripe in a later phase.

4. The Downgrade button shows a confirmation dialog:
   "Are you sure? You'll lose access to premium analysis
   and your limit will change to 2h/week."
   On confirm: call POST /users/me/subscription/change-plan.
```

**Checkpoint:** full subscription flow works in dashboard and extension. Commit: `feat: subscription management and plan switching UI`

---

## Notes

- The plan switching endpoint (POST /users/me/subscription/change-plan) is implemented in Phase A. This phase only builds the UI that calls it.
- Stripe payment integration is deferred. Upgrade buttons show a placeholder for now.
- Usage data is fetched from GET /users/me/usage (implemented in Phase A).
