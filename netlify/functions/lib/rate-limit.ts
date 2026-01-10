// Rate limiting using Upstash Redis
// Sliding window rate limiting per user/IP

import { Redis } from '@upstash/redis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  redis = new Redis({ url, token })
  return redis
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

export interface RateLimitConfig {
  max: number           // Max requests allowed
  windowSeconds: number // Time window
}

// Default rate limits per action type
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  generate: { max: 5, windowSeconds: 3600 },      // 5 parodies per hour
  poll: { max: 300, windowSeconds: 60 },          // 300 polls per minute
  api: { max: 100, windowSeconds: 60 },           // 100 API calls per minute
  email: { max: 3, windowSeconds: 3600 },         // 3 email submissions per hour
}

// Check rate limit for user action
export async function checkRateLimit(
  identifier: string,
  action: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[action]
  if (!config) {
    return { allowed: true, remaining: 999, resetInSeconds: 0 }
  }

  const client = getRedis()

  // If Redis not configured, allow all
  if (!client) {
    return { allowed: true, remaining: config.max, resetInSeconds: 0 }
  }

  const key = `ratelimit:${action}:${identifier}`
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - config.windowSeconds

  try {
    // Sliding window using sorted sets
    const pipeline = client.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart)
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` })
    pipeline.zcard(key)
    pipeline.expire(key, config.windowSeconds)

    const results = await pipeline.exec()
    const count = results[2] as number

    return {
      allowed: count <= config.max,
      remaining: Math.max(0, config.max - count),
      resetInSeconds: config.windowSeconds,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Allow on error
    return { allowed: true, remaining: config.max, resetInSeconds: 0 }
  }
}

// Check rate limit by IP (for unauthenticated endpoints)
export async function checkIPRateLimit(
  ip: string,
  action: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  return checkRateLimit(`ip:${ip}`, action)
}

// Check rate limit by user ID
export async function checkUserRateLimit(
  userId: string,
  action: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  return checkRateLimit(`user:${userId}`, action)
}
