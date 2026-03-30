import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'
import { isMaintenanceMode, maintenanceResponse } from './lib/killswitch'
import { verifyAuth, getHeaders, unauthorizedResponse } from './lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const handler: Handler = async (event) => {
  const headers = getHeaders(event.headers.origin)

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

  // Kill switch: maintenance mode blocks new checkouts
  if (isMaintenanceMode()) {
    return maintenanceResponse()
  }

  try {
    // Verify JWT and extract userId from token
    const authResult = await verifyAuth(event.headers.authorization)
    if (!authResult.authenticated) {
      return unauthorizedResponse(headers, authResult.error)
    }
    const userId = authResult.userId

    const { userEmail, priceId, tier } = JSON.parse(event.body || '{}')

    if (!priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing priceId' }),
      }
    }

    const sql = neon(process.env.DATABASE_URL!)

    // Get or create Stripe customer
    let profile = (await sql`
      SELECT stripe_customer_id FROM profiles WHERE id = ${userId}
    `)[0]

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      })
      customerId = customer.id

      // Save to profile
      await sql`
        UPDATE profiles SET stripe_customer_id = ${customerId} WHERE id = ${userId}
      `
    }

    // Get origin for redirect URLs
    const origin = event.headers.origin || event.headers.referer || 'http://localhost:8888'

    // Determine checkout mode based on tier (only creator is subscription)
    const isSubscription = tier === 'creator'

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: {
        user_id: userId,
        price_id: priceId,
        tier: tier || 'single',
      },
      // For subscriptions, also add metadata to the subscription
      ...(isSubscription && {
        subscription_data: {
          metadata: {
            user_id: userId,
            tier,
          },
        },
      }),
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (error: unknown) {
    // Log full error server-side but return generic message to client
    console.error('Error creating checkout:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

export { handler }
