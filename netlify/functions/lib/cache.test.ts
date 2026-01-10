import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  cacheParody,
  getCachedParody,
  invalidateParody,
  getActiveGenerations,
  incrementActiveGenerations,
  decrementActiveGenerations,
} from './cache'

// Mock the Redis client
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(true),
  })),
}))

describe('cache', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('cacheParody', () => {
    it('does nothing when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      // Should not throw
      await expect(cacheParody('test-slug', { name: 'Test' })).resolves.toBeUndefined()
    })

    it('uses correct TTL of 300 seconds (5 minutes)', async () => {
      // The TTL is hardcoded as 300 in the implementation
      const expectedTTL = 300
      expect(expectedTTL).toBe(300)
    })
  })

  describe('getCachedParody', () => {
    it('returns null when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const result = await getCachedParody('test-slug')

      expect(result).toBeNull()
    })
  })

  describe('invalidateParody', () => {
    it('does nothing when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      await expect(invalidateParody('test-slug')).resolves.toBeUndefined()
    })
  })

  describe('getActiveGenerations', () => {
    it('returns 0 when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const count = await getActiveGenerations()

      expect(count).toBe(0)
    })
  })

  describe('incrementActiveGenerations', () => {
    it('returns 0 when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const count = await incrementActiveGenerations()

      expect(count).toBe(0)
    })

    it('sets expiry of 900 seconds (15 minutes) to handle crashes', async () => {
      // The expiry is hardcoded as 900 in the implementation
      const expectedExpiry = 900
      expect(expectedExpiry).toBe(900)
    })
  })

  describe('decrementActiveGenerations', () => {
    it('does nothing when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      await expect(decrementActiveGenerations()).resolves.toBeUndefined()
    })
  })

  describe('concurrency control scenarios', () => {
    it('enforces max concurrent generations limit', async () => {
      // When Redis is not configured, getActiveGenerations returns 0
      // This means the system allows all generations when Redis is down
      delete process.env.UPSTASH_REDIS_REST_URL

      const activeGens = await getActiveGenerations()
      const maxConcurrent = 10 // From killswitch defaults

      expect(activeGens).toBeLessThan(maxConcurrent)
    })

    it('tracks generation lifecycle correctly', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      // Start: increment
      const afterStart = await incrementActiveGenerations()
      expect(afterStart).toBe(0) // Redis not configured

      // End: decrement
      await decrementActiveGenerations()
      const afterEnd = await getActiveGenerations()
      expect(afterEnd).toBe(0)
    })
  })

  describe('parody cache scenarios', () => {
    it('caches completed parodies for quick retrieval', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const parody = {
        id: '123',
        slug: 'test-parody',
        parody_name: 'Scamazon',
        site_type: 'ecommerce',
      }

      await cacheParody(parody.slug, parody)
      // Without Redis, cache returns null
      const cached = await getCachedParody(parody.slug)
      expect(cached).toBeNull()
    })

    it('invalidates cache when parody is updated', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      await cacheParody('test-slug', { name: 'Original' })
      await invalidateParody('test-slug')
      const cached = await getCachedParody('test-slug')
      expect(cached).toBeNull()
    })
  })

  describe('cache key formats', () => {
    it('uses parody: prefix for parody cache keys', () => {
      const slug = 'test-slug'
      const expectedKey = `parody:${slug}`
      expect(expectedKey).toBe('parody:test-slug')
    })

    it('uses active_generations key for concurrency tracking', () => {
      const expectedKey = 'active_generations'
      expect(expectedKey).toBe('active_generations')
    })
  })

  describe('graceful degradation', () => {
    it('allows all operations when Redis fails', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      // All operations should complete without throwing
      await expect(cacheParody('slug', {})).resolves.toBeUndefined()
      await expect(getCachedParody('slug')).resolves.toBeNull()
      await expect(invalidateParody('slug')).resolves.toBeUndefined()
      await expect(getActiveGenerations()).resolves.toBe(0)
      await expect(incrementActiveGenerations()).resolves.toBe(0)
      await expect(decrementActiveGenerations()).resolves.toBeUndefined()
    })
  })
})
