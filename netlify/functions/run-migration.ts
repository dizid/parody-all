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

    // Add tone column for parody tone customization
    await sql`
      ALTER TABLE parodies
      ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'negative'
    `
    results.push('Added tone column')

    // Add theme column for parody theme customization
    await sql`
      ALTER TABLE parodies
      ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'default'
    `
    results.push('Added theme column')

    // Add creator_url column for backlink customization
    await sql`
      ALTER TABLE parodies
      ADD COLUMN IF NOT EXISTS creator_url TEXT
    `
    results.push('Added creator_url column')

    // Add creator_url column to profiles for paid users
    await sql`
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS creator_url TEXT
    `
    results.push('Added creator_url column to profiles')

    // Fix backlink_size constraint to allow 'none' value
    // Drop the column constraint by removing and re-adding (simpler than finding constraint name)
    try {
      await sql`ALTER TABLE parodies DROP CONSTRAINT IF EXISTS parodies_backlink_size_check`
      results.push('Dropped parodies_backlink_size_check if existed')
    } catch (e) {
      results.push('No parodies_backlink_size_check to drop')
    }

    // Try common auto-generated constraint names
    try {
      await sql`ALTER TABLE parodies DROP CONSTRAINT IF EXISTS parodies_backlink_size_check1`
      results.push('Dropped parodies_backlink_size_check1 if existed')
    } catch (e) {}

    // Add new constraint allowing 'none' (will fail silently if already exists with same name)
    try {
      await sql`
        ALTER TABLE parodies
        ADD CONSTRAINT parodies_backlink_size_check
        CHECK (backlink_size IS NULL OR backlink_size IN ('large', 'small', 'none'))
      `
      results.push('Added new backlink_size constraint allowing none')
    } catch (e: any) {
      results.push('backlink_size constraint: ' + e.message)
    }

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
