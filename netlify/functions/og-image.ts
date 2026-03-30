import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

// Generates a dynamic OG image card as SVG for social sharing previews.
// Returns an SVG that Twitter/Facebook/etc render as the preview card.
// Using SVG avoids needing heavy image generation dependencies.

const handler: Handler = async (event) => {
  const slug = event.queryStringParameters?.slug
  if (!slug) {
    return { statusCode: 400, body: 'Missing slug parameter' }
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    const rows = await sql`
      SELECT parody_name, original_url, parody_data, parody_config, tone, theme, site_type
      FROM parodies
      WHERE slug = ${slug} AND status = 'complete'
      LIMIT 1
    `

    if (rows.length === 0) {
      return { statusCode: 404, body: 'Parody not found' }
    }

    const parody = rows[0]
    const parodyData = typeof parody.parody_data === 'string'
      ? JSON.parse(parody.parody_data)
      : parody.parody_data
    const config = typeof parody.parody_config === 'string'
      ? JSON.parse(parody.parody_config)
      : parody.parody_config

    // Extract domain from original URL
    let domain = ''
    try {
      domain = new URL(parody.original_url).hostname.replace('www.', '')
    } catch {
      domain = parody.original_url
    }

    const name = parody.parody_name || 'Parody'
    const tagline = parodyData?.heroTagline || 'An AI-generated parody'
    const primaryColor = config?.primaryColor || '#7c3aed'
    const accentColor = config?.accentColor || '#ec4899'

    // Tone badge
    const toneBadges: Record<string, { label: string; color: string }> = {
      standard: { label: 'ROAST', color: '#7c3aed' },
      erotic: { label: 'SPICY', color: '#be185d' },
      dark: { label: 'DARK', color: '#1f2937' },
      // Legacy tones
      negative: { label: 'ROAST', color: '#7c3aed' },
      positive: { label: 'ROAST', color: '#7c3aed' },
      balanced: { label: 'ROAST', color: '#7c3aed' },
    }
    const badge = toneBadges[parody.tone] || toneBadges.standard

    // Site type icon
    const siteIcons: Record<string, string> = {
      ecommerce: '🛒',
      news: '📰',
      travel: '✈️',
      social: '💬',
      corporate: '🏢',
      food: '🍔',
    }
    const siteIcon = siteIcons[parody.site_type] || '🎭'

    // Truncate tagline to fit card
    const maxTaglineLen = 80
    const truncatedTagline = tagline.length > maxTaglineLen
      ? tagline.slice(0, maxTaglineLen) + '...'
      : tagline

    // Truncate name
    const maxNameLen = 30
    const truncatedName = name.length > maxNameLen
      ? name.slice(0, maxNameLen) + '...'
      : name

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${escSvg(primaryColor)};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${escSvg(accentColor)};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${escSvg(primaryColor)};stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Subtle grid pattern -->
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" stroke-opacity="0.05" stroke-width="1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#grid)" />

  <!-- Top bar -->
  <rect x="0" y="0" width="1200" height="4" fill="url(#accent)" />

  <!-- Logo area -->
  <text x="60" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="white" opacity="0.7">🎭 ParodyHumor.lol</text>

  <!-- Tone badge -->
  <rect x="1000" y="42" width="${badge.label.length * 16 + 24}" height="36" rx="18" fill="${badge.color}" />
  <text x="${1000 + (badge.label.length * 16 + 24) / 2}" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="white" font-weight="bold" text-anchor="middle">${escSvg(badge.label)}</text>

  <!-- Site type icon -->
  <text x="60" y="230" font-size="64">${siteIcon}</text>

  <!-- Parody name (large) -->
  <text x="140" y="230" font-family="system-ui, -apple-system, sans-serif" font-size="56" fill="white" font-weight="bold">${escSvg(truncatedName)}</text>

  <!-- Accent line -->
  <rect x="60" y="260" width="200" height="4" rx="2" fill="url(#accent)" />

  <!-- Tagline -->
  <text x="60" y="320" font-family="system-ui, -apple-system, sans-serif" font-size="28" fill="white" opacity="0.85">"${escSvg(truncatedTagline)}"</text>

  <!-- Domain -->
  <text x="60" y="400" font-family="system-ui, -apple-system, sans-serif" font-size="22" fill="white" opacity="0.5">parody of ${escSvg(domain)}</text>

  <!-- Bottom CTA -->
  <rect x="60" y="520" width="320" height="56" rx="28" fill="url(#accent)" />
  <text x="220" y="555" font-family="system-ui, -apple-system, sans-serif" font-size="20" fill="white" font-weight="600" text-anchor="middle">View this roast →</text>

  <!-- Bottom bar -->
  <rect x="0" y="626" width="1200" height="4" fill="url(#accent)" />
</svg>`

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
      body: svg,
    }
  } catch (error) {
    console.error('OG image generation error:', error)
    return { statusCode: 500, body: 'Failed to generate image' }
  }
}

// Escape special characters for SVG text content
function escSvg(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export { handler }
