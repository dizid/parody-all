<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useUser, useAuth as useClerkAuth } from '@clerk/vue'
import {
  PRICING_TIERS,
  PARODY_TONES,
  PARODY_THEMES,
  type AnalysisResult,
  type SiteType,
  type ParodyTone,
  type ParodyTheme
} from '../types'

const router = useRouter()
const route = useRoute()
const { isSignedIn } = useAuth()
const { user } = useUser()
const { getToken } = useClerkAuth()

// Test bypass via URL param ?test=test123
const testKey = computed(() => route.query.test as string | undefined)

const url = ref('')
const isAnalyzing = ref(false)
const isGenerating = ref(false)
const analysisResult = ref<AnalysisResult | null>(null)
const error = ref('')
const animatedCount = ref(0)

// Customization options
const selectedTone = ref<ParodyTone>('negative')
const selectedTheme = ref<ParodyTheme>('default')

// Animated counter on mount
onMounted(() => {
  const targetCount = 12847
  const duration = 2000
  const startTime = Date.now()

  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    animatedCount.value = Math.floor(progress * targetCount)
    if (progress < 1) requestAnimationFrame(animate)
  }
  animate()
})

const siteTypeInfo: Record<SiteType, { icon: string; name: string; description: string }> = {
  ecommerce: { icon: '🛒', name: 'E-Commerce', description: 'Absurd products, impossible delivery times, and fees that make you question reality' },
  news: { icon: '📰', name: 'News/Media', description: 'Clickbait headlines, paywalls for everything, and ads disguised as articles' },
  travel: { icon: '✈️', name: 'Travel/Booking', description: 'Places NOT to visit, fake urgency, and fees revealed at checkout' },
  social: { icon: '👥', name: 'Social Media', description: 'Algorithm jokes, engagement bait, and verified checkmarks for $8' },
  corporate: { icon: '🏢', name: 'Corporate/SaaS', description: 'Buzzword bingo, vague promises, and "Contact Sales" pricing' },
  food: { icon: '🍔', name: 'Food/Delivery', description: 'Fee stacking, tiny portions, and delivery times that are pure fiction' },
}

const exampleParodies = [
  { original: 'amazon.com', parody: 'Amazone', icon: '📦', tagline: 'Your wallet disappears faster than free shipping' },
  { original: 'trip.com', parody: 'TRAP.com', icon: '🪤', tagline: 'Places NOT to visit - since 2010' },
  { original: 'uber.com', parody: 'Goober', icon: '🚗', tagline: 'Surge pricing is our love language' },
  { original: 'airbnb.com', parody: 'Scarebnb', icon: '🏚️', tagline: 'Where the photos are fake and the bugs are real' },
]

async function analyzeUrl() {
  if (!url.value) return

  error.value = ''
  isAnalyzing.value = true
  analysisResult.value = null

  try {
    await new Promise(resolve => setTimeout(resolve, 1500))

    const urlLower = url.value.toLowerCase()
    let siteType: SiteType = 'ecommerce'  // default

    if (urlLower.includes('amazon') || urlLower.includes('shop') || urlLower.includes('store') || urlLower.includes('buy') || urlLower.includes('ebay') || urlLower.includes('etsy')) {
      siteType = 'ecommerce'
    } else if (urlLower.includes('cnn') || urlLower.includes('news') || urlLower.includes('nytimes') || urlLower.includes('bbc') || urlLower.includes('buzzfeed') || urlLower.includes('medium')) {
      siteType = 'news'
    } else if (urlLower.includes('trip') || urlLower.includes('travel') || urlLower.includes('booking') || urlLower.includes('hotel') || urlLower.includes('expedia') || urlLower.includes('airbnb')) {
      siteType = 'travel'
    } else if (urlLower.includes('twitter') || urlLower.includes('facebook') || urlLower.includes('instagram') || urlLower.includes('tiktok') || urlLower.includes('linkedin') || urlLower.includes('x.com')) {
      siteType = 'social'
    } else if (urlLower.includes('stripe') || urlLower.includes('salesforce') || urlLower.includes('hubspot') || urlLower.includes('slack') || urlLower.includes('notion') || urlLower.includes('.io')) {
      siteType = 'corporate'
    } else if (urlLower.includes('doordash') || urlLower.includes('ubereats') || urlLower.includes('grubhub') || urlLower.includes('food') || urlLower.includes('restaurant')) {
      siteType = 'food'
    }

    analysisResult.value = {
      url: url.value,
      siteName: new URL(url.value.startsWith('http') ? url.value : `https://${url.value}`).hostname.replace('www.', ''),
      siteType,
      primaryColor: '#7c3aed',
      secondaryColor: '#f59e0b',
      description: 'A website ripe for parody',
      sampleContent: ['Headlines', 'Products', 'Content'],
    }
  } catch (e) {
    error.value = 'Failed to analyze URL. Please check the URL and try again.'
    console.error(e)
  } finally {
    isAnalyzing.value = false
  }
}

async function generateParody() {
  if (!isSignedIn.value) {
    router.push('/login')
    return
  }

  if (!user.value || !analysisResult.value?.url) return

  isGenerating.value = true
  error.value = ''

  try {
    const token = await getToken.value()

    const response = await fetch('/.netlify/functions/generate-parody', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: analysisResult.value.url,
        userId: user.value.id,
        tone: selectedTone.value,
        theme: selectedTheme.value,
        ...(testKey.value && { testKey: testKey.value }),
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to start generation')
    }

    const data = await response.json()
    router.push(`/generate?id=${data.id}`)
  } catch (e: any) {
    console.error('Error starting generation:', e)
    error.value = e.message || 'Failed to start generation. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Tone helper functions for UI styling
function getToneSelectedClass(tone: ParodyTone): string {
  const classes: Record<ParodyTone, string> = {
    negative: 'border-red-500 bg-red-50 ring-2 ring-red-200',
    positive: 'border-green-500 bg-green-50 ring-2 ring-green-200',
    balanced: 'border-gray-500 bg-gray-50 ring-2 ring-gray-200',
    erotic: 'border-pink-500 bg-pink-50 ring-2 ring-pink-200',
  }
  return classes[tone]
}

// Theme helper functions for UI styling
function getThemeSelectedClass(theme: ParodyTheme): string {
  const classes: Record<ParodyTheme, string> = {
    default: 'border-purple-500 bg-purple-50 ring-2 ring-purple-200',
    christmas: 'border-red-500 bg-red-50 ring-2 ring-red-200',
    easter: 'border-pink-400 bg-pink-50 ring-2 ring-pink-200',
    sport: 'border-blue-500 bg-blue-50 ring-2 ring-blue-200',
    sensual: 'border-rose-500 bg-rose-50 ring-2 ring-rose-200',
    retro: 'border-orange-500 bg-orange-50 ring-2 ring-orange-200',
  }
  return classes[theme]
}

</script>

<template>
  <div class="overflow-hidden">
    <!-- Hero Section with Animated Background -->
    <section class="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      <!-- Animated gradient background -->
      <div class="absolute inset-0 bg-gradient-to-br from-purple-900 via-violet-800 to-fuchsia-900">
        <div class="absolute inset-0 opacity-30">
          <div class="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div class="absolute top-0 -right-4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div class="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      <!-- Floating elements -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 left-10 text-6xl animate-float opacity-20">🎭</div>
        <div class="absolute top-1/3 right-20 text-5xl animate-float animation-delay-1000 opacity-20">😂</div>
        <div class="absolute bottom-1/4 left-1/4 text-4xl animate-float animation-delay-2000 opacity-20">🤣</div>
        <div class="absolute top-1/2 right-1/4 text-5xl animate-float animation-delay-3000 opacity-20">💀</div>
      </div>

      <div class="relative z-10 max-w-5xl mx-auto px-4 text-center">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8 animate-fade-in-up">
          <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span class="text-white/80 text-sm font-medium">{{ animatedCount.toLocaleString() }}+ parodies created</span>
        </div>

        <!-- Main heading -->
        <h1 class="text-5xl md:text-7xl font-black text-white mb-6 leading-tight animate-fade-in-up animation-delay-200">
          Turn Any Website Into
          <span class="block bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 text-transparent bg-clip-text">
            Comedy Gold
          </span>
        </h1>

        <p class="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12 animate-fade-in-up animation-delay-400">
          AI-powered parody generator. Enter any URL and watch it transform into satirical genius.
        </p>

        <!-- URL Input Card -->
        <div class="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-2 max-w-2xl mx-auto shadow-2xl animate-fade-in-up animation-delay-600">
          <form @submit.prevent="analyzeUrl" class="flex gap-2">
            <div class="flex-1 relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">🔗</span>
              <input
                v-model="url"
                type="text"
                placeholder="Paste any URL... (amazon.com, trip.com, etc.)"
                class="w-full pl-14 pr-4 py-4 bg-white rounded-2xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-500/50 text-lg font-medium"
              />
            </div>
            <button
              type="submit"
              :disabled="isAnalyzing || !url"
              class="bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg hover:shadow-lg hover:shadow-yellow-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span v-if="isAnalyzing" class="flex items-center gap-2">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Analyzing...
              </span>
              <span v-else>Create Parody ✨</span>
            </button>
          </form>
        </div>

        <p v-if="error" class="mt-4 text-red-300 animate-shake">{{ error }}</p>

        <!-- Pricing teaser -->
        <p class="mt-6 text-white/60 text-sm animate-fade-in-up animation-delay-800">
          💰 <span class="text-yellow-400 font-semibold">From $49</span> - Premium viral content on demand
        </p>
      </div>

      <!-- Scroll indicator -->
      <div class="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg class="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
        </svg>
      </div>
    </section>

    <!-- Analysis Result Modal -->
    <Transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="analysisResult" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
          <!-- Header with gradient -->
          <div class="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div class="flex items-center gap-4">
              <span class="text-5xl">{{ siteTypeInfo[analysisResult.siteType].icon }}</span>
              <div>
                <h3 class="text-2xl font-bold">{{ analysisResult.siteName }}</h3>
                <p class="text-white/80">{{ siteTypeInfo[analysisResult.siteType].name }}</p>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6">
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 mb-6">
              <p class="text-gray-700">
                {{ siteTypeInfo[analysisResult.siteType].description }}
              </p>
            </div>

            <div class="space-y-3 mb-6">
              <div class="flex items-center gap-3 text-gray-600">
                <span class="text-green-500">✓</span>
                <span>AI-generated satirical content</span>
              </div>
              <div class="flex items-center gap-3 text-gray-600">
                <span class="text-green-500">✓</span>
                <span>Shareable parody link</span>
              </div>
              <div class="flex items-center gap-3 text-gray-600">
                <span class="text-green-500">✓</span>
                <span>{{ isSignedIn ? 'Ready in ~30 seconds' : 'Sign in to generate' }}</span>
              </div>
            </div>

            <!-- Customization Section -->
            <div class="border-t border-gray-100 pt-4 mt-4 mb-6 space-y-4">
              <!-- Tone Selector -->
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-2">Tone</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(config, tone) in PARODY_TONES"
                    :key="tone"
                    @click="selectedTone = tone as ParodyTone"
                    class="px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-sm"
                    :class="selectedTone === tone ? getToneSelectedClass(tone as ParodyTone) : 'border-gray-200 hover:border-gray-300 bg-white'"
                  >
                    <span class="text-sm">{{ config.icon }}</span>
                    <span>{{ config.label }}</span>
                  </button>
                </div>
              </div>

              <!-- Theme Selector -->
              <div>
                <label class="block text-xs font-medium text-gray-500 mb-2">Theme</label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="(config, theme) in PARODY_THEMES"
                    :key="theme"
                    @click="selectedTheme = theme as ParodyTheme"
                    class="px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-sm"
                    :class="selectedTheme === theme ? getThemeSelectedClass(theme as ParodyTheme) : 'border-gray-200 hover:border-gray-300 bg-white'"
                  >
                    <span class="text-sm">{{ config.icon }}</span>
                    <span>{{ config.label }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Error message -->
            <div v-if="error" class="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
              {{ error }}
            </div>

            <div class="flex gap-3">
              <button
                @click="generateParody"
                :disabled="isGenerating"
                class="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 disabled:opacity-50"
              >
                {{ isGenerating ? '⏳ Generating...' : (isSignedIn ? '🚀 Generate Now' : '🔐 Sign In to Generate') }}
              </button>
              <button
                @click="analysisResult = null; url = ''"
                :disabled="isGenerating"
                class="px-6 py-4 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Example Parodies Section -->
    <section class="py-24" style="background-color: var(--color-bg-secondary);">
      <div class="max-w-6xl mx-auto px-4">
        <div class="text-center mb-16">
          <span class="inline-block bg-purple-500/20 text-purple-400 px-4 py-1 rounded-full text-sm font-semibold mb-4">
            EXAMPLES
          </span>
          <h2 class="text-4xl md:text-5xl font-black mb-4" style="color: var(--color-text-primary);">
            Parody Hall of Fame
          </h2>
          <p class="text-xl max-w-2xl mx-auto" style="color: var(--color-text-secondary);">
            See what our AI creates. These are just previews - yours will be even better!
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div
            v-for="example in exampleParodies"
            :key="example.original"
            class="group relative rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer border"
            style="background-color: var(--color-bg-card); border-color: var(--color-border);"
          >
            <div class="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div class="relative">
              <span class="text-4xl mb-4 block">{{ example.icon }}</span>
              <p class="text-sm line-through mb-1" style="color: var(--color-text-secondary);">{{ example.original }}</p>
              <h3 class="text-2xl font-bold mb-2" style="color: var(--color-text-primary);">{{ example.parody }}</h3>
              <p class="text-sm italic" style="color: var(--color-text-secondary);">"{{ example.tagline }}"</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="py-24" style="background-color: var(--color-bg-primary);">
      <div class="max-w-6xl mx-auto px-4">
        <div class="text-center mb-16">
          <span class="inline-block bg-yellow-500/20 text-yellow-400 px-4 py-1 rounded-full text-sm font-semibold mb-4">
            HOW IT WORKS
          </span>
          <h2 class="text-4xl md:text-5xl font-black mb-4" style="color: var(--color-text-primary);">
            3 Steps to Comedy
          </h2>
        </div>

        <div class="grid md:grid-cols-3 gap-8">
          <div class="text-center">
            <div class="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-purple-500/30">
              1️⃣
            </div>
            <h3 class="text-xl font-bold mb-2" style="color: var(--color-text-primary);">Paste URL</h3>
            <p style="color: var(--color-text-secondary);">Enter any website URL you want to parody</p>
          </div>
          <div class="text-center">
            <div class="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-yellow-500/30">
              2️⃣
            </div>
            <h3 class="text-xl font-bold mb-2" style="color: var(--color-text-primary);">AI Magic</h3>
            <p style="color: var(--color-text-secondary);">Our AI generates hilarious satirical content</p>
          </div>
          <div class="text-center">
            <div class="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-lg shadow-green-500/30">
              3️⃣
            </div>
            <h3 class="text-xl font-bold mb-2" style="color: var(--color-text-primary);">Share & Laugh</h3>
            <p style="color: var(--color-text-secondary);">Get a unique link to share your parody</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Section -->
    <section class="py-24 bg-gradient-to-br from-purple-900 via-violet-800 to-fuchsia-900 text-white">
      <div class="max-w-5xl mx-auto px-4">
        <div class="text-center mb-16">
          <span class="inline-block bg-white/10 backdrop-blur-sm px-4 py-1 rounded-full text-sm font-semibold mb-4">
            PRICING
          </span>
          <h2 class="text-4xl md:text-5xl font-black mb-4">
            Simple, Transparent Pricing
          </h2>
          <p class="text-xl text-white/80 max-w-2xl mx-auto">
            Try once or subscribe for unlimited comedy
          </p>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
          <!-- Single Parody -->
          <div class="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20">
            <div class="text-xs font-bold uppercase mb-2 text-white/60">Try It Out</div>
            <h3 class="text-2xl font-bold mb-2">{{ PRICING_TIERS.single.name }}</h3>
            <div class="flex items-baseline gap-1 mb-4">
              <span class="text-4xl font-black">${{ PRICING_TIERS.single.price }}</span>
              <span class="text-white/60">one-time</span>
            </div>
            <ul class="space-y-3 mb-6">
              <li v-for="feature in PRICING_TIERS.single.features" :key="feature" class="flex items-center gap-2">
                <span class="text-green-400">✓</span>
                <span class="text-white/80">{{ feature }}</span>
              </li>
            </ul>
            <button
              @click="router.push('/login')"
              class="w-full py-3 rounded-xl font-bold transition-all duration-300 bg-white/20 text-white hover:bg-white/30"
            >
              Buy Now
            </button>
          </div>

          <!-- Creator (Best Value) -->
          <div class="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-yellow-400 to-orange-500 text-gray-900 shadow-xl shadow-yellow-500/30 scale-105">
            <div class="text-xs font-bold uppercase mb-2 text-gray-900/70">Best Value</div>
            <h3 class="text-2xl font-bold mb-2">{{ PRICING_TIERS.creator.name }}</h3>
            <div class="flex items-baseline gap-1 mb-4">
              <span class="text-4xl font-black">${{ PRICING_TIERS.creator.price }}</span>
              <span class="text-gray-900/70">/month</span>
            </div>
            <ul class="space-y-3 mb-6">
              <li v-for="feature in PRICING_TIERS.creator.features" :key="feature" class="flex items-center gap-2">
                <span class="text-gray-900">✓</span>
                <span class="text-gray-900">{{ feature }}</span>
              </li>
            </ul>
            <button
              @click="router.push('/login')"
              class="w-full py-3 rounded-xl font-bold transition-all duration-300 bg-gray-900 text-white hover:bg-gray-800"
            >
              Subscribe
            </button>
          </div>

          <!-- Pro -->
          <div class="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20">
            <div class="text-xs font-bold uppercase mb-2 text-white/60">Unlimited</div>
            <h3 class="text-2xl font-bold mb-2">{{ PRICING_TIERS.pro.name }}</h3>
            <div class="flex items-baseline gap-1 mb-4">
              <span class="text-4xl font-black">${{ PRICING_TIERS.pro.price }}</span>
              <span class="text-white/60">/month</span>
            </div>
            <ul class="space-y-3 mb-6">
              <li v-for="feature in PRICING_TIERS.pro.features" :key="feature" class="flex items-center gap-2">
                <span class="text-green-400">✓</span>
                <span class="text-white/80">{{ feature }}</span>
              </li>
            </ul>
            <button
              @click="router.push('/login')"
              class="w-full py-3 rounded-xl font-bold transition-all duration-300 bg-white/20 text-white hover:bg-white/30"
            >
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-24" style="background-color: var(--color-bg-secondary);">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <div class="text-6xl mb-6">🎭</div>
        <h2 class="text-4xl md:text-5xl font-black mb-6" style="color: var(--color-text-primary);">
          Ready to Make Someone Laugh?
        </h2>
        <p class="text-xl mb-8 max-w-2xl mx-auto" style="color: var(--color-text-secondary);">
          Join thousands of creators who are turning boring websites into comedy gold.
        </p>
        <button
          @click="scrollToTop"
          class="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300"
        >
          Create Your First Parody →
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

.animate-fade-in-up {
  animation: fade-in-up 0.6s ease-out forwards;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

.animation-delay-200 { animation-delay: 200ms; }
.animation-delay-400 { animation-delay: 400ms; }
.animation-delay-600 { animation-delay: 600ms; }
.animation-delay-800 { animation-delay: 800ms; }
.animation-delay-1000 { animation-delay: 1000ms; }
.animation-delay-2000 { animation-delay: 2000ms; }
.animation-delay-3000 { animation-delay: 3000ms; }
.animation-delay-4000 { animation-delay: 4000ms; }
</style>
