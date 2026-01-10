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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { parodyId, email } = JSON.parse(event.body || '{}')

    if (!parodyId || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing parodyId or email' }),
      }
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email format' }),
      }
    }

    // Update parody with notification email
    const result = await sql`
      UPDATE parodies
      SET notification_email = ${email}
      WHERE id = ${parodyId}
      RETURNING id
    `

    if (result.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Parody not found' }),
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    }
  } catch (error: any) {
    console.error('Error saving notification email:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }
