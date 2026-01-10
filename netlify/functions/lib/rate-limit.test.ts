import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  checkRateLimit,
  checkIPRateLimit,
  checkUserRateLimit,
  RATE_LIMITS,
  type RateLimitResult,
  type RateLimitConfig,
} from './rate-limit'

// Mock the Redis client
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    pipeline: vi.fn().mockReturnValue({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([null, null, 0, null]),
    }),
  })),
}))

describe('rate-limit', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('RATE_LIMITS configuration', () => {
    it('defines generate limit as 5 per hour', () => {
      expect(RATE_LIMITS.generate).toEqual({ max: 5, windowSeconds: 3600 })
    })

    it('defines poll limit as 300 per minute', () => {
      expect(RATE_LIMITS.poll).toEqual({ max: 300, windowSeconds: 60 })
    })

    it('defines api limit as 100 per minute', () => {
      expect(RATE_LIMITS.api).toEqual({ max: 100, windowSeconds: 60 })
    })

    it('defines email limit as 3 per hour', () => {
      expect(RATE_LIMITS.email).toEqual({ max: 3, windowSeconds: 3600 })
    })
  })

  describe('checkRateLimit', () => {
    it('allows requests when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const result = await checkRateLimit('user123', 'generate')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5) // generate max
      expect(result.resetInSeconds).toBe(0)
    })

    it('allows unknown action types', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkRateLimit('user123', 'unknown_action' as any)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(999)
    })

    it('returns correct remaining count for generate action', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkRateLimit('user123', 'generate')

      expect(result.remaining).toBe(5)
    })

    it('returns correct remaining count for poll action', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkRateLimit('user123', 'poll')

      expect(result.remaining).toBe(300)
    })
  })

  describe('checkIPRateLimit', () => {
    it('prefixes key with ip:', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkIPRateLimit('192.168.1.1', 'api')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(100)
    })

    it('handles IPv6 addresses', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkIPRateLimit('2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'api')

      expect(result.allowed).toBe(true)
    })
  })

  describe('checkUserRateLimit', () => {
    it('prefixes key with user:', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkUserRateLimit('user_abc123', 'generate')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5)
    })

    it('handles Clerk user IDs', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkUserRateLimit('user_2abc123DEF456', 'generate')

      expect(result.allowed).toBe(true)
    })
  })

  describe('RateLimitResult interface', () => {
    it('has correct structure for allowed request', () => {
      const result: RateLimitResult = {
        allowed: true,
        remaining: 4,
        resetInSeconds: 3600,
      }

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('has correct structure for blocked request', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetInSeconds: 1800,
      }

      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('rate limit scenarios', () => {
    it('allows 5 generations per hour for typical user', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      // First generation
      const result = await checkUserRateLimit('user123', 'generate')
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(5)
    })

    it('allows high poll rate for status checking', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkUserRateLimit('user123', 'poll')
      expect(result.remaining).toBe(300)
    })

    it('limits email submissions to prevent spam', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkUserRateLimit('user123', 'email')
      expect(result.remaining).toBe(3)
    })
  })

  describe('window calculations', () => {
    it('uses 1 hour window for generate', () => {
      expect(RATE_LIMITS.generate.windowSeconds).toBe(3600)
    })

    it('uses 1 minute window for poll', () => {
      expect(RATE_LIMITS.poll.windowSeconds).toBe(60)
    })

    it('uses 1 minute window for api', () => {
      expect(RATE_LIMITS.api.windowSeconds).toBe(60)
    })

    it('uses 1 hour window for email', () => {
      expect(RATE_LIMITS.email.windowSeconds).toBe(3600)
    })
  })
})
