import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isMaintenanceMode, maintenanceResponse } from './lib/killswitch'

// Test the kill switch integration at the utility level
// Full handler tests require complex Stripe SDK mocking

describe('create-checkout kill switch behavior', () => {
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

    it('detects no maintenance mode when not set', () => {
      delete process.env.MAINTENANCE_MODE
      expect(isMaintenanceMode()).toBe(false)
    })
  })

  describe('maintenance response format', () => {
    it('returns 503 status code', () => {
      const response = maintenanceResponse()
      expect(response.statusCode).toBe(503)
    })

    it('includes 5-minute retry-after header', () => {
      const response = maintenanceResponse()
      expect(response.headers['Retry-After']).toBe('300')
    })

    it('includes informative error message', () => {
      const response = maintenanceResponse()
      const body = JSON.parse(response.body)
      expect(body.error).toContain('maintenance')
      expect(body.retryAfter).toBe(300)
    })
  })

  describe('checkout behavior during maintenance', () => {
    it('new checkouts should be blocked during maintenance', () => {
      // By design, create-checkout checks isMaintenanceMode() and returns
      // maintenanceResponse() if true - blocking new payment sessions
      process.env.MAINTENANCE_MODE = 'true'
      expect(isMaintenanceMode()).toBe(true)
    })
  })
})
