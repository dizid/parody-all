import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import Stripe from 'stripe'
import { isMaintenanceMode } from './lib/killswitch'

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

  // Log if processing during maintenance mode (but don't block - we still want to capture payments)
  if (isMaintenanceMode()) {
    console.log(`Processing webhook ${stripeEvent.type} during maintenance mode`)
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const priceId = session.metadata?.price_id

        if (!userId) {
          console.error('No user_id in session metadata')
          break
        }

        // Handle one-time purchases (single or spark)
        if (priceId === process.env.STRIPE_SINGLE_PRICE_ID) {
          await sql`
            UPDATE profiles
            SET parodies_limit = parodies_limit + 1,
                tier = CASE WHEN tier IN ('none', 'free') THEN 'single' ELSE tier END
            WHERE id = ${userId}
          `
          console.log(`Added 1 credit to user ${userId} (single purchase)`)
        } else if (priceId === process.env.STRIPE_SPARK_PRICE_ID) {
          await sql`
            UPDATE profiles
            SET parodies_limit = parodies_limit + 3,
                tier = CASE WHEN tier IN ('none', 'free') THEN 'spark' ELSE tier END
            WHERE id = ${userId}
          `
          console.log(`Added 3 credits to user ${userId} (spark purchase)`)
        } else {
          // Legacy: add credits from metadata
          const credits = parseInt(session.metadata?.credits || '1', 10)
          await sql`
            UPDATE profiles
            SET parodies_limit = parodies_limit + ${credits}
            WHERE id = ${userId}
          `
          console.log(`Added ${credits} credits to user ${userId}`)
        }
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
        let tier = 'none'
        let limit = 0

        // Map price IDs to tiers
        if (priceId === process.env.STRIPE_CREATOR_PRICE_ID) {
          tier = 'creator'
          limit = 10
        } else if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
          tier = 'pro'
          limit = -1 // Unlimited
        } else if (priceId === process.env.STRIPE_AGENCY_PRICE_ID) {
          tier = 'agency'
          limit = -1 // Unlimited
        }

        // Reset parodies_used on new subscription/renewal
        await sql`
          UPDATE profiles
          SET tier = ${tier}, parodies_limit = ${limit}, parodies_used = 0
          WHERE id = ${profile.id}
        `

        console.log(`Updated user ${profile.id} to tier ${tier} with ${limit} credits`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Downgrade to no tier - they keep remaining credits but can't renew
        await sql`
          UPDATE profiles
          SET tier = 'none'
          WHERE stripe_customer_id = ${customerId}
        `

        console.log(`Subscription cancelled for customer ${customerId}`)
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
