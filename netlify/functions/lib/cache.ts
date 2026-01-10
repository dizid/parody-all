// Redis caching layer using Upstash
// Provides caching for parodies and rate limiting

import { Redis } from '@upstash/redis'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.log('Upstash Redis not configured - caching disabled')
    return null
  }

  redis = new Redis({ url, token })
  return redis
}

// Cache a completed parody (5 min TTL)
export async function cacheParody(slug: string, parody: object): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    await client.setex(`parody:${slug}`, 300, JSON.stringify(parody))
  } catch (error) {
    console.error('Failed to cache parody:', error)
  }
}

// Get cached parody
export async function getCachedParody(slug: string): Promise<object | null> {
  const client = getRedis()
  if (!client) return null

  try {
    const cached = await client.get(`parody:${slug}`)
    return cached ? (typeof cached === 'string' ? JSON.parse(cached) : cached) : null
  } catch (error) {
    console.error('Failed to get cached parody:', error)
    return null
  }
}

// Invalidate cached parody
export async function invalidateParody(slug: string): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    await client.del(`parody:${slug}`)
  } catch (error) {
    console.error('Failed to invalidate parody cache:', error)
  }
}

// Track active generations for concurrency control
export async function getActiveGenerations(): Promise<number> {
  const client = getRedis()
  if (!client) return 0

  try {
    const count = await client.get('active_generations')
    return parseInt(count as string || '0')
  } catch (error) {
    console.error('Failed to get active generations:', error)
    return 0
  }
}

export async function incrementActiveGenerations(): Promise<number> {
  const client = getRedis()
  if (!client) return 0

  try {
    const count = await client.incr('active_generations')
    // Set expiry in case of crash
    await client.expire('active_generations', 900) // 15 min
    return count
  } catch (error) {
    console.error('Failed to increment active generations:', error)
    return 0
  }
}

export async function decrementActiveGenerations(): Promise<void> {
  const client = getRedis()
  if (!client) return

  try {
    await client.decr('active_generations')
  } catch (error) {
    console.error('Failed to decrement active generations:', error)
  }
}
