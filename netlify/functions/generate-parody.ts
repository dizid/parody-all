import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import {
  isMaintenanceMode,
  isGenerationsDisabled,
  maintenanceResponse,
  capacityExceededResponse,
  getKillSwitches,
} from './lib/killswitch'
import { checkUserRateLimit } from './lib/rate-limit'
import { getActiveGenerations, incrementActiveGenerations } from './lib/cache'
import { verifyAuth, getHeaders, unauthorizedResponse } from './lib/auth'

// Valid tones and themes for input validation
const VALID_TONES = ['positive', 'negative', 'balanced', 'erotic'] as const
const VALID_THEMES = ['default', 'christmas', 'easter', 'sport', 'sensual', 'retro'] as const

const handler: Handler = async (event) => {
  const headers = getHeaders(event.headers.origin)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Kill switch checks
  if (isMaintenanceMode()) {
    return maintenanceResponse()
  }

  if (isGenerationsDisabled()) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'New parody generation is temporarily paused. Please try again later.' }),
    }
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Verify JWT and extract userId from token (don't trust client-provided userId)
    const authResult = await verifyAuth(event.headers.authorization)
    if (!authResult.authenticated) {
      return unauthorizedResponse(headers, authResult.error)
    }
    const userId = authResult.userId

    // Parse request body
    const { url, tone = 'negative', theme = 'default' } = JSON.parse(event.body || '{}')

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing url' }),
      }
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid URL format' }),
      }
    }

    // Validate tone and theme
    if (!VALID_TONES.includes(tone)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid tone. Must be one of: ${VALID_TONES.join(', ')}` }),
      }
    }
    if (!VALID_THEMES.includes(theme)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid theme. Must be one of: ${VALID_THEMES.join(', ')}` }),
      }
    }

    // Check rate limit (5 generations per hour per user)
    const rateLimit = await checkUserRateLimit(userId, 'generate')
    if (!rateLimit.allowed) {
      return {
        statusCode: 429,
        headers: { ...headers, 'Retry-After': String(rateLimit.resetInSeconds) },
        body: JSON.stringify({
          error: 'Rate limit exceeded. Please wait before generating more parodies.',
          retryAfter: rateLimit.resetInSeconds,
        }),
      }
    }

    // Check concurrent generation capacity
    const killSwitches = getKillSwitches()
    const activeGens = await getActiveGenerations()
    if (activeGens >= killSwitches.MAX_CONCURRENT_GENERATIONS) {
      return capacityExceededResponse()
    }

    // Ensure user profile exists
    const existingProfile = await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `

    if (existingProfile.length === 0) {
      // Create profile for new user - starts on free tier with 0 credits
      await sql`
        INSERT INTO profiles (id, tier, parodies_used, parodies_limit)
        VALUES (${userId}, 'free', 0, 0)
      `
    }

    // Check parody limits
    const profile = (await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `)[0]

    if (profile.parodies_limit !== -1 && profile.parodies_used >= profile.parodies_limit) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Parody limit reached. Please upgrade your plan.' }),
      }
    }

    // Generate slug
    const slugBase = url
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .slice(0, 30)
    const slug = `${slugBase}-${Date.now().toString(36)}`

    // Create parody record with 'analyzing' status
    // Backlink size based on tier: pro = none, creator = small, free/single = large
    const backlinkSize = profile.tier === 'pro' ? 'none' : profile.tier === 'creator' ? 'small' : 'large'
    // Get creator URL from profile (only for paid users)
    const creatorUrl = ['creator', 'pro'].includes(profile.tier) ? (profile.creator_url || null) : null
    const parody = (await sql`
      INSERT INTO parodies (user_id, slug, original_url, status, backlink_size, creator_url, tone, theme)
      VALUES (${userId}, ${slug}, ${url}, 'analyzing', ${backlinkSize}, ${creatorUrl}, ${tone}, ${theme})
      RETURNING *
    `)[0]

    // Increment parody count
    await sql`
      UPDATE profiles SET parodies_used = parodies_used + 1 WHERE id = ${userId}
    `

    // Track active generation for capacity control
    await incrementActiveGenerations()

    // Invoke background function to do the actual generation
    // This runs asynchronously and has a 15-minute timeout
    const siteUrl = process.env.URL || 'http://localhost:8888'
    fetch(`${siteUrl}/.netlify/functions/generate-parody-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parodyId: parody.id, url, tone, theme }),
    }).catch(err => {
      console.error('Failed to invoke background function:', err)
    })

    // Return immediately with parody ID (frontend needs this to poll for status)
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: parody.id, slug: parody.slug }),
    }
  } catch (error) {
    console.error('Error in generate-parody:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }
