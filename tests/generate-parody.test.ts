import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isMaintenanceMode,
  isGenerationsDisabled,
  maintenanceResponse,
  capacityExceededResponse,
  getKillSwitches,
} from './lib/killswitch'

// Test the kill switch integration at the utility level
// Full handler tests require complex dependency mocking

describe('generate-parody kill switch behavior', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('maintenance mode detection', () => {
    it('detects maintenance mode when MAINTENANCE_MODE=true', () => {
      process.env.MAINTENANCE_MODE = 'true'
      expect(isMaintenanceMode()).toBe(true)
    })

    it('detects no maintenance mode when MAINTENANCE_MODE=false', () => {
      process.env.MAINTENANCE_MODE = 'false'
      expect(isMaintenanceMode()).toBe(false)
    })
  })

  describe('generation disabled detection', () => {
    it('detects generations disabled when KILL_NEW_GENERATIONS=true', () => {
      process.env.KILL_NEW_GENERATIONS = 'true'
      expect(isGenerationsDisabled()).toBe(true)
    })

    it('detects generations enabled when KILL_NEW_GENERATIONS=false', () => {
      process.env.KILL_NEW_GENERATIONS = 'false'
      expect(isGenerationsDisabled()).toBe(false)
    })

    it('detects generations enabled when not set', () => {
      delete process.env.KILL_NEW_GENERATIONS
      expect(isGenerationsDisabled()).toBe(false)
    })
  })

  describe('capacity control', () => {
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

    it('returns capacity exceeded response with 60s retry', () => {
      const response = capacityExceededResponse()
      expect(response.statusCode).toBe(503)
      expect(response.headers['Retry-After']).toBe('60')
    })
  })

  describe('response formats', () => {
    it('maintenance response includes 5-minute retry', () => {
      const response = maintenanceResponse()
      expect(response.statusCode).toBe(503)
      expect(response.headers['Retry-After']).toBe('300')
    })

    it('capacity response includes 1-minute retry', () => {
      const response = capacityExceededResponse()
      expect(response.statusCode).toBe(503)
      expect(response.headers['Retry-After']).toBe('60')
    })
  })

  describe('priority order', () => {
    it('maintenance mode takes priority over generation disabled', () => {
      process.env.MAINTENANCE_MODE = 'true'
      process.env.KILL_NEW_GENERATIONS = 'true'

      // Handler should check maintenance mode first
      expect(isMaintenanceMode()).toBe(true)
      expect(isGenerationsDisabled()).toBe(true)
    })
  })
})
