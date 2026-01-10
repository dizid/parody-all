// Kill switches for emergency load control
// Toggle these via Netlify environment variables

export interface KillSwitchConfig {
  DISABLE_NEW_GENERATIONS: boolean
  DISABLE_CLAUDE_API: boolean
  MAINTENANCE_MODE: boolean
  MAX_CONCURRENT_GENERATIONS: number
  DAILY_BUDGET_CENTS: number
}

export function getKillSwitches(): KillSwitchConfig {
  return {
    DISABLE_NEW_GENERATIONS: process.env.KILL_NEW_GENERATIONS === 'true',
    DISABLE_CLAUDE_API: process.env.KILL_CLAUDE_API === 'true',
    MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
    MAX_CONCURRENT_GENERATIONS: parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '10'),
    DAILY_BUDGET_CENTS: parseInt(process.env.DAILY_BUDGET_CENTS || '10000'), // $100 default
  }
}

export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === 'true'
}

export function isGenerationsDisabled(): boolean {
  return process.env.KILL_NEW_GENERATIONS === 'true'
}

export function isClaudeAPIDisabled(): boolean {
  return process.env.KILL_CLAUDE_API === 'true'
}

// Standard maintenance response
export function maintenanceResponse() {
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '300',
    },
    body: JSON.stringify({
      error: 'Service temporarily unavailable for maintenance',
      retryAfter: 300,
    }),
  }
}

// Capacity exceeded response
export function capacityExceededResponse() {
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    },
    body: JSON.stringify({
      error: 'Service at capacity. Please try again in a few minutes.',
      retryAfter: 60,
    }),
  }
}

// Budget exceeded response
export function budgetExceededResponse() {
  return {
    statusCode: 503,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '3600',
    },
    body: JSON.stringify({
      error: 'Daily generation limit reached. Please try again tomorrow.',
      retryAfter: 3600,
    }),
  }
}
