import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

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
    const authHeader = event.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      }
    }

    const { userId, userEmail, priceId, quantity = 1 } = JSON.parse(event.body || '{}')

    if (!userId || !priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId or priceId' }),
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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: {
        user_id: userId,
        credits: String(quantity),
      },
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url }),
    }
  } catch (error: any) {
    console.error('Error creating checkout:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    }
  }
}

export { handler }
