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
    // Add notification_email column for email notifications when parody is ready
    await sql`
      ALTER TABLE parodies
      ADD COLUMN IF NOT EXISTS notification_email TEXT
    `

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Migration completed: added notification_email column' })
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
