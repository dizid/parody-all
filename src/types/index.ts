// Simple types for the application
// These will be used until we connect to Supabase and generate proper types

export type Tier = 'free' | 'starter' | 'pro' | 'unlimited'
export type BacklinkSize = 'large' | 'medium' | 'small' | 'minimal'

export interface Profile {
  id: string
  tier: Tier
  parodies_used: number
  parodies_limit: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
}

export interface Parody {
  id: string
  user_id: string
  slug: string
  original_url: string
  site_type: string
  parody_name: string
  parody_data: ParodyData | null
  parody_config: ParodyConfig | null
  status: 'analyzing' | 'generating' | 'complete' | 'failed'
  expires_at: string | null
  backlink_size: BacklinkSize
  created_at: string
}

// Pricing tiers
export const PRICING_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    parodies: 1,
    duration: '1 week',
    backlink: 'large',
    features: ['1 parody site', 'Expires after 1 week', 'Promotional backlinks'],
  },
  starter: {
    name: 'Starter',
    price: 5,
    parodies: 3,
    duration: '1 month',
    backlink: 'medium',
    features: ['3 parody sites/month', 'Sites live for 1 month', 'Medium backlinks'],
  },
  pro: {
    name: 'Pro',
    price: 15,
    parodies: 10,
    duration: '3 months',
    backlink: 'small',
    features: ['10 parody sites/month', 'Sites live for 3 months', 'Small backlinks'],
  },
  unlimited: {
    name: 'Unlimited',
    price: 39,
    parodies: -1, // unlimited
    duration: 'forever',
    backlink: 'minimal',
    features: ['Unlimited parodies', 'Sites never expire', 'Minimal branding'],
  },
} as const

export interface ParodyData {
  products?: Product[]
  destinations?: Destination[]
  fees?: Fee[]
  categories?: Category[]
  deliveryOptions?: DeliveryOption[]
  paymentMethods?: PaymentMethod[]
  reviews?: Review[]
}

export interface ParodyConfig {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  logo?: string
  tagline?: string
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  image: string
  category: string
  reviews: number
  rating: number
  deliveryTime: string
  badges?: string[]
  topReview?: string
}

export interface Destination {
  id: string
  name: string
  country: string
  tagline: string
  description: string
  image: string
  trapRating: number
  badges: Badge[]
  reasonsToAvoid: string[]
  averagePrice: number
}

export interface Badge {
  id: string
  name: string
  icon: string
  color: string
}

export interface Fee {
  name: string
  amount: number
  reason: string
}

export interface Category {
  id: string
  name: string
  icon: string
}

export interface DeliveryOption {
  id: string
  name: string
  time: string
  price: string
  description: string
}

export interface PaymentMethod {
  id: string
  name: string
  icon: string
  description: string
}

export interface Review {
  id: string
  author: string
  rating: number
  text: string
  date: string
}

export type SiteType = 'ecommerce' | 'travel' | 'social' | 'booking' | 'news' | 'other'

export interface AnalysisResult {
  url: string
  siteName: string
  siteType: SiteType
  primaryColor: string
  secondaryColor: string
  description: string
  sampleContent: string[]
}
