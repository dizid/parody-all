import { createClerkClient } from '@clerk/backend'

// Initialize Clerk backend client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

export interface AuthResult {
  authenticated: false
  error: string
} | {
  authenticated: true
  userId: string
}

/**
 * Verifies a JWT token from the Authorization header and extracts the user ID.
 * This replaces the insecure pattern of trusting client-provided userId.
 */
export async function verifyAuth(authHeader: string | undefined): Promise<AuthResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' }
  }

  const token = authHeader.slice(7) // Remove 'Bearer ' prefix

  if (!token) {
    return { authenticated: false, error: 'Empty token' }
  }

  try {
    // Verify the JWT using Clerk's backend SDK
    const { sub } = await clerk.verifyToken(token)

    if (!sub) {
      return { authenticated: false, error: 'Token missing subject claim' }
    }

    return { authenticated: true, userId: sub }
  } catch (error: unknown) {
    // Log the error for debugging but don't expose details to client
    console.error('Token verification failed:', error instanceof Error ? error.message : 'Unknown error')
    return { authenticated: false, error: 'Invalid or expired token' }
  }
}

/**
 * Standard response headers with CORS restricted to allowed origins.
 * Uses CORS_ORIGIN env var in production, allows localhost in development.
 */
export function getHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    process.env.CORS_ORIGIN, // Production domain
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8888',
  ].filter(Boolean) as string[]

  // Default to first allowed origin if no match
  const corsOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed))
    ? origin
    : allowedOrigins[0] || '*'

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  }
}

/**
 * Helper to create an unauthorized response
 */
export function unauthorizedResponse(headers: Record<string, string>, message = 'Unauthorized') {
  return {
    statusCode: 401,
    headers,
    body: JSON.stringify({ error: message }),
  }
}
