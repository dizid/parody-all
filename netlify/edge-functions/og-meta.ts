// Edge function that intercepts /p/* requests and injects dynamic OG meta tags
// for social sharing previews. Runs at the edge before the SPA loads.

export default async function handler(request: Request) {
  const url = new URL(request.url)
  const slug = url.pathname.replace('/p/', '')

  // Skip non-page requests (assets, API calls)
  if (!slug || slug.includes('.') || slug.includes('/')) {
    return
  }

  // Only intercept for social crawlers and unfurlers (bots that need OG tags)
  // Regular browsers get the SPA which hydrates client-side
  const ua = (request.headers.get('user-agent') || '').toLowerCase()
  const isCrawler = /twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|embedly|quora|pinterest|redditbot|applebot|bingbot/i.test(ua)

  if (!isCrawler) {
    // Regular browser — let the SPA handle it
    return
  }

  // Fetch parody data from the API
  try {
    const siteUrl = url.origin
    const apiUrl = `${siteUrl}/.netlify/functions/get-parody?slug=${encodeURIComponent(slug)}`

    const response = await fetch(apiUrl)
    if (!response.ok) {
      return // Let SPA handle errors
    }

    const parody = await response.json()

    // Extract domain from original URL
    let originalDomain = ''
    try {
      originalDomain = new URL(parody.original_url).hostname.replace('www.', '')
    } catch {
      originalDomain = parody.original_url
    }

    // Build OG metadata
    const ogTitle = `${parody.parody_name} — ${originalDomain} but honest`
    const ogDescription = parody.parody_data?.heroTagline
      || `An AI parody of ${originalDomain}. The fees are fictional. The pain is real.`
    const ogImage = `${siteUrl}/.netlify/functions/og-image?slug=${encodeURIComponent(slug)}`
    const canonicalUrl = `${siteUrl}/p/${slug}`

    // Tone badge text
    const toneBadge = {
      negative: 'ROAST',
      positive: 'UTOPIA',
      balanced: 'BALANCED',
      erotic: 'SPICY',
    }[parody.tone] || 'PARODY'

    // Build HTML with OG tags — minimal page that crawlers can parse
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(ogTitle)}</title>

  <!-- Primary Meta Tags -->
  <meta name="title" content="${escapeHtml(ogTitle)}" />
  <meta name="description" content="${escapeHtml(ogDescription)}" />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="ParodyHumor.lol" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${ogImage}" />

  <!-- Redirect real browsers to the SPA -->
  <meta http-equiv="refresh" content="0; url=${canonicalUrl}" />
  <link rel="canonical" href="${canonicalUrl}" />
</head>
<body>
  <h1>${escapeHtml(parody.parody_name)}</h1>
  <p>${escapeHtml(ogDescription)}</p>
  <p>A ${toneBadge.toLowerCase()} parody of <a href="${escapeHtml(parody.original_url)}">${escapeHtml(originalDomain)}</a></p>
  <p><a href="${canonicalUrl}">View this parody on ParodyHumor.lol</a></p>
</body>
</html>`

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch (error) {
    console.error('OG meta edge function error:', error)
    return // Fall through to SPA on error
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export const config = {
  path: '/p/*',
}
