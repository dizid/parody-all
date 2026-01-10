# Load Handling & Scaling Guide

## Current Capacity

After optimizations: **~2,000-5,000 concurrent users** before degradation.

Without optimizations it was ~500.

## What's Implemented

### Always Active (No Setup Required)

| Feature | Impact |
|---------|--------|
| Kill switches | Instant emergency brake via Netlify env vars |
| Health endpoint | `/.netlify/functions/health` for monitoring |
| Exponential backoff polling | 80% fewer API calls (120 → ~25 per generation) |
| Edge caching headers | Static assets cached 1 year, parody pages 1 min |
| Database indexes | Faster queries (run migration to apply) |

### Optional: Upstash Redis

**Skip Redis for now.** The code degrades gracefully without it.

| Feature | Without Redis | With Redis |
|---------|--------------|------------|
| Parody caching | DB hit every request | 5-min cache |
| Rate limiting | No per-user limits | 5 generations/hour/user |
| Budget tracking | No daily cap | $100/day auto-cutoff |
| Concurrency control | No limit | Max 10 simultaneous |

Add Redis later only if you see:
- High DB connections in Neon dashboard
- Need to enforce rate limits
- Want automatic budget protection

## Setup Checklist

### Required

1. **Add kill switch env vars to Netlify:**
   ```
   KILL_NEW_GENERATIONS=false
   KILL_CLAUDE_API=false
   MAINTENANCE_MODE=false
   MAX_CONCURRENT_GENERATIONS=10
   DAILY_BUDGET_CENTS=10000
   HEALTH_CHECK_KEY=your-secret-key
   ```

2. **Run database migration:**
   ```
   https://your-site.netlify.app/.netlify/functions/run-migration?key=YOUR_MIGRATION_KEY
   ```

3. **Switch to Neon pooler endpoint** (in Netlify env vars):
   ```
   DATABASE_URL=postgres://user:pass@ep-xxx-pooler.neon.tech/neondb?sslmode=require&pgbouncer=true
   ```
   (Note the `-pooler` in the hostname)

### Optional

4. **Set up monitoring:**
   - Point Pingdom/Checkly at `/.netlify/functions/health?key=YOUR_KEY`
   - Add Sentry for error tracking

5. **Add Upstash Redis** (only if needed):
   - Create free database at upstash.com
   - Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Netlify

## Emergency Runbook

### If Site Goes Down

```
1. Check /.netlify/functions/health?key=YOUR_KEY
2. Look at Netlify Analytics for traffic spike
3. Check Neon dashboard for connection count
```

### Quick Fixes (Netlify → Site Settings → Environment Variables)

| Problem | Action |
|---------|--------|
| DB overload | Enable Neon autoscaling in Neon dashboard |
| Claude rate limited | Set `KILL_CLAUDE_API=true` |
| General overload | Set `MAINTENANCE_MODE=true` |
| Too many generations | Set `KILL_NEW_GENERATIONS=true` |

### Recovery

1. Fix the underlying issue
2. Set kill switch back to `false`
3. Redeploy (or wait for env var to propagate)

## Cost Estimates at Scale

| Users | Without Optimizations | With Optimizations |
|-------|----------------------|-------------------|
| 1,000 | ~$80/day | ~$20/day |
| 10,000 | ~$800/day | ~$180/day |

Main cost driver: Claude API (~$0.15 per parody generation)

## Files Reference

```
netlify/functions/lib/
  killswitch.ts    # Kill switch utilities
  cache.ts         # Redis caching (optional)
  budget.ts        # Budget tracking (optional)
  rate-limit.ts    # Rate limiting (optional)

netlify/functions/
  health.ts        # Health check endpoint
  run-migration.ts # Database indexes
```
