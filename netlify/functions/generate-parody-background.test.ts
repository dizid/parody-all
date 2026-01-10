import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isClaudeAPIDisabled, getKillSwitches, budgetExceededResponse } from './lib/killswitch'

// Test the kill switch integration at the utility level
// Full handler tests require complex dependency mocking

describe('generate-parody-background kill switch behavior', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Claude API kill switch', () => {
    it('detects Claude API disabled when KILL_CLAUDE_API=true', () => {
      process.env.KILL_CLAUDE_API = 'true'
      expect(isClaudeAPIDisabled()).toBe(true)
    })

    it('detects Claude API enabled when KILL_CLAUDE_API=false', () => {
      process.env.KILL_CLAUDE_API = 'false'
      expect(isClaudeAPIDisabled()).toBe(false)
    })

    it('detects Claude API enabled when not set', () => {
      delete process.env.KILL_CLAUDE_API
      expect(isClaudeAPIDisabled()).toBe(false)
    })
  })

  describe('budget control', () => {
    it('reads DAILY_BUDGET_CENTS from environment', () => {
      process.env.DAILY_BUDGET_CENTS = '5000'
      const config = getKillSwitches()
      expect(config.DAILY_BUDGET_CENTS).toBe(5000)
    })

    it('defaults DAILY_BUDGET_CENTS to 10000 ($100)', () => {
      delete process.env.DAILY_BUDGET_CENTS
      const config = getKillSwitches()
      expect(config.DAILY_BUDGET_CENTS).toBe(10000)
    })

    it('returns budget exceeded response with retry-after header', () => {
      const response = budgetExceededResponse()
      expect(response.statusCode).toBe(503)
      expect(response.headers['Retry-After']).toBe('3600')
    })
  })

  describe('concurrent generation control', () => {
    it('reads MAX_CONCURRENT_GENERATIONS from environment', () => {
      process.env.MAX_CONCURRENT_GENERATIONS = '5'
      const config = getKillSwitches()
      expect(config.MAX_CONCURRENT_GENERATIONS).toBe(5)
    })

    it('defaults MAX_CONCURRENT_GENERATIONS to 10', () => {
      delete process.env.MAX_CONCURRENT_GENERATIONS
      const config = getKillSwitches()
      expect(config.MAX_CONCURRENT_GENERATIONS).toBe(10)
    })
  })

  describe('emergency shutdown scenario', () => {
    it('all switches can be enabled simultaneously', () => {
      process.env.KILL_NEW_GENERATIONS = 'true'
      process.env.KILL_CLAUDE_API = 'true'
      process.env.MAINTENANCE_MODE = 'true'
      process.env.MAX_CONCURRENT_GENERATIONS = '0'
      process.env.DAILY_BUDGET_CENTS = '0'

      const config = getKillSwitches()

      expect(config.DISABLE_NEW_GENERATIONS).toBe(true)
      expect(config.DISABLE_CLAUDE_API).toBe(true)
      expect(config.MAINTENANCE_MODE).toBe(true)
      expect(config.MAX_CONCURRENT_GENERATIONS).toBe(0)
      expect(config.DAILY_BUDGET_CENTS).toBe(0)
    })
  })
})
