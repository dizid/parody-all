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

// Background function - does the actual Claude API work
// Called by generate-parody.ts, has 15-minute timeout
const handler: Handler = async (event) => {
  console.log('Background function started')

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    const { parodyId, url } = JSON.parse(event.body || '{}')

    if (!parodyId || !url) {
      console.error('Missing parodyId or url')
      return { statusCode: 400, body: 'Missing parodyId or url' }
    }

    console.log(`Generating parody for ${url} (ID: ${parodyId})`)

    // Update status to generating
    await sql`UPDATE parodies SET status = 'generating' WHERE id = ${parodyId}`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Call Claude API with retry logic
    const response = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `You are a master satirist creating a parody of: ${url}

## STEP 1: ANALYZE THE TARGET
First, think about this site/company:
- What is their core business model?
- What are 3-5 REAL frustrations users have with this type of service? (e.g., hidden fees, slow shipping, fake reviews, dark patterns)
- What industry tropes and corporate-speak do they use?
- What would make someone who uses this site laugh because it's SO TRUE?

## STEP 2: CREATE INTELLIGENT SATIRE
Now create a parody that uses IRONIC TRUTHFULNESS - the humor comes from exaggerating real problems, not random absurdity.

HUMOR RULES:
1. The parody name should hint at the main joke (Amazon → "Scamazon", Uber → "Goober", Airbnb → "Scarebnb")
2. Products/services ARE the user's complaints reframed as "features"
3. Fees mock real pricing psychology taken to logical extremes
4. Reviews mix obviously fake 5-stars with painfully relatable 1-star complaints
5. Everything should feel like "this is too real" not "this is random"
6. Include internal references - products that mention other products, fees that reference the reviews, etc.
7. Be CLEVER and WITTY, not just silly

## REQUIRED JSON STRUCTURE:
{
  "site_type": "ecommerce" | "travel" | "social" | "booking" | "news" | "other",
  "parody_name": "Clever punny name that hints at the joke",
  "parody_config": {
    "primaryColor": "#hex (similar to but slightly off from original)",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "tagline": "Ironic tagline that sounds like real marketing but reveals the truth"
  },
  "parody_data": {
    "heroTagline": "Main headline that sounds corporate but is devastating (e.g., 'Your wallet's worst nightmare, delivered in 3-5 business days')",
    "heroSubtitle": "Subheadline continuing the joke",

    "announcements": [
      {"id": "1", "type": "warning", "text": "Funny urgent banner", "icon": "⚠️"},
      {"id": "2", "type": "sale", "text": "Fake sale announcement with absurd discount math", "icon": "🎉"}
    ],

    "products": [
      {
        "id": "1",
        "name": "Product name that IS a user complaint (e.g., 'Definitely Not A Knockoff Premium Headphones')",
        "description": "Description that sounds like marketing but admits the problem",
        "price": 29.99,
        "originalPrice": 299.99,
        "image": "https://picsum.photos/seed/prod1/400/400",
        "category": "Category",
        "reviews": 47293,
        "rating": 4.8,
        "deliveryTime": "Arrives sometime between tomorrow and the heat death of the universe",
        "badges": ["Verified Real™", "Probably Works"],
        "topReview": "Quote from a clearly fake review OR painfully honest one"
      }
    ],

    "fees": [
      {
        "name": "Clever fee name mocking real hidden fees",
        "amount": 2.99,
        "reason": "Hilariously honest explanation that companies would never say"
      }
    ],

    "reviews": [
      {
        "id": "1",
        "author": "Username that tells a story (e.g., 'StillWaiting2019', 'TotallyRealPerson')",
        "rating": 5,
        "text": "Obviously fake glowing review OR devastatingly honest complaint",
        "date": "2024-01-15",
        "verified": true,
        "helpful": 2847,
        "notHelpful": 3
      }
    ],

    "popups": [
      {"id": "1", "trigger": "add_to_cart", "title": "Wait!", "message": "Popup message mocking real dark patterns", "buttons": ["Guilt-trip option", "Manipulative 'no' option"], "icon": "🛒"},
      {"id": "2", "trigger": "exit_intent", "title": "WAIT DON'T GO!", "message": "Desperate retention popup parody", "buttons": ["Fine, take my money", "I'd rather not"], "icon": "😢"},
      {"id": "3", "trigger": "newsletter", "title": "Join Our Newsletter!", "message": "Subscribe and get 0.5% off your next regret!", "buttons": ["Yes, spam me forever", "No, I hate savings"], "icon": "📧"}
    ],

    "easterEggs": [
      {"id": "1", "trigger": "logo_click_5x", "action": "show_message", "message": "Secret message rewarding curiosity with nothing"},
      {"id": "2", "trigger": "scroll_bottom", "action": "add_fee", "fee": {"name": "Scroll Tax", "amount": 1.99}}
    ],

    "trustBadges": [
      {"id": "1", "name": "Definitely Secure", "icon": "🔒", "tooltip": "We pinky promise"},
      {"id": "2", "name": "Verified Real™", "icon": "✓", "tooltip": "By our own standards"},
      {"id": "3", "name": "Award Winning", "icon": "🏆", "tooltip": "We gave ourselves this award"}
    ],

    "faqs": [
      {"id": "1", "question": "Real FAQ question customers ask", "answer": "Hilariously honest answer companies would never give"},
      {"id": "2", "question": "Another common complaint phrased as question", "answer": "Answer that accidentally reveals the truth"}
    ],

    "destinations": [
      {
        "id": "1",
        "name": "Destination name",
        "country": "Country",
        "tagline": "Sarcastic tagline about tourist traps",
        "description": "Description mocking travel industry",
        "image": "https://picsum.photos/seed/dest1/800/600",
        "trapRating": 4,
        "badges": [{"id": "1", "name": "Tourist Trap", "icon": "🪤", "color": "red"}],
        "reasonsToAvoid": ["Painfully accurate reason 1", "Reason 2"],
        "averagePrice": 299
      }
    ],

    "hasProducts": true,
    "hasDestinations": false,
    "hasCart": true,
    "hasFees": true,
    "hasReviews": true
  }
}

IMPORTANT:
- Include 6-8 products for ecommerce OR 4-6 destinations for travel
- Include 5-8 absurd but realistic-sounding fees
- Include 6-8 reviews mixing fake positives and real-sounding complaints
- Include 3-4 popups with different triggers
- Include 2-3 easter eggs
- Include 4-6 trust badges
- Include 4-6 FAQs
- All humor should feel like "OMG this is so true" not "this is random nonsense"

Return ONLY valid JSON, no markdown code blocks or explanations.`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    console.log('Claude response received, parsing JSON...')

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

    console.log(`Parody ${parodyId} completed successfully`)

    return { statusCode: 200, body: 'OK' }
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

    // Try to get parodyId from body to update status
    try {
      const { parodyId } = JSON.parse(event.body || '{}')
      if (parodyId) {
        await sql`
          UPDATE parodies
          SET status = 'failed', error_message = ${errorMessage}
          WHERE id = ${parodyId}
        `
      }
    } catch (e) {
      console.error('Failed to update parody status:', e)
    }

    return { statusCode: 500, body: errorMessage }
  }
}

export { handler }
