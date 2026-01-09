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
