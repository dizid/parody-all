import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

// One-time migration script - run via: /.netlify/functions/run-migration?key=YOUR_SECRET
const handler: Handler = async (event) => {
  const migrationKey = event.queryStringParameters?.key

  if (migrationKey !== process.env.MIGRATION_KEY) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const sql = neon(process.env.DATABASE_URL!)

  try {
    const results: string[] = []

    // Add notification_email column for email notifications when parody is ready
    await sql`
      ALTER TABLE parodies
      ADD COLUMN IF NOT EXISTS notification_email TEXT
    `
    results.push('Added notification_email column')

    // Add indexes for performance (idempotent - uses IF NOT EXISTS)
    await sql`
      CREATE INDEX IF NOT EXISTS idx_parodies_slug ON parodies(slug)
    `
    results.push('Created idx_parodies_slug index')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_parodies_user_status ON parodies(user_id, status)
    `
    results.push('Created idx_parodies_user_status index')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_parodies_expires ON parodies(expires_at) WHERE expires_at IS NOT NULL
    `
    results.push('Created idx_parodies_expires partial index')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL
    `
    results.push('Created idx_profiles_stripe_customer index')

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, results })
    }
  } catch (error: any) {
    console.error('Migration error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

export { handler }
