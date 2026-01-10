// Claude API budget tracking
// Prevents runaway costs during viral traffic

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

export interface BudgetStatus {
  allowed: boolean
  spentCents: number
  limitCents: number
  remainingCents: number
  percentUsed: number
}

// Get today's date key
function getTodayKey(): string {
  return `budget:claude:${new Date().toISOString().split('T')[0]}`
}

// Check if within daily budget
export async function checkBudget(limitCents: number = 10000): Promise<BudgetStatus> {
  const client = getRedis()

  // If Redis not configured, allow but warn
  if (!client) {
    console.warn('Budget tracking disabled - Redis not configured')
    return {
      allowed: true,
      spentCents: 0,
      limitCents,
      remainingCents: limitCents,
      percentUsed: 0,
    }
  }

  try {
    const spent = await client.get(getTodayKey())
    const spentCents = parseInt(spent as string || '0')

    return {
      allowed: spentCents < limitCents,
      spentCents,
      limitCents,
      remainingCents: Math.max(0, limitCents - spentCents),
      percentUsed: Math.round((spentCents / limitCents) * 100),
    }
  } catch (error) {
    console.error('Failed to check budget:', error)
    // Allow on error to avoid blocking all generations
    return {
      allowed: true,
      spentCents: 0,
      limitCents,
      remainingCents: limitCents,
      percentUsed: 0,
    }
  }
}

// Record API usage after generation
// Estimate: ~$0.015 per 1K output tokens for Claude Sonnet
export async function recordUsage(inputTokens: number, outputTokens: number): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    // Pricing estimates (may need adjustment)
    // Input: $0.003/1K tokens = 0.3 cents/1K
    // Output: $0.015/1K tokens = 1.5 cents/1K
    const inputCostCents = Math.ceil(inputTokens * 0.003 / 10)
    const outputCostCents = Math.ceil(outputTokens * 0.015 / 10)
    const totalCents = inputCostCents + outputCostCents

    const key = getTodayKey()
    await client.incrby(key, totalCents)
    await client.expire(key, 86400 * 2) // Keep for 2 days

    console.log(`Recorded usage: ${totalCents} cents (input: ${inputTokens}, output: ${outputTokens})`)
  } catch (error) {
    console.error('Failed to record usage:', error)
  }
}

// Get budget alert status (for monitoring)
export async function getBudgetAlertLevel(limitCents: number = 10000): Promise<'ok' | 'warning' | 'critical'> {
  const status = await checkBudget(limitCents)

  if (status.percentUsed >= 95) return 'critical'
  if (status.percentUsed >= 80) return 'warning'
  return 'ok'
}
