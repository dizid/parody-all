import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Anthropic from '@anthropic-ai/sdk'
import { Resend } from 'resend'
import FirecrawlApp from '@mendable/firecrawl-js'
import { isClaudeAPIDisabled, getKillSwitches, budgetExceededResponse } from './lib/killswitch'
import { checkBudget, recordUsage } from './lib/budget'
import { decrementActiveGenerations } from './lib/cache'

// Auth: shared secret so this endpoint can't be hit directly from the public
// internet to trigger free Claude calls — it must only be invoked by
// generate-parody.ts / regenerate-parody.ts, which have already run the real
// Clerk auth + rate-limit + tier-limit checks. Same pattern as clientpilot's
// generate-background.mts.
const INTERNAL_SECRET = process.env.INTERNAL_FUNCTION_SECRET

// Minimum required content per site type
const REQUIRED_CONTENT = {
  ecommerce: { products: 4, fees: 3 },
  news: { articles: 4 },
  travel: { destinations: 3 },
  social: { posts: 4, trending: 3 },
  corporate: { features: 3, pricingTiers: 2 },
  food: { menuItems: 4, deliveryFees: 3 },
} as const

// ============================================================================
// TONE & THEME PROMPT ENGINEERING
// Layered Identity Architecture:
// Layer 1: Site Type + Original Design (30%) - Layout, base colors, visual patterns
// Layer 2: Brand Identity from Analysis (25%) - Pain points, signature elements
// Layer 3: Tone (30%) - HOW we mock (positive/negative/balanced/erotic) - STRONG IMPACT
// Layer 4: Theme (15%) - Seasonal overlay, accent colors, themed content
// ============================================================================

const IDENTITY_RULE = `
## CRITICAL RULE: PRESERVE ORIGINAL SITE IDENTITY

Your parody must be INSTANTLY RECOGNIZABLE as the original site.
Tone and Theme are OVERLAYS, not replacements!

1. **COLORS**: Start with the original site's color scheme
   - Amazon → Orange/Black base
   - LinkedIn → Blue base
   - Uber → Black/White base
   - Airbnb → Coral/Pink base
   Theme colors are ACCENTS only (15-20% of palette), not replacements.

2. **STRUCTURE**: Match the original site's layout patterns
   - If it's Amazon, use their product grid style
   - If it's LinkedIn, use their feed/card style
   - If it's Uber, use their ride-booking style
   The parody should FEEL like using the real site.

3. **BRAND ELEMENTS**: Mock their SPECIFIC features
   - Amazon's "Buy Box", Prime badges, "Frequently bought together"
   - LinkedIn's "Who viewed your profile", connection requests
   - Uber's surge pricing multiplier, driver ratings
   Generic jokes = bad. Site-specific jokes = good.

4. **VOICE**: Parody their actual marketing tone
   - If they're corporate → mock corporate jargon
   - If they're casual → mock fake friendliness
   - If they're urgent → mock artificial scarcity
`

const HUMOR_EXCELLENCE_RULES = `
## COMEDY EXCELLENCE RULES (NON-NEGOTIABLE)

### 1. THE "TOO REAL" PRINCIPLE
Every joke should make users think "Holy shit, this is literally what they do"
- BAD: "We charge extra fees" (generic, boring)
- GOOD: "Convenience Fee for Using Our Website Instead of Walking to Store: $4.99"

### 2. IRONIC HONESTY
Say the quiet part out loud. What companies think but never say:
- BAD: "Fast shipping" (corporate speak)
- GOOD: "Ships in 2-3 business days* (*Business days don't include Mon, Tue, Wed, Thu, or Fri)"

### 3. SPECIFICITY = COMEDY
Generic = forgettable. Specific = hilarious.
- BAD: "Hidden fees included"
- GOOD: "Fee for Itemizing Your Fees: $0.99 | Meta-Fee Processing Fee: $0.25"

### 4. THE ESCALATION LADDER
Start reasonable, escalate to absurd:
- Level 1: "Service fee: $2.99" (believable)
- Level 2: "Convenience fee: $3.99" (annoying but real)
- Level 3: "Fee for not having Pro membership: $4.99" (hmm)
- Level 4: "Oxygen Usage Fee (in warehouse): $0.47" (absurd but formatted seriously)

### 5. CORPORATE VOICE, UNHINGED CONTENT
Keep the professional tone while saying insane things:
- "We value your privacy, which is why we've sold it to 47 partners"
- "Your call is important to us. You are caller #847. Estimated wait: 3 days."
- "Subscribe to Premium to remove this message asking you to subscribe"

### 6. THE CONTRAST TECHNIQUE
Juxtapose opposites for comedy:
- Review title: "⭐⭐⭐⭐⭐ LIFE CHANGING!"
- Review text: "It arrived broken but the box was nice. Would buy again."

### 7. BREAKING THE FOURTH WALL
Acknowledge the absurdity within the parody:
- "47 people are viewing this! (We added fake viewer counts in Q3)"
- "Verified Purchase* (*Verification status is not verified)"

### 8. RULE OF THREE... THEN FOUR
List 3 normal things, then add a 4th absurd one:
- Free shipping | Easy returns | 24/7 support | Mandatory blood sacrifice

### 9. DATED SPECIFICS
Add fake but realistic timestamps/numbers:
- "Last updated: 47 minutes ago (we update every 47 minutes to seem active)"
- "4,892 reviews (4,891 from sellers)"

### 10. THE PARENTHETICAL REVEAL
Professional statement (devastating truth in parentheses):
- "Carbon neutral shipping (we planted one tree in 2019)"
- "Award-winning customer service (the award was internal)"

### 11. RUNNING GAG (REQUIRED)
Pick ONE absurd internal fact and reference it at least 3 times across DIFFERENT sections.
Each reference escalates. This creates the feeling the site is slowly confessing.
- Hero: "We've never lost a package (we've lost 47 million packages)"
- Trust badge tooltip: "Improved since the 47 million incident"
- FAQ: "Q: Where is my package? A: Statistically, with the other 47 million"
- Review: "Mine arrived! I feel special. — 1 of 47,000,001"

### 12. FINE PRINT (minimum 4 instances)
Every asterisk (*), dagger (†), or trademark (™) is a comedy slot.
The main text is professional. The fine print reveals the devastating truth.
- "Free 2-Day Delivery†" → "†2 days measured in business fortnights"
- "Verified Purchase*" → "*verification is aesthetic, not functional"
- "Carbon Neutral™" → "™we planted one tree in 2019 and never stopped bragging"
- "Satisfaction Guaranteed*" → "*guarantee applies to our satisfaction, not yours"

### 13. LEAKED INTERNAL VOICE
Occasionally break the corporate facade with "accidental" internal notes:
- FAQ answer that trails off: "Our refund policy is simple and— [LEGAL HAS ENTERED THE CHAT] —unfortunately we cannot process refunds at this time."
- Trust badge tooltip: "[INTERNAL: Dave says we can't call this 'secure' anymore — Legal]"
- Fee reason: "(margin recovery initiative Q3 — do not show to customers) ...oops"

---

## GOLD STANDARD EXAMPLES (study these — THIS is the quality bar)

### EXCELLENT review block:
★★★★★ "CHANGED MY LIFE!!!" [Posted 0.004 seconds after delivery]
[Verified Purchase*] (*verification is aesthetic, not functional)
847 people found this helpful | 0 people found this suspicious

★☆☆☆☆ "I've been a Prime member for 11 years. They've gotten worse every single year. I renewed this morning. I need help." — Gerald, 54, Ohio
[4,891 people found this uncomfortably relatable]

### EXCELLENT fee stack:
- Convenience Fee: $4.99 (for using our website instead of telepathy)
- Fee Itemization Fee: $0.99 (for the privilege of seeing these fees listed)
- Apology for the Fees Fee: $1.49 (we're sorry, and that costs extra)
- Environmental Guilt Offset: $2.49 (we planted a tree. In Minecraft.)
- Rounding Up Fee: $0.08 (we round up. Always up. Never down.)
- Fee for Not Having Premium: $3.99 (this fee goes away if you pay us more)

### EXCELLENT FAQ:
Q: "Can I speak to a human?"
A: "All our support agents are humans! They simply operate within a system designed to prevent them from helping you. Think of it as a human-powered maze."

### EXCELLENT popup:
Title: "WAIT! Before you leave..."
Message: "We noticed you're about to close this tab. That's fine. We already have your data. But wouldn't you like to also give us your email? For... reasons?"
Buttons: ["Yes, take my data" (primary), "No, but I know you'll ask again in 30 seconds"]

---

## BANNED CONTENT (never generate these — they are lazy and generic)
- Any fee under $1.99 (should feel REAL and infuriating)
- "We put customers first" without an ironic qualifier
- Generic "hidden fees included" — be SPECIFIC about each fee
- Trust badges without devastating tooltips (every badge needs a tooltip that undermines it)
- Urgency messages without exposing the lie in parentheses
- Reviews that are "mixed" — they must be POLARIZED (suspiciously perfect 5★ OR devastatingly honest 1★)
- Product descriptions that are just "bad product" — describe WHY it's bad using corporate doublespeak
- Any joke that could apply to ANY company — every joke must be specific to THIS site
`

const TONE_INSTRUCTIONS: Record<string, string> = {
  standard: `
## HUMOR STYLE: STANDARD (Satirical Roast) 🎭

The default parody style. Corporate voice + unhinged content. Expose dark patterns, hidden fees, and the gap between marketing promises and reality.

### REQUIREMENTS:
1. Reviews: MIX of fake 5-stars (posted suspiciously fast) AND brutal 1-star complaints
2. At least 5 hidden fees that stack absurdly (total should exceed product price)
3. At least 4 "features" that are actually bugs/problems reframed as benefits
4. Scarcity messages with parenthetical reveals: "Only 2 left! (we've said this since 2019)"
5. Corporate doublespeak hiding terrible things
6. At least 1 popup with confusing/manipulative button labels

### EXAMPLES:
- Fake 5★: "Life changing! [Posted 0.004 seconds after delivery] [Verified Purchase*] (*verification is aesthetic, not functional)"
- Real 1★: "I've been a customer for 11 years. They've gotten worse every year. I renewed this morning. I need help." — Gerald, Ohio
- Fee: "Convenience of using our website instead of telepathy: $4.99"
- Product: "Delayed Delivery™ Premium Experience — Savor the anticipation"
- Urgency: "🔥 Only 2 left! (Our database shows 47,000 units)"

**Vibe**: Makes users say "Holy shit, this is literally what they do to me"
`,

  erotic: `
## HUMOR STYLE: EROTIC (Seductive Satire) 🔥

The website is FLIRTING with the user. Everything is a double entendre. Innuendo, not explicit.

### REQUIREMENTS:
1. EVERY product name must be a double entendre (works innocently AND suggestively)
2. ALL reviews use breathless, romance-novel language
3. At least 3 fees with suggestive names: "Extended Protection", "Premium Handling"
4. Every CTA button is flirtatious: "Add to Cart (you know you want to)"
5. Announcements read like pickup lines
6. Urgency creates romantic tension: "Don't keep us waiting..."
7. Product descriptions use: "intimate", "satisfaction", "pleasure", "deep"

### KEY RULE: Clever innuendo > crude jokes. Suggestive > explicit. BOTH innocent AND suggestive simultaneously.

### EXAMPLES:
- Product: "The Pleasure Package™" (shipping option) / "Deep Satisfaction Guarantee" (returns policy)
- Review: "I've never experienced such... thorough packaging. I needed a moment. 10/10 would unwrap again."
- Fee: "Premium Handling Fee: $4.99 (worth every penny)" / "Extended Pleasure Protection: $9.99/month"
- CTA: "Buy Now — We'll Be Gentle" / "Complete Purchase (Satisfaction Guaranteed 😏)"
- Urgency: "💋 Things are heating up... only 3 left in stock"
- Announcement: "🔥 HOT DEAL: Is it warm in here, or is it just our prices?"

**Vibe**: "Is this website... flirting with me? I think I like it."
`,

  dark: `
## HUMOR STYLE: DARK (Black Humor / Corporate Nihilism) 💀

The company KNOWS it's evil and has stopped pretending. Existential dread meets corporate efficiency. Gallows humor delivered in a cheerful corporate voice.

### REQUIREMENTS:
1. The company openly acknowledges its own awfulness in a matter-of-fact tone
2. At least 3 products/services that hint at dystopian or existential consequences
3. Reviews where customers describe genuinely disturbing experiences but rate 5 stars anyway
4. Fees that are morally questionable: "Soul Depreciation Fee", "Hope Processing Charge"
5. FAQ answers that casually reveal horrifying truths
6. At least 2 employee quotes that suggest they need help
7. Trust badges that are deeply unsettling: "Nobody Has Died*" (*recently)

### KEY RULE: The horror is CASUAL. The company treats terrible things as normal. The contrast between cheerful corporate tone and bleak content IS the joke.

### EXAMPLES:
- Product: "The Last Item You'll Ever Need™" — "We mean that in the most ominous way possible"
- Review 5★: "My therapist said this purchase was a cry for help. But it arrived on time, so who's really winning here?"
- Review 1★: "I can no longer feel joy. But the product works as described. Conflicted."
- Fee: "Existential Dread Surcharge: $3.99 (you were going to feel it anyway)"
- Fee: "Data Harvesting Transparency Fee: $1.99 (we already have your data, this is just polite)"
- FAQ: "Q: Is this ethical? A: We have a Chief Ethics Officer. She quit last month. We're counting that as a yes."
- Trust badge: "🏆 Voted 'Not the Worst' by an internal poll" — tooltip: "3 out of 5 employees participated. 2 have since left."
- Announcement: "We're aware of the situation. We've chosen to ignore it. Happy shopping! 💀"
- Employee quote: "[INTERNAL — DO NOT PUBLISH] I don't know what we sell anymore. I just know the quarterly numbers are up. — Dave, CFO"
- Popup: "Before you leave: we want you to know that your data will miss you."

**Vibe**: "This company has become self-aware and it's terrifying. I can't stop reading."
`,
}

// Theme instructions removed — themes no longer user-selectable
// Kept as empty map for backward compat with existing code paths
const THEME_INSTRUCTIONS: Record<string, string> = {
  default: '',
}

const COLOR_BLENDING_RULES = `
## COLOR GENERATION RULES

1. **primaryColor**: MUST be from the original site
   - Amazon parody → #ff9900 (Amazon orange)
   - LinkedIn parody → #0077b5 (LinkedIn blue)
   - Uber parody → #000000 (Uber black)

2. **secondaryColor**: Can be slightly theme-influenced
   - Default: From original site
   - Christmas: Blend toward red/green
   - Easter: Blend toward pastels
   - But keep recognizable as original site!

3. **accentColor**: Theme color for highlights
   - Default: From original site
   - Christmas: Gold #fbbf24
   - Sport: Trophy gold #fbbf24
   - This is where theme is most visible
`

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
        from: 'Parody Humor <noreply@parodyhumor.lol>',
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
        from: 'Parody Humor <noreply@parodyhumor.lol>',
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

// Scrape site content using Firecrawl
async function scrapeSite(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    console.warn('FIRECRAWL_API_KEY not set, skipping scrape')
    return null
  }

  try {
    console.log('Scraping site with Firecrawl...')
    const firecrawl = new FirecrawlApp({ apiKey })

    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      timeout: 30000,
    })

    if (!result.success) {
      console.warn('Firecrawl scrape failed:', result.error)
      return null
    }

    // Truncate to ~4000 chars to leave room in Claude's context
    const content = result.markdown?.slice(0, 4000) || null
    console.log(`Scraped ${content?.length || 0} chars from ${url}`)
    return content
  } catch (error) {
    console.error('Firecrawl error:', error)
    return null
  }
}

// Stage 1: Analyze the site for targeted humor
interface SiteAnalysis {
  siteType: 'ecommerce' | 'news' | 'travel' | 'social' | 'corporate' | 'food'
  businessModel: string
  realPainPoints: string[]
  darkPatterns: string[]
  marketingTone: string
  signatureElements: string[]
  parodyNameSuggestions: string[]
}

async function analyzeSite(
  anthropic: Anthropic,
  url: string,
  scrapedContent: string | null
): Promise<SiteAnalysis | null> {
  const contentSection = scrapedContent
    ? `\n\nHere is the actual content scraped from the homepage:\n---\n${scrapedContent}\n---\n`
    : ''

  const prompt = `You are a cynical tech journalist analyzing: ${url}
${contentSection}
Based on this URL${scrapedContent ? ' and the scraped content above' : ' and your knowledge of this company/industry'}, provide a quick analysis:

1. SITE TYPE: Categorize as exactly one of: "ecommerce", "news", "travel", "social", "corporate", "food"
   - ecommerce = online stores (Amazon, eBay, Shopify)
   - news = media/blogs (CNN, BuzzFeed, TechCrunch)
   - travel = booking sites (Airbnb, Booking.com)
   - social = social networks (Twitter, Facebook, LinkedIn)
   - corporate = SaaS/company sites (Stripe, Salesforce)
   - food = restaurant/delivery (DoorDash, UberEats)

2. BUSINESS MODEL: How do they make money? (1 sentence)

3. REAL PAIN POINTS: List 3-5 ACTUAL frustrations users have with this site/company.
   Think: "What do people complain about on Reddit/Twitter about this?"
   Be SPECIFIC to this company, not generic complaints.

4. DARK PATTERNS: List 2-4 manipulative tactics or annoying practices they use.
   Examples: hidden fees, fake urgency, subscription traps, data harvesting.

5. MARKETING TONE: How does their marketing sound? (1-2 words)
   Examples: "Aspirational tech-bro", "Fear-mongering", "Fake friendly", "Corporate jargon"

6. SIGNATURE ELEMENTS: 2-3 recognizable UI/UX elements or brand quirks to mock.
   Examples: Amazon's "Buy Box", Uber's surge multiplier, LinkedIn's "Who viewed your profile"

7. PARODY NAME IDEAS: Suggest 2-3 punny parody names that hint at the main joke.
   Examples: Amazon→Scamazon, Uber→Goober, LinkedIn→LinkedOut

Return ONLY this JSON:
{
  "siteType": "ecommerce|news|travel|social|corporate|food",
  "businessModel": "...",
  "realPainPoints": ["specific complaint 1", "specific complaint 2", ...],
  "darkPatterns": ["pattern 1", "pattern 2", ...],
  "marketingTone": "...",
  "signatureElements": ["element 1", "element 2", ...],
  "parodyNameSuggestions": ["Name1", "Name2", "Name3"]
}`

  try {
    console.log('Stage 1: Analyzing site for targeted humor...')
    const response = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const analysis = extractJSON(content.text) as SiteAnalysis
    console.log(`Analysis complete: ${analysis.siteType} - "${analysis.businessModel}"`)
    console.log(`Pain points: ${analysis.realPainPoints.join(', ')}`)
    return analysis
  } catch (error) {
    console.error('Site analysis failed, falling back to single-stage generation:', error)
    return null
  }
}

// Build the main prompt for Claude with tone/theme layering
function buildPrompt(
  url: string,
  analysis?: SiteAnalysis | null,
  tone: string = 'standard',
  theme: string = 'default'
): string {
  // Layer 2: Brand Identity from Analysis
  const analysisContext = analysis ? `
## SITE ANALYSIS (Layer 2: Brand Identity - USE THIS TO MAKE HUMOR TARGETED!)
Based on research, here's what we know about this site:

**Business Model:** ${analysis.businessModel}

**Real Pain Points (mock these specifically!):**
${analysis.realPainPoints.map(p => `- ${p}`).join('\n')}

**Dark Patterns They Use:**
${analysis.darkPatterns.map(p => `- ${p}`).join('\n')}

**Their Marketing Tone:** ${analysis.marketingTone}

**Signature Elements to Mock:**
${analysis.signatureElements.map(e => `- ${e}`).join('\n')}

**Suggested Parody Names:** ${analysis.parodyNameSuggestions.join(', ')}

CRITICAL: Every product, fee, review, and popup should reference these REAL issues above.
Don't invent random jokes - satirize the ACTUAL problems users have with this site.
The humor should make users think "this is too real" not "this is random nonsense."

` : ''

  // Layer 3: Tone Instructions (map legacy tones to new system)
  const toneKey = ['positive', 'negative', 'balanced'].includes(tone) ? 'standard' : tone
  const toneSection = TONE_INSTRUCTIONS[toneKey] || TONE_INSTRUCTIONS.standard

  // Layer 4: Theme Instructions (no longer used, kept for backward compat)
  const themeSection = ''

  return `You are a master satirist creating a parody of: ${url}

${IDENTITY_RULE}

${HUMOR_EXCELLENCE_RULES}
${analysisContext}
${toneSection}
${themeSection ? '\n' + themeSection : ''}

${COLOR_BLENDING_RULES}

## STEP 1: CATEGORIZE THE SITE${analysis ? ' (already analyzed above - use the provided siteType)' : ' (CRITICAL - DO THIS FIRST)'}
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
    "primaryColor": "#hex (MUST be from original site - see COLOR GENERATION RULES)",
    "secondaryColor": "#hex (can be slightly theme-influenced)",
    "accentColor": "#hex (theme color for highlights)",
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

## WRITER'S ROOM TECHNIQUE
For parody_name and heroTagline: internally generate 3 candidate options.
Score each by: specificity (+2), "too real" factor (+3), shareability (+2), surprise (+2).
Use ONLY the highest-scoring option. The best jokes are specific AND uncomfortably true.

Example scoring for an Amazon parody name:
1. "Bad Amazon" → score 2 (generic, boring)
2. "Scamazon" → score 6 (punny, recognizable)
3. "Scamazon Prime Regret™" → score 9 (specific, relatable, the ™ adds corporate voice) ✓

## QUALITY CHECKLIST (verify before responding):
1. Would this make someone ACTUALLY laugh out loud? If not → rewrite with more specificity
2. Is every joke site-SPECIFIC (not generic)? If generic → add company-specific details
3. Does this feel "too real"? If not → it's not exaggerated enough
4. Would someone screenshot this to share with friends? If not → it needs more punch
5. Are reviews a MIX of obviously fake praise AND relatable complaints?
6. Does the parody LOOK like the original site (colors, structure)?
7. Is there a RUNNING GAG that appears at least 3 times across different sections?
8. Are there at least 4 FINE PRINT reveals (asterisks/daggers with devastating truths)?
9. Is NOTHING from the BANNED CONTENT list present?

Return ONLY valid JSON, no markdown code blocks or explanations.`
}

// Build retry prompt with validation feedback
function buildRetryPrompt(
  url: string,
  issues: string[],
  analysis?: SiteAnalysis | null,
  tone: string = 'standard',
  theme: string = 'default'
): string {
  return `You are a master satirist creating a parody of: ${url}

IMPORTANT: Your previous attempt was missing required content. Please fix these issues:
${issues.map(i => `- ${i}`).join('\n')}

ALSO IMPORTANT: The parody must still LOOK like the ORIGINAL SITE with tone/theme as overlays only.

Generate a COMPLETE parody with ALL required fields. Make sure to include enough items in each array.

${buildPrompt(url, analysis, tone, theme).split('\n').slice(1).join('\n')}`
}

// Background function - does the actual Claude API work
// Called by generate-parody.ts, has 15-minute timeout
const handler: Handler = async (event) => {
  console.log('Background function started')

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const secret = event.headers['x-internal-secret']
  if (!INTERNAL_SECRET || secret !== INTERNAL_SECRET) {
    console.error('generate-parody-background: missing or invalid internal secret')
    return { statusCode: 403, body: 'Forbidden' }
  }

  const sql = neon(process.env.DATABASE_URL!)
  let parodyId: string | undefined
  let notificationEmail: string | undefined
  let parodySlug: string | undefined

  try {
    const body = JSON.parse(event.body || '{}')
    parodyId = body.parodyId
    const url = body.url
    const tone = body.tone || 'standard'
    const theme = body.theme || 'default'

    if (!parodyId || !url) {
      console.error('Missing parodyId or url')
      return { statusCode: 400, body: 'Missing parodyId or url' }
    }

    console.log(`Generating parody for ${url} (ID: ${parodyId}, tone: ${tone}, theme: ${theme})`)

    // Get parody record for notification email and slug
    const parodyRecord = await sql`SELECT notification_email, slug FROM parodies WHERE id = ${parodyId}`
    if (parodyRecord.length > 0) {
      notificationEmail = parodyRecord[0].notification_email
      parodySlug = parodyRecord[0].slug
    }

    // Update status to generating
    await sql`UPDATE parodies SET status = 'generating' WHERE id = ${parodyId}`

    // Check kill switch for Claude API
    if (isClaudeAPIDisabled()) {
      await sql`
        UPDATE parodies
        SET status = 'failed', error_message = 'AI generation is temporarily paused. Please try again later.'
        WHERE id = ${parodyId}
      `
      await decrementActiveGenerations()
      return { statusCode: 503, body: 'Claude API disabled' }
    }

    // Check budget before making expensive API call
    const killSwitches = getKillSwitches()
    const budget = await checkBudget(killSwitches.DAILY_BUDGET_CENTS)
    if (!budget.allowed) {
      await sql`
        UPDATE parodies
        SET status = 'failed', error_message = 'Daily generation limit reached. Please try again tomorrow.'
        WHERE id = ${parodyId}
      `
      await decrementActiveGenerations()
      if (notificationEmail) {
        await sendNotificationEmail(notificationEmail, 'your parody', '', false, 'Daily capacity reached. Please try again tomorrow.')
      }
      return budgetExceededResponse()
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Scrape site content for more accurate analysis
    const scrapedContent = await scrapeSite(url)

    // Stage 1: Analyze site for targeted humor (gracefully falls back if it fails)
    const analysis = await analyzeSite(anthropic, url, scrapedContent)

    // Stage 2: Generate parody content using analysis with tone/theme
    console.log('Stage 2: Generating parody content...')
    let response = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: `You are a master satirist working at Onion-level absurdism (8/10 on the absurdity scale). Your professional tone is impeccable — corporate formatting, serious voice, polished language. Your content is increasingly unhinged. The widening gap between your formal voice and your chaotic content IS the joke. You never write safe, generic jokes. Specificity is your weapon. Every piece of content should make someone screenshot it and send it to a friend.`,
      messages: [{ role: 'user', content: buildPrompt(url, analysis, tone, theme) }],
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
        system: `You are a master satirist working at Onion-level absurdism (8/10 on the absurdity scale). Your professional tone is impeccable — corporate formatting, serious voice, polished language. Your content is increasingly unhinged. The widening gap between your formal voice and your chaotic content IS the joke. You never write safe, generic jokes. Specificity is your weapon. Every piece of content should make someone screenshot it and send it to a friend.`,
        messages: [{ role: 'user', content: buildRetryPrompt(url, validation.issues, analysis, tone, theme) }],
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

    // Record API usage for budget tracking
    const inputTokens = response.usage?.input_tokens || 2000
    const outputTokens = response.usage?.output_tokens || 6000
    await recordUsage(inputTokens, outputTokens)

    // Decrement active generation counter
    await decrementActiveGenerations()

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

    // Decrement active generation counter on failure
    await decrementActiveGenerations()

    // Send failure notification email if user provided one
    if (notificationEmail) {
      await sendNotificationEmail(notificationEmail, 'your parody', '', false, errorMessage)
    }

    return { statusCode: 500, body: errorMessage }
  }
}

export { handler }
