import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'

// Minimum required content per site type
const REQUIRED_CONTENT = {
  ecommerce: { products: 4, fees: 3 },
  news: { articles: 4 },
  travel: { destinations: 3 },
  social: { posts: 4, trending: 3 },
  corporate: { features: 3, pricingTiers: 2 },
  food: { menuItems: 4, deliveryFees: 3 },
} as const

// Validate generated content meets minimum requirements
function validateContent(data: any): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  if (!data.site_type || !data.parody_name || !data.parody_config || !data.parody_data) {
    issues.push('Missing required top-level fields (site_type, parody_name, parody_config, parody_data)')
    return { valid: false, issues }
  }

  const pd = data.parody_data
  const siteType = data.site_type as keyof typeof REQUIRED_CONTENT
  const requirements = REQUIRED_CONTENT[siteType]

  if (!requirements) {
    issues.push(`Unknown site_type: ${siteType}`)
    return { valid: false, issues }
  }

  // Check site-specific requirements
  for (const [field, minCount] of Object.entries(requirements)) {
    const arr = pd[field]
    if (!Array.isArray(arr) || arr.length < minCount) {
      issues.push(`${field} needs at least ${minCount} items, got ${arr?.length || 0}`)
    }
  }

  // Check shared content
  if (!pd.heroTagline) issues.push('Missing heroTagline')
  if (!pd.heroSubtitle) issues.push('Missing heroSubtitle')
  if (!Array.isArray(pd.reviews) || pd.reviews.length < 3) {
    issues.push('reviews needs at least 3 items')
  }

  return { valid: issues.length === 0, issues }
}

// Fill in missing optional content with defaults
function fillDefaults(data: any): any {
  const pd = data.parody_data

  // Default trust badges
  if (!pd.trustBadges || pd.trustBadges.length === 0) {
    pd.trustBadges = [
      { id: '1', name: 'Probably Safe', icon: '🛡️', tooltip: 'We think so anyway' },
      { id: '2', name: 'Money Back*', icon: '💰', tooltip: '*Terms and 47 conditions apply' },
      { id: '3', name: 'Fast-ish Shipping', icon: '📦', tooltip: 'Eventually' },
    ]
  }

  // Default FAQs
  if (!pd.faqs || pd.faqs.length === 0) {
    pd.faqs = [
      { id: '1', question: 'Is this real?', answer: 'As real as our commitment to your satisfaction (interpret that as you will).' },
      { id: '2', question: 'Can I get a refund?', answer: 'You can certainly try! Our refund department is located in an undisclosed bunker.' },
      { id: '3', question: 'Why are there so many fees?', answer: 'Because we can. Also, shareholders.' },
    ]
  }

  // Default announcements
  if (!pd.announcements || pd.announcements.length === 0) {
    pd.announcements = [
      { id: '1', type: 'warning', text: 'This is a parody site. Please laugh responsibly.', icon: '🎭' },
    ]
  }

  // Default popups
  if (!pd.popups || pd.popups.length === 0) {
    pd.popups = [
      {
        id: '1',
        trigger: 'timer_10s',
        title: 'Wait!',
        message: 'Before you go... actually, we have nothing to say. Carry on.',
        buttons: ['OK, weird'],
        icon: '👋'
      },
    ]
  }

  return data
}

// Send email notification
async function sendNotificationEmail(
  email: string,
  parodyName: string,
  parodyUrl: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log('RESEND_API_KEY not configured, skipping email notification')
    return
  }

  const resend = new Resend(resendKey)

  try {
    if (success) {
      await resend.emails.send({
        from: 'Parody Everything <noreply@parody.email>',
        to: email,
        subject: `🎭 Your parody "${parodyName}" is ready!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">Your parody is ready! 🎉</h1>
            <p>Great news! We've finished generating your parody of <strong>${parodyName}</strong>.</p>
            <p style="margin: 24px 0;">
              <a href="${parodyUrl}" style="background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                View Your Parody →
              </a>
            </p>
            <p style="color: #666; font-size: 14px;">This parody will be available for 7 days.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Parody Everything - AI-powered satire</p>
          </div>
        `,
      })
    } else {
      await resend.emails.send({
        from: 'Parody Everything <noreply@parody.email>',
        to: email,
        subject: '🎭 Update on your parody request',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">We hit a snag 😅</h1>
            <p>Unfortunately, we encountered technical difficulties while generating your parody.</p>
            <p><strong>What happened:</strong> ${errorMessage || 'Our AI got stage fright.'}</p>
            <p><strong>What to do:</strong> Please try again tomorrow - these issues are usually temporary.</p>
            <p>We're sorry for the inconvenience. The first parody is still free, so you won't lose your credit.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">Parody Everything - AI-powered satire</p>
          </div>
        `,
      })
    }
    console.log(`Notification email sent to ${email}`)
  } catch (error) {
    console.error('Failed to send notification email:', error)
  }
}

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

// Build the main prompt for Claude
function buildPrompt(url: string): string {
  return `You are a master satirist creating a parody of: ${url}

## STEP 1: CATEGORIZE THE SITE (CRITICAL - DO THIS FIRST)
Identify what type of site this is:
- "ecommerce" → Online stores (Amazon, eBay, Etsy, Shopify stores)
- "news" → News/media/blogs (CNN, NYT, BuzzFeed, TechCrunch)
- "travel" → Booking/travel sites (Airbnb, Booking.com, Expedia)
- "social" → Social networks (Twitter/X, Facebook, LinkedIn, Instagram)
- "corporate" → Company/SaaS sites (Stripe, Salesforce, startup landing pages)
- "food" → Restaurant/delivery apps (DoorDash, UberEats, Grubhub)

## STEP 2: ANALYZE THE ORIGINAL DESIGN
Mirror the original site's aesthetic in your parody:
- If original is DARK theme → use dark colors (primaryColor should be dark)
- If original is LIGHT/bright → use light colors
- Match the VIBE: serious (news), playful (social), corporate (SaaS), urgent (food delivery)
- The parody should FEEL like the original site, just with satirical content

## STEP 3: GENERATE CATEGORY-SPECIFIC CONTENT
Based on site_type, generate ONLY the relevant content:

### FOR "ecommerce":
- Generate "products" array (6-8 items) - fake products that ARE user complaints
- Generate "fees" array (5-8 fees) - hidden fees mocking real pricing
- Focus on: dark patterns, fake discounts, impossible delivery promises

### FOR "news":
- Generate "articles" array (6-8 items) - clickbait headlines, sensationalism
- Generate "breakingNews" string - scrolling ticker of absurd "breaking" news
- Focus on: paywalls, ads everywhere, outrage bait, "BREAKING" overuse

### FOR "travel":
- Generate "destinations" array (4-6 items) - tourist traps
- Generate "urgencyMessages" array (3-4) - "Only 1 left!" lies
- Focus on: hidden fees at checkout, misleading photos, fake urgency

### FOR "social":
- Generate "posts" array (6-8 items) - engagement bait, promoted content
- Generate "suggestedProfiles" array (4-6) - "people you may know"
- Generate "trending" array (5-8 hashtags) - absurd trending topics
- Focus on: algorithm manipulation, verification jokes, ads disguised as content

### FOR "corporate":
- Generate "features" array (4-6 items) - buzzword-laden feature descriptions
- Generate "pricingTiers" array (3-4 tiers) - absurd enterprise pricing
- Generate "testimonials" array (3-4) - obviously fake customer quotes
- Focus on: vague promises, "Contact Sales" = $50k, jargon overload

### FOR "food":
- Generate "menuItems" array (6-8 items) - menu items with suspicious descriptions
- Generate "deliveryFees" array (6-8 fees) - fee stacking parody
- Focus on: tiny portions, surge pricing, misleading prep times

## SHARED CONTENT (generate for ALL site types):
- "heroTagline" and "heroSubtitle" - main headlines
- "announcements" (2-3) - banner notifications
- "popups" (3-4) - dark pattern popups
- "easterEggs" (2-3) - hidden surprises
- "trustBadges" (4-6) - fake trust indicators
- "faqs" (4-6) - hilariously honest FAQ
- "reviews" (6-8) - mix of fake 5-stars and real complaints
- "fees" (5-8) - applicable to most site types

## JSON STRUCTURE:
{
  "site_type": "ecommerce" | "news" | "travel" | "social" | "corporate" | "food",
  "parody_name": "Clever punny name (Amazon→Scamazon, CNN→Clickbait News Network, DoorDash→FloorCrash)",
  "parody_config": {
    "primaryColor": "#hex (MATCH original site's color scheme)",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "tagline": "Ironic tagline mocking their real slogan"
  },
  "parody_data": {
    "heroTagline": "Devastating headline in their voice",
    "heroSubtitle": "Subheadline continuing the satire",
    "breakingNews": "For news: scrolling ticker text | null for others",
    "announcements": [{"id": "1", "type": "warning|sale|info|urgent", "text": "...", "icon": "emoji"}],

    "products": [/* FOR ECOMMERCE: {id, name, description, price, originalPrice, image: "https://picsum.photos/seed/prodX/400/400", category, reviews, rating, deliveryTime, badges[], topReview} */],

    "articles": [/* FOR NEWS: {id, headline, category: "POLITICS|TECH|OPINION|BREAKING", summary, author, authorTitle, image: "https://picsum.photos/seed/newsX/800/400", readTime, commentCount, isBreaking, isSponsored} */],

    "destinations": [/* FOR TRAVEL: {id, name, country, tagline, description, image: "https://picsum.photos/seed/destX/800/600", trapRating: 1-5, badges: [{id, name, icon, color}], reasonsToAvoid[], averagePrice} */],

    "posts": [/* FOR SOCIAL: {id, author, handle, avatar: "https://i.pravatar.cc/150?u=X", content, likes, reposts, comments, timestamp, isVerified, isPromoted} */],
    "suggestedProfiles": [/* FOR SOCIAL: {id, name, handle, avatar, bio, isVerified} */],
    "trending": [/* FOR SOCIAL: "#HashtagJokes" */],

    "features": [/* FOR CORPORATE: {id, icon: "emoji", title, description} */],
    "pricingTiers": [/* FOR CORPORATE: {id, name, price: "$X/mo" or "Contact Sales", features[], isPopular, ctaText} */],
    "testimonials": [/* FOR CORPORATE: {id, quote, author, title, company, avatar} */],

    "menuItems": [/* FOR FOOD: {id, name, description, price, image: "https://picsum.photos/seed/foodX/400/400", prepTime, calories, badges[]} */],
    "deliveryFees": [/* FOR FOOD: {name, amount, reason} - stack many absurd fees */],

    "fees": [{name, amount, reason}],
    "reviews": [{id, author, rating, text, date, verified, helpful, notHelpful}],
    "popups": [{id, trigger: "add_to_cart|exit_intent|newsletter|scroll_50|timer_10s", title, message, buttons[], icon}],
    "easterEggs": [{id, trigger: "logo_click_5x|scroll_bottom", action: "show_message|add_fee", message?, fee?: {name, amount}}],
    "trustBadges": [{id, name, icon, tooltip}],
    "faqs": [{id, question, answer}],
    "urgencyMessages": [/* FOR TRAVEL: "Only 2 rooms left!" type messages */]
  }
}

## HUMOR PRINCIPLES:
1. IRONIC TRUTHFULNESS - exaggerate real problems, not random absurdity
2. "This is too real" > "This is random"
3. The parody name hints at the main joke
4. Internal references - content that references other content
5. Mix obviously fake positives with painfully honest complaints
6. Match the original site's tone while subverting it

Return ONLY valid JSON, no markdown code blocks or explanations.`
}

// Build retry prompt with validation feedback
function buildRetryPrompt(url: string, issues: string[]): string {
  return `You are a master satirist creating a parody of: ${url}

IMPORTANT: Your previous attempt was missing required content. Please fix these issues:
${issues.map(i => `- ${i}`).join('\n')}

Generate a COMPLETE parody with ALL required fields. Make sure to include enough items in each array.

${buildPrompt(url).split('\n').slice(1).join('\n')}`
}

// Background function - does the actual Claude API work
// Called by generate-parody.ts, has 15-minute timeout
const handler: Handler = async (event) => {
  console.log('Background function started')

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const sql = neon(process.env.DATABASE_URL!)
  let parodyId: string | undefined
  let notificationEmail: string | undefined
  let parodySlug: string | undefined

  try {
    const body = JSON.parse(event.body || '{}')
    parodyId = body.parodyId
    const url = body.url

    if (!parodyId || !url) {
      console.error('Missing parodyId or url')
      return { statusCode: 400, body: 'Missing parodyId or url' }
    }

    console.log(`Generating parody for ${url} (ID: ${parodyId})`)

    // Get parody record for notification email and slug
    const parodyRecord = await sql`SELECT notification_email, slug FROM parodies WHERE id = ${parodyId}`
    if (parodyRecord.length > 0) {
      notificationEmail = parodyRecord[0].notification_email
      parodySlug = parodyRecord[0].slug
    }

    // Update status to generating
    await sql`UPDATE parodies SET status = 'generating' WHERE id = ${parodyId}`

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // First attempt
    console.log('Calling Claude API (attempt 1)...')
    let response = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: buildPrompt(url) }],
    })

    let content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    console.log('Claude response received, parsing JSON...')
    let generatedData = extractJSON(content.text) as any

    // Validate content
    let validation = validateContent(generatedData)

    // Auto-retry once if validation fails
    if (!validation.valid) {
      console.log(`Validation failed: ${validation.issues.join(', ')}`)
      console.log('Retrying with feedback...')

      response = await callClaudeWithRetry(anthropic, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: buildRetryPrompt(url, validation.issues) }],
      })

      content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type on retry')
      }

      generatedData = extractJSON(content.text) as any
      validation = validateContent(generatedData)

      if (!validation.valid) {
        console.log(`Validation still failed after retry: ${validation.issues.join(', ')}`)
        // Continue anyway - fill defaults for missing optional content
      }
    }

    // Fill in any missing optional content with defaults
    generatedData = fillDefaults(generatedData)

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

    // Send success notification email if user provided one
    if (notificationEmail && parodySlug) {
      const siteUrl = process.env.URL || 'https://parodyeverything.com'
      const parodyUrl = `${siteUrl}/p/${parodySlug}`
      await sendNotificationEmail(notificationEmail, generatedData.parody_name, parodyUrl, true)
    }

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

    // Update parody status to failed
    if (parodyId) {
      try {
        await sql`
          UPDATE parodies
          SET status = 'failed', error_message = ${errorMessage}
          WHERE id = ${parodyId}
        `
      } catch (e) {
        console.error('Failed to update parody status:', e)
      }
    }

    // Send failure notification email if user provided one
    if (notificationEmail) {
      await sendNotificationEmail(notificationEmail, 'your parody', '', false, errorMessage)
    }

    return { statusCode: 500, body: errorMessage }
  }
}

export { handler }
