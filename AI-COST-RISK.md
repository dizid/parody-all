# AI Cost Risk — ESCALATED (not disabled)

**Date:** 2026-07-25
**Status:** Escalated for CEO decision — NO changes made to `generate-parody-background.ts`, `generate-parody.ts`, `regenerate-parody.ts`, or any other code
**Risk level (scanner flag):** Critical 60 — Anthropic-calling function, no auth, no rate limiting

## Why this was escalated instead of disabled

The task instructions required stopping before disabling anything if there was evidence of
real paying users or revenue. That evidence exists here.

## What was found

1. **Real, live-mode Clerk authentication** — not a stub or unused import:
   - `netlify/functions/lib/auth.ts` calls `@clerk/backend`'s `verifyToken()` against
     `CLERK_SECRET_KEY` and rejects on missing/invalid/expired tokens.
   - Local `.env` holds `CLERK_SECRET_KEY=sk_live_...` and
     `VITE_CLERK_PUBLISHABLE_KEY=pk_live_...` — **live** mode keys, not `sk_test_`/`pk_test_`
     placeholders.
   - `generate-parody.ts` (the public "start a parody" endpoint) and `regenerate-parody.ts`
     both call `verifyAuth()` and hard-reject unauthenticated requests before ever touching
     Claude.

2. **Real Stripe billing, live mode:**
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` and `VITE_STRIPE_PRICE_ID=price_1S...` in
     `.env` — real Stripe price ID format (`price_1...`), not the `price_xxx` placeholder
     seen in `.env.example`.
   - `create-checkout.ts` creates real Stripe customers/checkout sessions tied to the
     authenticated Clerk `userId`.
   - `stripe-webhook.ts` verifies the Stripe signature and handles
     `checkout.session.completed`, `customer.subscription.created/updated`, and
     `customer.subscription.deleted` — mapping `STRIPE_SINGLE_PRICE_ID` /
     `STRIPE_SPARK_PRICE_ID` / `STRIPE_CREATOR_PRICE_ID` to real tier upgrades and credit
     grants in the `profiles` table. This is a complete, functioning payment flow, not a
     stub.

3. **Real billing schema** (`schema.sql`, Neon Postgres):
   - `profiles` table: `tier` (`free`/`single`/`creator`/`pro`), `parodies_used`,
     `parodies_limit`, `stripe_customer_id`, `stripe_subscription_id` — only makes sense
     with a live paid tier enforcing limits.
   - `parodies` table has `user_id` FK to `profiles`, per-parody `status` and 7-day expiry —
     a production data model, not a demo table.

4. **Active, ongoing product development**, not an abandoned prototype:
   - 28 commits from 2026-01-10 through 2026-04-05, including a full "Humor + sharing +
     pricing overhaul (Sprints 1–3)" and a pricing-tier simplification, both dated
     2026-03-30, and a PlugAff affiliate-tracking integration added 2026-04-01 and refined
     2026-04-05.
   - `sales/proposals/2026-03-29-parodyhumor-monetization-redesign.md` (untracked, part of
     unrelated in-progress work — not touched by this audit) is a detailed internal pricing
     strategy doc with concrete Stripe price-ID and schema-migration next steps, dated the
     same week as the last pricing-overhaul commits — consistent with a business that was
     actively being run and iterated on, not a dead demo.

5. **The flagged function's exposure is real, and slightly worse than the scanner alone
   suggests** — there are actually **two** unauthenticated paths into it, not one:
   - `generate-parody.ts` → fetches `generate-parody-background` server-to-server after
     auth + rate limit + tier-limit checks pass (the intended flow).
   - `regenerate-parody.ts` → also fetches `generate-parody-background` server-to-server,
     again after its own auth + ownership + credit checks (also an intended, protected
     flow).
   - **However**, unlike clientpilot's equivalent background function, `generate-parody-background.ts`
     itself has **no internal shared-secret header check** (confirmed:
     `grep -rn "x-internal|internal-secret|shared-secret" netlify/functions/` returns
     nothing, and the function performs zero auth/signature verification of its own). Its
     Netlify Functions URL (`/.netlify/functions/generate-parody-background`) is directly,
     publicly POST-able by anyone, bypassing Clerk auth, the 5/hour rate limit, the
     concurrent-generation cap, and the free-tier 2-parody limit entirely — those all live
     only in the two callers above, not in the function that actually spends money.
   - The only protections *inside* the background function itself are a maintenance/kill-switch
     env flag (`KILL_CLAUDE_API`, off by default) and a global daily-budget check via
     Upstash Redis. Per this repo's own `LOAD.md`: *"Skip Redis for now. The code degrades
     gracefully without it"* — meaning if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`
     are not set in the live Netlify environment, **both** per-user rate limiting (in the
     callers) **and** the daily budget cutoff (in the background function) silently no-op
     and allow every request. This audit did not check Netlify's live env vars (out of
     scope for a code-only audit) — that is the first thing to verify.
   - A request to the background endpoint also doesn't need a real `parodyId`: the handler
     looks one up for the notification email/slug, but proceeds to run two Claude calls
     (site analysis + generation, each with up to 3 retries) and a Firecrawl scrape
     regardless of whether the row exists, and the `UPDATE parodies ... WHERE id = X` calls
     are simply no-ops if it doesn't.

## What was NOT done

- `generate-parody-background.ts` was **not** modified
- `generate-parody.ts` and `regenerate-parody.ts` were **not** modified
- No `DEMO_MODE` flag, mock response, or other guard was added
- No SQL was run against the database
- No Netlify environment variables were read or changed
- No other files were touched

## Recommendation: harden, don't disable (pending verification)

This is not a decision — it's a fork for the CEO, gated on one query:

1. **Confirm real usage directly in the database** before any action (read-only, run
   manually — this audit did not execute it):
   ```sql
   SELECT COUNT(*) AS total_profiles,
          COUNT(*) FILTER (WHERE stripe_customer_id IS NOT NULL) AS paying_customers,
          COUNT(*) FILTER (WHERE tier NOT IN ('free', 'none')) AS non_free_tier
   FROM profiles;

   SELECT COUNT(*) AS parodies_last_30d
   FROM parodies
   WHERE created_at > now() - interval '30 days';
   ```

2. **If `paying_customers` / `non_free_tier` / `parodies_last_30d` are nonzero:** this is a
   live, revenue-generating product. Disabling the Anthropic call would break generation
   for paying customers — worse than the cost-risk the scanner flagged. Recommended next
   step instead, in priority order:
   - Add an internal shared-secret header check to `generate-parody-background.ts` (same
     pattern clientpilot already has), so it can only be invoked by `generate-parody.ts` /
     `regenerate-parody.ts`, not directly by the public internet. This closes the actual gap
     — the front doors are already properly authenticated and rate-limited.
   - Verify `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are actually set in the
     live Netlify environment. If they aren't, per-user rate limiting and the daily budget
     cutoff are currently no-ops in production regardless of the header fix above.
   - Once the header check is in place, a per-IP rate limit on the background function
     itself would be defense in depth, but is lower priority than closing the direct-access
     gap.

3. **If those queries come back zero/near-zero:** despite the live Stripe/Clerk keys, this
   would mean no real customers have gone through the funnel yet — safe to disable via the
   standard `DEMO_MODE` env-flag pattern instead, per the original plan.

No code changes have been made; this file exists purely to surface the decision for the CEO.
