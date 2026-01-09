import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const signature = event.headers['stripe-signature']

  if (!signature) {
    return { statusCode: 400, body: 'Missing stripe-signature header' }
  }

  let stripeEvent: Stripe.Event

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body!,
      signature,
      webhookSecret
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const credits = parseInt(session.metadata?.credits || '1', 10)

        if (!userId) {
          console.error('No user_id in session metadata')
          break
        }

        // Add credits to user's limit
        await sql`
          UPDATE profiles
          SET parodies_limit = parodies_limit + ${credits}
          WHERE id = ${userId}
        `

        console.log(`Added ${credits} credits to user ${userId}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = stripeEvent.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Get user by Stripe customer ID
        const profile = (await sql`
          SELECT id FROM profiles WHERE stripe_customer_id = ${customerId}
        `)[0]

        if (!profile) {
          console.error('No profile found for customer:', customerId)
          break
        }

        // Update tier based on subscription
        const priceId = subscription.items.data[0]?.price.id
        let tier = 'free'
        let limit = 1

        // Map price IDs to tiers (configure these in your Stripe dashboard)
        if (priceId === process.env.STRIPE_STARTER_PRICE_ID) {
          tier = 'starter'
          limit = 10
        } else if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
          tier = 'pro'
          limit = 50
        } else if (priceId === process.env.STRIPE_UNLIMITED_PRICE_ID) {
          tier = 'unlimited'
          limit = -1 // Unlimited
        }

        await sql`
          UPDATE profiles
          SET tier = ${tier}, parodies_limit = ${limit}
          WHERE id = ${profile.id}
        `

        console.log(`Updated user ${profile.id} to tier ${tier}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Downgrade to free tier
        await sql`
          UPDATE profiles
          SET tier = 'free', parodies_limit = 1
          WHERE stripe_customer_id = ${customerId}
        `

        console.log(`Downgraded customer ${customerId} to free tier`)
        break
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    }
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    }
  }
}

export { handler }
