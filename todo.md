# Parody Everything - Environment Variables Audit

## CRITICAL - Missing Required Vars

| Variable | Status | Notes |
|----------|--------|-------|
| `STRIPE_SINGLE_PRICE_ID` | Missing | Needed for $49 one-time purchase |
| `STRIPE_CREATOR_PRICE_ID` | Missing | Needed for $299/mo subscription |
| `STRIPE_PRO_PRICE_ID` | Missing | Needed for $599/mo subscription |

**Note:** Current Stripe prices don't match premium pricing. Need to create:
- $49 one-time (single parody)
- $299/mo subscription (creator - 10 parodies)
- $599/mo subscription (pro - unlimited)

## PRESENT - Core Vars

| Variable | Status |
|----------|--------|
| `VITE_CLERK_PUBLISHABLE_KEY` | OK |
| `CLERK_SECRET_KEY` | OK |
| `DATABASE_URL` | OK |
| `VITE_STRIPE_PUBLISHABLE_KEY` | OK |
| `STRIPE_SECRET_KEY` | OK |
| `STRIPE_WEBHOOK_SECRET` | OK |
| `VITE_STRIPE_PRICE_ID` | OK |
| `ANTHROPIC_API_KEY` | OK |
| `TEST_BYPASS_KEY` | OK |
| `FIRECRAWL_API_KEY` | OK |

## OPTIONAL - Missing but have defaults

| Variable | Status | Impact |
|----------|--------|--------|
| `RESEND_API_KEY` | Missing | Email notifications won't work |
| `UPSTASH_REDIS_REST_URL` | Missing | Rate limiting/caching disabled |
| `UPSTASH_REDIS_REST_TOKEN` | Missing | Rate limiting/caching disabled |
| `HEALTH_CHECK_KEY` | Missing | Health endpoint unprotected |
| `MIGRATION_KEY` | Missing | Migration endpoint unprotected |
| Kill switches | Missing | Default to `false` (OK) |

## Action Items

- [ ] Create Stripe prices for premium tiers ($49, $299/mo, $599/mo)
- [ ] Add STRIPE_SINGLE_PRICE_ID to .env.local
- [ ] Add STRIPE_CREATOR_PRICE_ID to .env.local
- [ ] Add STRIPE_PRO_PRICE_ID to .env.local
- [ ] (Optional) Set up Upstash Redis for rate limiting
- [ ] (Optional) Set up Resend for email notifications
