import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import { getKillSwitches } from './lib/killswitch'
import { checkBudget, getBudgetAlertLevel } from './lib/budget'
import { getActiveGenerations } from './lib/cache'

// Health check endpoint for monitoring and automated runbook
// Returns system status and triggers alerts based on thresholds

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: CheckResult
    redis: CheckResult
    killSwitches: KillSwitchStatus
    budget: BudgetStatus
    generations: GenerationStatus
  }
  alerts: Alert[]
}

interface CheckResult {
  status: 'ok' | 'error'
  latencyMs?: number
  error?: string
}

interface KillSwitchStatus {
  maintenanceMode: boolean
  generationsDisabled: boolean
  claudeDisabled: boolean
}

interface BudgetStatus {
  status: 'ok' | 'warning' | 'critical'
  spentCents: number
  limitCents: number
  percentUsed: number
}

interface GenerationStatus {
  activeCount: number
  maxConcurrent: number
  atCapacity: boolean
}

interface Alert {
  severity: 'warning' | 'critical'
  message: string
  action: string
}

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  }

  // Optional auth for detailed health info
  const authKey = event.queryStringParameters?.key
  const isAuthorized = authKey === process.env.HEALTH_CHECK_KEY

  const startTime = Date.now()
  const alerts: Alert[] = []

  // Check database
  let dbCheck: CheckResult = { status: 'error', error: 'Not checked' }
  try {
    const dbStart = Date.now()
    const sql = neon(process.env.DATABASE_URL!)
    await sql`SELECT 1`
    dbCheck = { status: 'ok', latencyMs: Date.now() - dbStart }

    if (dbCheck.latencyMs > 500) {
      alerts.push({
        severity: 'warning',
        message: `Database latency high: ${dbCheck.latencyMs}ms`,
        action: 'Check Neon dashboard for connection pool status',
      })
    }
  } catch (error: any) {
    dbCheck = { status: 'error', error: error.message }
    alerts.push({
      severity: 'critical',
      message: 'Database connection failed',
      action: 'Check DATABASE_URL and Neon status',
    })
  }

  // Check Redis (optional)
  let redisCheck: CheckResult = { status: 'ok' }
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const activeGens = await getActiveGenerations()
      redisCheck = { status: 'ok', latencyMs: Date.now() - startTime }
    } catch (error: any) {
      redisCheck = { status: 'error', error: error.message }
      alerts.push({
        severity: 'warning',
        message: 'Redis connection failed - caching disabled',
        action: 'Check Upstash credentials',
      })
    }
  }

  // Check kill switches
  const killSwitches = getKillSwitches()
  const killSwitchStatus: KillSwitchStatus = {
    maintenanceMode: killSwitches.MAINTENANCE_MODE,
    generationsDisabled: killSwitches.DISABLE_NEW_GENERATIONS,
    claudeDisabled: killSwitches.DISABLE_CLAUDE_API,
  }

  if (killSwitches.MAINTENANCE_MODE) {
    alerts.push({
      severity: 'warning',
      message: 'Maintenance mode is ENABLED',
      action: 'Set MAINTENANCE_MODE=false when ready',
    })
  }

  // Check budget
  const budgetInfo = await checkBudget(killSwitches.DAILY_BUDGET_CENTS)
  const budgetLevel = await getBudgetAlertLevel(killSwitches.DAILY_BUDGET_CENTS)
  const budgetStatus: BudgetStatus = {
    status: budgetLevel,
    spentCents: budgetInfo.spentCents,
    limitCents: budgetInfo.limitCents,
    percentUsed: budgetInfo.percentUsed,
  }

  if (budgetLevel === 'critical') {
    alerts.push({
      severity: 'critical',
      message: `Budget at ${budgetInfo.percentUsed}% - generations may be blocked`,
      action: 'Increase DAILY_BUDGET_CENTS or wait until tomorrow',
    })
  } else if (budgetLevel === 'warning') {
    alerts.push({
      severity: 'warning',
      message: `Budget at ${budgetInfo.percentUsed}%`,
      action: 'Monitor spend closely',
    })
  }

  // Check active generations
  const activeCount = await getActiveGenerations()
  const generationStatus: GenerationStatus = {
    activeCount,
    maxConcurrent: killSwitches.MAX_CONCURRENT_GENERATIONS,
    atCapacity: activeCount >= killSwitches.MAX_CONCURRENT_GENERATIONS,
  }

  if (generationStatus.atCapacity) {
    alerts.push({
      severity: 'warning',
      message: `Generation queue at capacity (${activeCount}/${killSwitches.MAX_CONCURRENT_GENERATIONS})`,
      action: 'Increase MAX_CONCURRENT_GENERATIONS or wait for completions',
    })
  }

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  if (alerts.some(a => a.severity === 'critical')) {
    overallStatus = 'unhealthy'
  } else if (alerts.length > 0) {
    overallStatus = 'degraded'
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: {
      database: dbCheck,
      redis: redisCheck,
      killSwitches: killSwitchStatus,
      budget: isAuthorized ? budgetStatus : { status: budgetLevel, spentCents: 0, limitCents: 0, percentUsed: budgetInfo.percentUsed },
      generations: generationStatus,
    },
    alerts,
  }

  // Return appropriate status code based on health
  const statusCode = overallStatus === 'unhealthy' ? 503 : overallStatus === 'degraded' ? 200 : 200

  return {
    statusCode,
    headers,
    body: JSON.stringify(healthStatus, null, 2),
  }
}

export { handler }
