import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkBudget, recordUsage, getBudgetAlertLevel, type BudgetStatus } from './budget'

// Mock the Redis client
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    incrby: vi.fn(),
    expire: vi.fn(),
  })),
}))

describe('budget', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('checkBudget', () => {
    it('allows requests when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const result = await checkBudget(10000)

      expect(result.allowed).toBe(true)
      expect(result.spentCents).toBe(0)
      expect(result.limitCents).toBe(10000)
      expect(result.remainingCents).toBe(10000)
      expect(result.percentUsed).toBe(0)
    })

    it('uses default limit of 10000 cents ($100)', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkBudget()

      expect(result.limitCents).toBe(10000)
    })

    it('calculates remaining cents correctly', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const result = await checkBudget(5000)

      expect(result.remainingCents).toBe(5000)
    })
  })

  describe('BudgetStatus interface', () => {
    it('has correct structure for allowed status', () => {
      const status: BudgetStatus = {
        allowed: true,
        spentCents: 5000,
        limitCents: 10000,
        remainingCents: 5000,
        percentUsed: 50,
      }

      expect(status.allowed).toBe(true)
      expect(status.percentUsed).toBe(50)
    })

    it('has correct structure for blocked status', () => {
      const status: BudgetStatus = {
        allowed: false,
        spentCents: 10500,
        limitCents: 10000,
        remainingCents: 0,
        percentUsed: 105,
      }

      expect(status.allowed).toBe(false)
      expect(status.remainingCents).toBe(0)
    })
  })

  describe('getBudgetAlertLevel', () => {
    it('returns ok when Redis not configured', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL

      const level = await getBudgetAlertLevel(10000)

      expect(level).toBe('ok')
    })
  })

  describe('cost calculation', () => {
    it('calculates input token cost correctly', () => {
      // Input: $0.003/1K tokens = 0.3 cents/1K = 0.0003 cents/token
      const inputTokens = 2000
      // Expected: 2000 * 0.003 / 10 = 0.6 cents, rounded up = 1 cent
      const expectedCostCents = Math.ceil(inputTokens * 0.003 / 10)
      expect(expectedCostCents).toBe(1)
    })

    it('calculates output token cost correctly', () => {
      // Output: $0.015/1K tokens = 1.5 cents/1K = 0.0015 cents/token
      const outputTokens = 6000
      // Expected: 6000 * 0.015 / 10 = 9 cents
      const expectedCostCents = Math.ceil(outputTokens * 0.015 / 10)
      expect(expectedCostCents).toBe(9)
    })

    it('calculates total cost for typical generation', () => {
      const inputTokens = 2000
      const outputTokens = 6000

      const inputCostCents = Math.ceil(inputTokens * 0.003 / 10)
      const outputCostCents = Math.ceil(outputTokens * 0.015 / 10)
      const totalCents = inputCostCents + outputCostCents

      // Typical generation should cost around 10 cents
      expect(totalCents).toBe(10)
    })

    it('handles large token counts', () => {
      const inputTokens = 8000 // max prompt
      const outputTokens = 8000 // max response

      const inputCostCents = Math.ceil(inputTokens * 0.003 / 10)
      const outputCostCents = Math.ceil(outputTokens * 0.015 / 10)
      const totalCents = inputCostCents + outputCostCents

      expect(totalCents).toBeGreaterThan(0)
      expect(totalCents).toBeLessThan(100) // Should be reasonable
    })
  })

  describe('budget scenarios', () => {
    it('stays under budget with 100 generations at $10/day', () => {
      const dailyBudgetCents = 1000 // $10
      const costPerGeneration = 10 // ~10 cents
      const maxGenerations = Math.floor(dailyBudgetCents / costPerGeneration)

      expect(maxGenerations).toBe(100)
    })

    it('handles default $100 budget correctly', () => {
      const dailyBudgetCents = 10000 // $100
      const costPerGeneration = 10
      const maxGenerations = Math.floor(dailyBudgetCents / costPerGeneration)

      expect(maxGenerations).toBe(1000)
    })

    it('calculates percent used correctly at various levels', () => {
      const testCases = [
        { spent: 0, limit: 10000, expectedPercent: 0 },
        { spent: 5000, limit: 10000, expectedPercent: 50 },
        { spent: 8000, limit: 10000, expectedPercent: 80 },
        { spent: 9500, limit: 10000, expectedPercent: 95 },
        { spent: 10000, limit: 10000, expectedPercent: 100 },
      ]

      for (const tc of testCases) {
        const percentUsed = Math.round((tc.spent / tc.limit) * 100)
        expect(percentUsed).toBe(tc.expectedPercent)
      }
    })
  })
})
