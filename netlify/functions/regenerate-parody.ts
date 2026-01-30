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
    const { parodyId, userId } = JSON.parse(event.body || '{}')

    if (!parodyId || !userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing parodyId or userId' }) }
    }

    // Verify user owns this parody
    const parody = (await sql`
      SELECT * FROM parodies WHERE id = ${parodyId} AND user_id = ${userId}
    `)[0]

    if (!parody) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Parody not found or not owned by you' }) }
    }

    // Check user has credits
    const profile = (await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `)[0]

    if (!profile) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Profile not found' }) }
    }

    if (profile.parodies_limit !== -1 && profile.parodies_used >= profile.parodies_limit) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'No credits remaining. Please purchase more.' }) }
    }

    // Deduct credit
    await sql`UPDATE profiles SET parodies_used = parodies_used + 1 WHERE id = ${userId}`

    // Reset parody status to analyzing
    await sql`
      UPDATE parodies
      SET status = 'analyzing', error_message = NULL
      WHERE id = ${parodyId}
    `

    // Invoke background generation
    const siteUrl = process.env.URL || 'http://localhost:8888'
    fetch(`${siteUrl}/.netlify/functions/generate-parody-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parodyId: parody.id,
        url: parody.original_url,
        tone: parody.tone || 'negative',
        theme: parody.theme || 'default',
      }),
    }).catch(err => console.error('Failed to invoke background function:', err))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, parodyId }),
    }
  } catch (error) {
    console.error('Error in regenerate-parody:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

export { handler }
