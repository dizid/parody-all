import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

// Tracks views, shares, and reactions on parody pages.
// Lightweight endpoint — no auth required for public engagement tracking.

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    const body = JSON.parse(event.body || '{}')
    const { slug, action, reaction } = body

    if (!slug || !action) {
      return { statusCode: 400, body: 'Missing slug or action' }
    }

    // Validate action type
    const validActions = ['view', 'share', 'react']
    if (!validActions.includes(action)) {
      return { statusCode: 400, body: 'Invalid action' }
    }

    if (action === 'view') {
      // Increment view count
      await sql`
        UPDATE parodies
        SET view_count = COALESCE(view_count, 0) + 1
        WHERE slug = ${slug} AND status = 'complete'
      `
    } else if (action === 'share') {
      // Increment share count
      await sql`
        UPDATE parodies
        SET share_count = COALESCE(share_count, 0) + 1
        WHERE slug = ${slug} AND status = 'complete'
      `
    } else if (action === 'react') {
      // Validate reaction type
      const validReactions = ['dead', 'fire', 'savage', 'too_real']
      if (!reaction || !validReactions.includes(reaction)) {
        return { statusCode: 400, body: 'Invalid reaction type' }
      }

      // Increment specific reaction in JSONB
      // Initialize reactions object if null, then increment the specific key
      await sql`
        UPDATE parodies
        SET reactions = jsonb_set(
          COALESCE(reactions, '{"dead":0,"fire":0,"savage":0,"too_real":0}'::jsonb),
          ${`{${reaction}}`},
          (COALESCE(
            (COALESCE(reactions, '{"dead":0,"fire":0,"savage":0,"too_real":0}'::jsonb) ->> ${reaction})::int,
            0
          ) + 1)::text::jsonb
        )
        WHERE slug = ${slug} AND status = 'complete'
      `
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  } catch (error) {
    console.error('Track engagement error:', error)
    return { statusCode: 500, body: 'Failed to track engagement' }
  }
}

export { handler }
