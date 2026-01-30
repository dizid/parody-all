import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId, creatorUrl } = JSON.parse(event.body || '{}')

    if (!userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing userId' }) }
    }

    // Validate URL format if provided
    if (creatorUrl) {
      try {
        new URL(creatorUrl)
      } catch {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL format' }) }
      }
    }

    // Check user exists and has permission (creator or pro tier)
    const profile = (await sql`SELECT tier FROM profiles WHERE id = ${userId}`)[0]

    if (!profile) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) }
    }

    if (!['creator', 'pro'].includes(profile.tier)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Upgrade to Creator or Pro to set custom URLs' }) }
    }

    // Update profile
    const updated = (await sql`
      UPDATE profiles
      SET creator_url = ${creatorUrl || null}
      WHERE id = ${userId}
      RETURNING *
    `)[0]

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(updated),
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

export { handler }
