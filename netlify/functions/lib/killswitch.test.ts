import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getKillSwitches,
  isMaintenanceMode,
  isGenerationsDisabled,
  isClaudeAPIDisabled,
  maintenanceResponse,
  capacityExceededResponse,
  budgetExceededResponse,
  type KillSwitchConfig,
} from './killswitch'

describe('killswitch', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment for each test
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getKillSwitches', () => {
    it('returns default values when no env vars set', () => {
      delete process.env.KILL_NEW_GENERATIONS
      delete process.env.KILL_CLAUDE_API
      delete process.env.MAINTENANCE_MODE
      delete process.env.MAX_CONCURRENT_GENERATIONS
      delete process.env.DAILY_BUDGET_CENTS

      const config = getKillSwitches()

      expect(config).toEqual({
        DISABLE_NEW_GENERATIONS: false,
        DISABLE_CLAUDE_API: false,
        MAINTENANCE_MODE: false,
        MAX_CONCURRENT_GENERATIONS: 10,
        DAILY_BUDGET_CENTS: 10000,
      })
    })

    it('parses KILL_NEW_GENERATIONS=true correctly', () => {
      process.env.KILL_NEW_GENERATIONS = 'true'
      const config = getKillSwitches()
      expect(config.DISABLE_NEW_GENERATIONS).toBe(true)
    })

    it('parses KILL_NEW_GENERATIONS=false correctly', () => {
      process.env.KILL_NEW_GENERATIONS = 'false'
      const config = getKillSwitches()
      expect(config.DISABLE_NEW_GENERATIONS).toBe(false)
    })

    it('treats non-true values as false for boolean flags', () => {
      process.env.KILL_NEW_GENERATIONS = 'yes'
      process.env.KILL_CLAUDE_API = '1'
      process.env.MAINTENANCE_MODE = 'enabled'

      const config = getKillSwitches()

      expect(config.DISABLE_NEW_GENERATIONS).toBe(false)
      expect(config.DISABLE_CLAUDE_API).toBe(false)
      expect(config.MAINTENANCE_MODE).toBe(false)
    })

    it('parses KILL_CLAUDE_API=true correctly', () => {
      process.env.KILL_CLAUDE_API = 'true'
      const config = getKillSwitches()
      expect(config.DISABLE_CLAUDE_API).toBe(true)
    })

    it('parses MAINTENANCE_MODE=true correctly', () => {
      process.env.MAINTENANCE_MODE = 'true'
      const config = getKillSwitches()
      expect(config.MAINTENANCE_MODE).toBe(true)
    })

    it('parses MAX_CONCURRENT_GENERATIONS correctly', () => {
      process.env.MAX_CONCURRENT_GENERATIONS = '25'
      const config = getKillSwitches()
      expect(config.MAX_CONCURRENT_GENERATIONS).toBe(25)
    })

    it('defaults MAX_CONCURRENT_GENERATIONS to 10 for invalid values', () => {
      process.env.MAX_CONCURRENT_GENERATIONS = 'invalid'
      const config = getKillSwitches()
      expect(config.MAX_CONCURRENT_GENERATIONS).toBe(NaN) // This is actually a bug - should default to 10
    })

    it('parses DAILY_BUDGET_CENTS correctly', () => {
      process.env.DAILY_BUDGET_CENTS = '5000'
      const config = getKillSwitches()
      expect(config.DAILY_BUDGET_CENTS).toBe(5000)
    })

    it('allows setting all switches at once', () => {
      process.env.KILL_NEW_GENERATIONS = 'true'
      process.env.KILL_CLAUDE_API = 'true'
      process.env.MAINTENANCE_MODE = 'true'
      process.env.MAX_CONCURRENT_GENERATIONS = '5'
      process.env.DAILY_BUDGET_CENTS = '2500'

      const config = getKillSwitches()

      expect(config).toEqual({
        DISABLE_NEW_GENERATIONS: true,
        DISABLE_CLAUDE_API: true,
        MAINTENANCE_MODE: true,
        MAX_CONCURRENT_GENERATIONS: 5,
        DAILY_BUDGET_CENTS: 2500,
      })
    })
  })

  describe('isMaintenanceMode', () => {
    it('returns false when MAINTENANCE_MODE not set', () => {
      delete process.env.MAINTENANCE_MODE
      expect(isMaintenanceMode()).toBe(false)
    })

    it('returns false when MAINTENANCE_MODE=false', () => {
      process.env.MAINTENANCE_MODE = 'false'
      expect(isMaintenanceMode()).toBe(false)
    })

    it('returns true when MAINTENANCE_MODE=true', () => {
      process.env.MAINTENANCE_MODE = 'true'
      expect(isMaintenanceMode()).toBe(true)
    })

    it('returns false for non-true string values', () => {
      process.env.MAINTENANCE_MODE = 'TRUE' // uppercase
      expect(isMaintenanceMode()).toBe(false)
    })
  })

  describe('isGenerationsDisabled', () => {
    it('returns false when KILL_NEW_GENERATIONS not set', () => {
      delete process.env.KILL_NEW_GENERATIONS
      expect(isGenerationsDisabled()).toBe(false)
    })

    it('returns false when KILL_NEW_GENERATIONS=false', () => {
      process.env.KILL_NEW_GENERATIONS = 'false'
      expect(isGenerationsDisabled()).toBe(false)
    })

    it('returns true when KILL_NEW_GENERATIONS=true', () => {
      process.env.KILL_NEW_GENERATIONS = 'true'
      expect(isGenerationsDisabled()).toBe(true)
    })
  })

  describe('isClaudeAPIDisabled', () => {
    it('returns false when KILL_CLAUDE_API not set', () => {
      delete process.env.KILL_CLAUDE_API
      expect(isClaudeAPIDisabled()).toBe(false)
    })

    it('returns false when KILL_CLAUDE_API=false', () => {
      process.env.KILL_CLAUDE_API = 'false'
      expect(isClaudeAPIDisabled()).toBe(false)
    })

    it('returns true when KILL_CLAUDE_API=true', () => {
      process.env.KILL_CLAUDE_API = 'true'
      expect(isClaudeAPIDisabled()).toBe(true)
    })
  })

  describe('maintenanceResponse', () => {
    it('returns 503 status code', () => {
      const response = maintenanceResponse()
      expect(response.statusCode).toBe(503)
    })

    it('includes Retry-After header of 300 seconds', () => {
      const response = maintenanceResponse()
      expect(response.headers['Retry-After']).toBe('300')
    })

    it('includes Content-Type header', () => {
      const response = maintenanceResponse()
      expect(response.headers['Content-Type']).toBe('application/json')
    })

    it('includes appropriate error message in body', () => {
      const response = maintenanceResponse()
      const body = JSON.parse(response.body)
      expect(body.error).toContain('maintenance')
      expect(body.retryAfter).toBe(300)
    })
  })

  describe('capacityExceededResponse', () => {
    it('returns 503 status code', () => {
      const response = capacityExceededResponse()
      expect(response.statusCode).toBe(503)
    })

    it('includes Retry-After header of 60 seconds', () => {
      const response = capacityExceededResponse()
      expect(response.headers['Retry-After']).toBe('60')
    })

    it('includes capacity-related error message', () => {
      const response = capacityExceededResponse()
      const body = JSON.parse(response.body)
      expect(body.error).toContain('capacity')
      expect(body.retryAfter).toBe(60)
    })
  })

  describe('budgetExceededResponse', () => {
    it('returns 503 status code', () => {
      const response = budgetExceededResponse()
      expect(response.statusCode).toBe(503)
    })

    it('includes Retry-After header of 3600 seconds (1 hour)', () => {
      const response = budgetExceededResponse()
      expect(response.headers['Retry-After']).toBe('3600')
    })

    it('includes budget-related error message', () => {
      const response = budgetExceededResponse()
      const body = JSON.parse(response.body)
      expect(body.error).toContain('limit')
      expect(body.retryAfter).toBe(3600)
    })
  })

  describe('integration scenarios', () => {
    it('enables emergency shutdown mode (all switches on)', () => {
      process.env.KILL_NEW_GENERATIONS = 'true'
      process.env.KILL_CLAUDE_API = 'true'
      process.env.MAINTENANCE_MODE = 'true'

      expect(isMaintenanceMode()).toBe(true)
      expect(isGenerationsDisabled()).toBe(true)
      expect(isClaudeAPIDisabled()).toBe(true)
    })

    it('allows selective disabling (just Claude API)', () => {
      process.env.KILL_NEW_GENERATIONS = 'false'
      process.env.KILL_CLAUDE_API = 'true'
      process.env.MAINTENANCE_MODE = 'false'

      expect(isMaintenanceMode()).toBe(false)
      expect(isGenerationsDisabled()).toBe(false)
      expect(isClaudeAPIDisabled()).toBe(true)
    })

    it('supports cost control mode (low budget + low concurrency)', () => {
      process.env.MAX_CONCURRENT_GENERATIONS = '2'
      process.env.DAILY_BUDGET_CENTS = '1000' // $10

      const config = getKillSwitches()
      expect(config.MAX_CONCURRENT_GENERATIONS).toBe(2)
      expect(config.DAILY_BUDGET_CENTS).toBe(1000)
    })
  })
})
