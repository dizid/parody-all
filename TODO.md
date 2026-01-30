# TODO - Parody Everything

## Environment Variables Audit

### CRITICAL - Missing Required Vars

| Variable | Status | Notes |
|----------|--------|-------|
| `STRIPE_SINGLE_PRICE_ID` | Missing | Needed for $49 one-time purchase |
| `STRIPE_CREATOR_PRICE_ID` | Missing | Needed for $299/mo subscription |
| `STRIPE_PRO_PRICE_ID` | Missing | Needed for $599/mo subscription |

**Note:** Current Stripe prices don't match premium pricing. Need to create:
- $49 one-time (single parody)
- $299/mo subscription (creator - 10 parodies)
- $599/mo subscription (pro - unlimited)

### PRESENT - Core Vars

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

### OPTIONAL - Missing but have defaults

| Variable | Status | Impact |
|----------|--------|--------|
| `RESEND_API_KEY` | Missing | Email notifications won't work |
| `UPSTASH_REDIS_REST_URL` | Missing | Rate limiting/caching disabled |
| `UPSTASH_REDIS_REST_TOKEN` | Missing | Rate limiting/caching disabled |
| `HEALTH_CHECK_KEY` | Missing | Health endpoint unprotected |
| `MIGRATION_KEY` | Missing | Migration endpoint unprotected |
| Kill switches | Missing | Default to `false` (OK) |

### Action Items

#### Stripe Pricing Setup (in order)

1. [ ] **Create Stripe prices** in Dashboard (https://dashboard.stripe.com/products):
   - Single: $49 one-time product
   - Creator: $299/month recurring
   - Pro: $599/month recurring

2. [ ] **Add to `.env.local`** (frontend needs VITE_ prefix):
   ```bash
   VITE_STRIPE_SINGLE_PRICE_ID=price_xxx
   VITE_STRIPE_CREATOR_PRICE_ID=price_xxx
   VITE_STRIPE_PRO_PRICE_ID=price_xxx
   ```

3. [ ] **Add to `.env.local`** (backend for webhook):
   ```bash
   STRIPE_SINGLE_PRICE_ID=price_xxx
   STRIPE_CREATOR_PRICE_ID=price_xxx
   STRIPE_PRO_PRICE_ID=price_xxx
   ```

4. [ ] **Add to Netlify** environment variables (same 6 vars)

5. [ ] **Test the flow**:
   - Single purchase → Stripe checkout (payment mode) → profile updated
   - Creator subscription → Stripe checkout (subscription mode) → profile updated
   - Verify user can generate parody after purchase

#### Code Changes (DONE)
- [x] `DashboardView.vue` - `purchaseCredits()` accepts tier, uses correct price ID
- [x] `create-checkout.ts` - supports subscription mode for creator/pro

#### Optional
- [ ] Set up Upstash Redis for rate limiting
- [ ] Set up Resend for email notifications

---

## Visual Style Extraction (Parody looks like original)

**Problem:** Parodies don't visually resemble the original site. Generic purple/pink theme for everything.

**Solution:** Use Firecrawl screenshot + Claude Vision to extract design DNA.

### What to extract:
- Colors (primary, secondary, background, text)
- Layout (hero-cards, grid, sidebar, single-column, feed)
- Theme (light/dark)
- Typography (corporate, casual, modern, playful, luxury)
- Density (spacious, balanced, compact)
- Brand vibe (free description)

### Files to modify:
1. `generate-parody-background.ts` - Add `extractVisualStyle()` function (~80 lines)
2. `src/types/index.ts` - Extend `ParodyConfig` interface (~10 lines)
3. `src/views/ParodyView.vue` - Apply dynamic CSS variables (~20 lines)

### Cost:
~$0.01 extra per parody (one vision API call)

### Expected result:
- "De Handige Jongens" (green/white contractor) → green/white parody
- Dark mode sites → dark parody
- Playful brands → playful typography

See full implementation details in `.claude/plans/giggly-orbiting-church.md`

---

## Other Ideas

- [ ] Layout templates that match common site structures
- [ ] Font family extraction (Google Fonts detection)
- [ ] Logo style detection (icon, wordmark, combination)
