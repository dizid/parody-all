import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import { verifyAuth, getHeaders, unauthorizedResponse } from './lib/auth'

const handler: Handler = async (event) => {
  const headers = getHeaders(event.headers.origin)

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Verify JWT and extract userId from token
    const authResult = await verifyAuth(event.headers.authorization)
    if (!authResult.authenticated) {
      return unauthorizedResponse(headers, authResult.error)
    }
    const userId = authResult.userId

    // Get or create profile
    let profile = (await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `)[0]

    if (!profile) {
      // Create profile for new user - starts on free tier with 0 credits
      profile = (await sql`
        INSERT INTO profiles (id, tier, parodies_used, parodies_limit)
        VALUES (${userId}, 'free', 0, 0)
        RETURNING *
      `)[0]
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(profile),
    }
  } catch (error) {
    console.error('Error fetching profile:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }
