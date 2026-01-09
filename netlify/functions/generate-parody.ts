import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Anthropic from '@anthropic-ai/sdk'

// Robust JSON extraction with multiple fallback strategies
function extractJSON(text: string): object {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(text)
  } catch {}

  // Strategy 2: Extract from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim())
    } catch {}
  }

  // Strategy 3: Find JSON object boundaries
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1))
    } catch {}
  }

  throw new Error('Failed to extract valid JSON from response')
}

// Retry logic with exponential backoff
async function callClaudeWithRetry(
  anthropic: Anthropic,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  maxRetries = 3
): Promise<Anthropic.Messages.Message> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params)
    } catch (error: any) {
      lastError = error

      // Don't retry on non-retryable errors
      if (error.status === 400 || error.status === 401) {
        throw error
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
      }
    }
  }

  throw lastError
}

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
    const authHeader = event.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      }
    }

    // Parse request body
    const { url, userId } = JSON.parse(event.body || '{}')

    if (!url || !userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing url or userId' }),
      }
    }

    // Ensure user profile exists
    const existingProfile = await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `

    if (existingProfile.length === 0) {
      // Create profile for new user
      await sql`
        INSERT INTO profiles (id, tier, parodies_used, parodies_limit)
        VALUES (${userId}, 'free', 0, 1)
      `
    }

    // Check parody limits
    const profile = (await sql`
      SELECT * FROM profiles WHERE id = ${userId}
    `)[0]

    if (profile.parodies_limit !== -1 && profile.parodies_used >= profile.parodies_limit) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Parody limit reached. Please upgrade your plan.' }),
      }
    }

    // Generate slug
    const slugBase = url
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase()
      .slice(0, 30)
    const slug = `${slugBase}-${Date.now().toString(36)}`

    // Create parody record
    const parody = (await sql`
      INSERT INTO parodies (user_id, slug, original_url, status, backlink_size)
      VALUES (${userId}, ${slug}, ${url}, 'analyzing', ${profile.tier === 'free' ? 'large' : 'medium'})
      RETURNING *
    `)[0]

    // Increment parody count
    await sql`
      UPDATE profiles SET parodies_used = parodies_used + 1 WHERE id = ${userId}
    `

    // Start background generation (this runs async)
    generateParodyContent(parody.id, url).catch(console.error)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ id: parody.id, slug: parody.slug }),
    }
  } catch (error) {
    console.error('Error generating parody:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

async function generateParodyContent(parodyId: string, originalUrl: string) {
  const sql = neon(process.env.DATABASE_URL!)

  try {
    // Update status to generating
    await sql`UPDATE parodies SET status = 'generating' WHERE id = ${parodyId}`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Analyze and generate parody with retry logic
    const response = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Analyze this website URL and create a hilarious parody version: ${originalUrl}

Generate a JSON response with this structure:
{
  "site_type": "ecommerce" | "travel" | "social" | "booking" | "news" | "other",
  "parody_name": "Funny parody name for the site",
  "parody_config": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "tagline": "Hilarious tagline"
  },
  "parody_data": {
    // For ecommerce sites:
    "products": [
      {
        "id": "1",
        "name": "Absurd product name",
        "description": "Funny description",
        "price": 99.99,
        "originalPrice": 999.99,
        "image": "https://picsum.photos/seed/prod1/400/400",
        "category": "Category",
        "reviews": 42,
        "rating": 4.2,
        "deliveryTime": "Arrives in 3-5 business years",
        "badges": ["Best Seller", "Questionable Quality"],
        "topReview": "Funny review quote"
      }
      // Include 6-8 products
    ],
    "fees": [
      {
        "name": "Ridiculous fee name",
        "amount": 4.99,
        "reason": "Funny explanation"
      }
      // Include 4-6 absurd fees
    ],

    // For travel sites:
    "destinations": [
      {
        "id": "1",
        "name": "Destination name",
        "country": "Country",
        "tagline": "Sarcastic tagline",
        "description": "Funny description",
        "image": "https://picsum.photos/seed/dest1/800/600",
        "trapRating": 4,
        "badges": [{"id": "1", "name": "Tourist Trap", "icon": "🪤", "color": "red"}],
        "reasonsToAvoid": ["Funny reason 1", "Funny reason 2"],
        "averagePrice": 299
      }
      // Include 4-6 destinations
    ]
  }
}

Make it extremely funny, satirical, and absurd while still resembling the original site's style. Use witty humor and exaggerated stereotypes of the industry. Return ONLY valid JSON, no markdown.`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    // Parse the generated content with robust extraction
    const generatedData = extractJSON(content.text) as any

    // Update parody with generated content
    await sql`
      UPDATE parodies SET
        site_type = ${generatedData.site_type},
        parody_name = ${generatedData.parody_name},
        parody_config = ${JSON.stringify(generatedData.parody_config)},
        parody_data = ${JSON.stringify(generatedData.parody_data)},
        status = 'complete',
        expires_at = NOW() + INTERVAL '7 days'
      WHERE id = ${parodyId}
    `
  } catch (error: any) {
    console.error('Error in background generation:', error)

    // Determine user-friendly error message
    let errorMessage = 'An unexpected error occurred during generation.'

    if (error.status === 429) {
      errorMessage = 'Service is temporarily busy. Please try again in a few minutes.'
    } else if (error.status === 401) {
      errorMessage = 'API configuration error. Please contact support.'
    } else if (error.message?.includes('JSON')) {
      errorMessage = 'Failed to generate valid parody content. Please try again.'
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      errorMessage = 'Connection timeout. Please try again.'
    }

    await sql`
      UPDATE parodies
      SET status = 'failed', error_message = ${errorMessage}
      WHERE id = ${parodyId}
    `
  }
}

export { handler }
