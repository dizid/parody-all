import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import { isMaintenanceMode, maintenanceResponse } from './lib/killswitch'
import { getCachedParody, cacheParody } from './lib/cache'

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  // Allow health checks even in maintenance mode, but block regular requests
  if (isMaintenanceMode()) {
    return maintenanceResponse()
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const { id, slug } = event.queryStringParameters || {}

    if (!id && !slug) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing id or slug parameter' }),
      }
    }

    let parody
    if (slug) {
      // Try cache first for slug-based lookups (completed parodies)
      const cached = await getCachedParody(slug)
      if (cached) {
        return {
          statusCode: 200,
          headers: { ...headers, 'X-Cache': 'HIT' },
          body: JSON.stringify(cached),
        }
      }

      const result = await sql`
        SELECT * FROM parodies WHERE slug = ${slug} LIMIT 1
      `
      parody = result[0]
    } else {
      // ID-based lookups are for polling during generation - don't cache
      const result = await sql`
        SELECT * FROM parodies WHERE id = ${id} LIMIT 1
      `
      parody = result[0]
    }

    if (!parody) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Parody not found' }),
      }
    }

    // Check expiration (only for completed parodies accessed by slug)
    if (slug && parody.expires_at && new Date(parody.expires_at) < new Date()) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({
          error: 'This parody has expired',
          expired: true,
        }),
      }
    }

    // Cache completed parodies accessed by slug
    if (slug && parody.status === 'complete') {
      await cacheParody(slug, parody)
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'X-Cache': 'MISS' },
      body: JSON.stringify(parody),
    }
  } catch (error) {
    console.error('Error fetching parody:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }
