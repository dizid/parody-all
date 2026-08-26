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
// Includes legacy values for backward compat with existing parodies
const VALID_TONES = ['standard', 'erotic', 'dark', 'positive', 'negative', 'balanced'] as const
const VALID_THEMES = ['default', 'christmas', 'easter', 'sport', 'sensual', 'retro'] as const

// Shared secret required by generate-parody-background.ts so it can't be
// triggered directly from the public internet.
const INTERNAL_SECRET = process.env.INTERNAL_FUNCTION_SECRET

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

    // Parse request body
    const { url, tone = 'standard', theme = 'default', testKey } = JSON.parse(event.body || '{}')

    // Test mode bypass - only works with valid TEST_BYPASS_KEY env var
    const hasTestKey = !!process.env.TEST_BYPASS_KEY
    const testKeyMatches = testKey === process.env.TEST_BYPASS_KEY
    const isTestMode = testKey && hasTestKey && testKeyMatches

    console.log('Auth check:', { testKey: !!testKey, hasTestKey, testKeyMatches, isTestMode })

    let userId: string | null

    if (isTestMode) {
      // Use NULL for test mode (user_id is nullable, avoids foreign key violation)
      userId = null
      console.log('Test mode enabled, bypassing auth')
    } else {
      // Verify JWT and extract userId from token (don't trust client-provided userId)
      const authResult = await verifyAuth(event.headers.authorization)
      if (!authResult.authenticated) {
        return unauthorizedResponse(headers, authResult.error)
      }
      userId = authResult.userId
    }

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

    // Skip rate limit and credit checks in test mode
    let profile: { tier: string; parodies_limit: number; parodies_used: number; creator_url?: string | null } | null = null

    if (!isTestMode) {
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
        // Create profile for new user - starts on free tier with 2 free parody credits
        await sql`
          INSERT INTO profiles (id, tier, parodies_used, parodies_limit)
          VALUES (${userId}, 'free', 0, 2)
        `
      }

      // Check parody limits
      profile = (await sql`
        SELECT * FROM profiles WHERE id = ${userId}
      `)[0]

      if (profile.parodies_limit !== -1 && profile.parodies_used >= profile.parodies_limit) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Parody limit reached. Please upgrade your plan.' }),
        }
      }
    } else {
      // Test mode: use pro tier settings (no backlink, unlimited)
      profile = { tier: 'pro', parodies_limit: -1, parodies_used: 0, creator_url: null }
    }

    // Generate slug
    const slugBase = url
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .slice(0, 30)
    const slug = `${slugBase}-${Date.now().toString(36)}`

    // Create parody record with 'analyzing' status
    // Backlink size based on tier: creator = small, everyone else = large
    const backlinkSize = profile.tier === 'creator' ? 'small' : 'large'
    // Get creator URL from profile (only for creator tier)
    const creatorUrl = profile.tier === 'creator' ? (profile.creator_url || null) : null
    const parody = (await sql`
      INSERT INTO parodies (user_id, slug, original_url, status, backlink_size, creator_url, tone, theme)
      VALUES (${userId}, ${slug}, ${url}, 'analyzing', ${backlinkSize}, ${creatorUrl}, ${tone}, ${theme})
      RETURNING *
    `)[0]

    // Increment parody count (skip in test mode - test user has no profile)
    if (!isTestMode) {
      await sql`
        UPDATE profiles SET parodies_used = parodies_used + 1 WHERE id = ${userId}
      `
    }

    // Track active generation for capacity control
    await incrementActiveGenerations()

    // Invoke background function to do the actual generation
    // This runs asynchronously and has a 15-minute timeout
    const siteUrl = process.env.URL || 'http://localhost:8888'
    const backgroundUrl = `${siteUrl}/.netlify/functions/generate-parody-background`
    console.log(`Invoking background function at: ${backgroundUrl}`)

    if (!INTERNAL_SECRET) {
      console.error('INTERNAL_FUNCTION_SECRET not configured')
      await sql`
        UPDATE parodies
        SET status = 'failed', error_message = 'Server misconfiguration. Please try again later.'
        WHERE id = ${parody.id}
      `
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Server misconfiguration' }),
      }
    }

    // Use a timeout to ensure we don't wait forever for the background function to acknowledge
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout for initial response

    try {
      const bgResponse = await fetch(backgroundUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
        body: JSON.stringify({ parodyId: parody.id, url, tone, theme }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // Log response status for debugging
      console.log(`Background function response status: ${bgResponse.status}`)

      // If background function rejected the request, mark as failed immediately
      if (!bgResponse.ok && bgResponse.status !== 200) {
        const errorText = await bgResponse.text().catch(() => 'Unknown error')
        console.error(`Background function error: ${bgResponse.status} - ${errorText}`)

        await sql`
          UPDATE parodies
          SET status = 'failed', error_message = 'Generation service temporarily unavailable. Please try again.'
          WHERE id = ${parody.id}
        `
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      // Log but don't fail - the background function may still be processing
      // This happens when the function takes longer than 10s to respond
      if (err.name === 'AbortError') {
        console.log('Background function invocation timed out waiting for response (this is normal for long-running generations)')
      } else {
        console.error('Failed to invoke background function:', err)
        // Mark as failed if we couldn't even reach the background function
        await sql`
          UPDATE parodies
          SET status = 'failed', error_message = 'Failed to start generation. Please try again.'
          WHERE id = ${parody.id}
        `
      }
    }

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
