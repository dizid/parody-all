import { neon } from '@neondatabase/serverless'

// This is used server-side in Netlify functions
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return neon(databaseUrl)
}
