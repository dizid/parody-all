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

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { userId } = event.queryStringParameters || {}

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId parameter' }),
      }
    }

    // Get or create profile
    let profile = (await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `)[0]

    if (!profile) {
      // Create profile for new user - no free credits, must pay
      profile = (await sql`
        INSERT INTO profiles (id, tier, parodies_used, parodies_limit)
        VALUES (${userId}, 'none', 0, 0)
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
