// Application types

export type Tier = 'none' | 'free' | 'spark' | 'single' | 'creator' | 'pro' | 'agency'
export type BacklinkSize = 'large' | 'small' | 'none'

// Parody style modifiers — simplified from 24 combos to 3 clear options
export type ParodyTone = 'standard' | 'erotic' | 'dark'
// Theme kept for backward compat with existing parodies but no longer user-selectable
export type ParodyTheme = 'default' | 'christmas' | 'easter' | 'sport' | 'sensual' | 'retro'

// Style configuration for display (the 2 optional modifiers + default)
export const PARODY_TONES: Record<ParodyTone, { icon: string; label: string; description: string }> = {
  standard: {
    icon: '🎭',
    label: 'Standard',
    description: 'Satirical roast — dark patterns, hidden fees, corporate BS exposed'
  },
  erotic: {
    icon: '🔥',
    label: 'Sexy',
    description: 'Seductive innuendo — everything is a double entendre'
  },
  dark: {
    icon: '💀',
    label: 'Dark',
    description: 'Black humor — existential dread meets corporate nihilism'
  },
}

// Legacy theme configs (kept for backward compat display of old parodies)
export const PARODY_THEMES: Record<string, { icon: string; label: string }> = {
  default: { icon: '🎭', label: 'Default' },
  christmas: { icon: '🎄', label: 'Christmas' },
  easter: { icon: '🐰', label: 'Easter' },
  sport: { icon: '⚽', label: 'Sport' },
  sensual: { icon: '💋', label: 'Sensual' },
  retro: { icon: '📺', label: 'Retro' },
}

export interface Profile {
  id: string
  tier: Tier
  parodies_used: number
  parodies_limit: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  creator_url: string | null
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
  creator_url: string | null
  tone: ParodyTone
  theme: ParodyTheme
  error_message?: string
  created_at: string
}

// Pricing tiers
export const PRICING_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    parodies: 1,
    duration: '1 week',
    backlink: 'large' as BacklinkSize,
    isSubscription: false,
    features: ['1 parody site', 'Expires after 1 week', 'Watermark backlink'],
  },
  spark: {
    name: 'Spark',
    price: 9,
    parodies: 3,
    duration: '30 days',
    backlink: 'large' as BacklinkSize,
    isSubscription: false,
    features: ['3 parody sites', 'Live for 30 days', 'Standard backlink'],
  },
  single: {
    name: 'Single Parody',
    price: 49,
    parodies: 1,
    duration: '1 week',
    backlink: 'large' as BacklinkSize,
    isSubscription: false,
    features: ['1 parody site', 'Expires after 1 week', 'Promotional backlinks'],
  },
  creator: {
    name: 'Creator',
    price: 49,
    parodies: 10,
    duration: '6 months',
    backlink: 'small' as BacklinkSize,
    isSubscription: true,
    features: ['10 active parodies', 'Live for 6 months', 'Small backlinks', 'Custom backlink URL'],
  },
  pro: {
    name: 'Pro',
    price: 149,
    parodies: -1,
    duration: 'forever',
    backlink: 'none' as BacklinkSize,
    isSubscription: true,
    features: ['Unlimited parodies', 'Never expire', 'No backlinks', 'Custom backlink URL'],
  },
  agency: {
    name: 'Agency',
    price: 399,
    parodies: -1,
    duration: 'forever',
    backlink: 'none' as BacklinkSize,
    isSubscription: true,
    features: ['Unlimited parodies', 'Never expire', 'White-label (no branding)', 'Custom backlink URL', 'Priority generation'],
  },
} as const

export interface ParodyData {
  // === SHARED CONTENT (all site types) ===
  heroTagline?: string
  heroSubtitle?: string
  announcements?: Announcement[]
  popups?: Popup[]
  easterEggs?: EasterEgg[]
  trustBadges?: TrustBadge[]
  faqs?: FAQ[]
  reviews?: Review[]
  fees?: Fee[]

  // === ECOMMERCE ===
  products?: Product[]
  categories?: Category[]
  deliveryOptions?: DeliveryOption[]
  paymentMethods?: PaymentMethod[]

  // === NEWS ===
  articles?: Article[]
  breakingNews?: string  // Ticker text
  sponsoredContent?: Article[]

  // === TRAVEL ===
  destinations?: Destination[]
  urgencyMessages?: string[]  // "Only 2 left at this price!"

  // === SOCIAL ===
  posts?: Post[]
  suggestedProfiles?: SuggestedProfile[]
  trending?: string[]  // Hashtags

  // === CORPORATE ===
  features?: Feature[]
  pricingTiers?: PricingTier[]
  testimonials?: Testimonial[]

  // === FOOD ===
  menuItems?: MenuItem[]
  deliveryFees?: Fee[]

  // Section visibility flags (legacy, kept for compatibility)
  hasProducts?: boolean
  hasDestinations?: boolean
  hasFeed?: boolean
  hasBooking?: boolean
  hasCart?: boolean
  hasFees?: boolean
  hasReviews?: boolean
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
  verified?: boolean
  helpful?: number
  notHelpful?: number
}

// Interactive popup types
export type PopupTrigger = 'add_to_cart' | 'checkout' | 'exit_intent' | 'scroll_50' | 'timer_10s' | 'newsletter' | 'search_click' | 'cart_click' | 'nav_click' | 'logo_click'

export interface PopupButton {
  label: string
  primary?: boolean
}

export interface Popup {
  id: string
  trigger: PopupTrigger
  title: string
  message: string
  buttons: string[] | PopupButton[]
  icon?: string
}

// Announcement banners
export type AnnouncementType = 'warning' | 'sale' | 'info' | 'urgent'
export interface Announcement {
  id: string
  type: AnnouncementType
  text: string
  icon?: string
}

// Easter eggs
export type EasterEggTrigger = 'logo_click_5x' | 'scroll_bottom' | 'konami_code' | 'click_price' | 'hover_badge'
export type EasterEggAction = 'show_message' | 'add_fee' | 'change_theme' | 'confetti' | 'glitch'
export interface EasterEgg {
  id: string
  trigger: EasterEggTrigger
  action: EasterEggAction
  message?: string
  fee?: { name: string; amount: number }
}

// FAQ section
export interface FAQ {
  id: string
  question: string
  answer: string
}

// Trust badges (fake)
export interface TrustBadge {
  id: string
  name: string
  icon: string
  tooltip?: string
}

export type SiteType = 'ecommerce' | 'travel' | 'social' | 'news' | 'corporate' | 'food'

// NEWS - Articles and headlines
export interface Article {
  id: string
  headline: string
  category: string  // "POLITICS", "TECH", "OPINION", "BREAKING"
  summary: string
  author: string
  authorTitle?: string  // "Senior Clickbait Correspondent"
  image: string
  readTime: string
  commentCount: number
  isBreaking?: boolean
  isSponsored?: boolean
}

// SOCIAL - Posts and profiles
export interface Post {
  id: string
  author: string
  handle: string
  avatar: string
  content: string
  likes: number
  reposts: number
  comments: number
  timestamp: string
  isVerified?: boolean
  isPromoted?: boolean
}

export interface SuggestedProfile {
  id: string
  name: string
  handle: string
  avatar: string
  bio: string
  isVerified?: boolean
}

// CORPORATE - SaaS landing pages
export interface Feature {
  id: string
  icon: string
  title: string
  description: string  // Buzzword-laden nonsense
}

export interface PricingTier {
  id: string
  name: string
  price: string  // "$999/mo" or "Contact Sales"
  period?: string  // "/month", "/year"
  features: string[]
  isPopular?: boolean
  ctaText: string
}

export interface Testimonial {
  id: string
  quote: string
  author: string
  title: string
  company: string
  avatar: string
}

// FOOD - Menu items and delivery
export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  image: string
  prepTime: string
  calories?: string
  badges?: string[]  // "Popular", "New", "Probably Fresh"
}

export interface AnalysisResult {
  url: string
  siteName: string
  siteType: SiteType
  primaryColor: string
  secondaryColor: string
  description: string
  sampleContent: string[]
}

// Two-stage humor generation: Stage 1 analysis
export interface SiteAnalysis {
  siteType: SiteType
  businessModel: string              // "Subscription SaaS", "Marketplace", etc.
  realPainPoints: string[]           // 3-5 actual user complaints
  darkPatterns: string[]             // Tricks/tactics they use
  marketingTone: string              // "Aspirational", "Fear-based", etc.
  signatureElements: string[]        // Recognizable UI/UX patterns to mock
  parodyNameSuggestions: string[]    // 2-3 punny name ideas
}
