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

    const parodies = await sql`
      SELECT * FROM parodies
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parodies),
    }
  } catch (error) {
    console.error('Error listing parodies:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }
