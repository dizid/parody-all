<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUser, useAuth as useClerkAuth } from '@clerk/vue'
import type { Parody, ParodyData, ParodyConfig, Product, ParodyTheme, ParodyTone } from '../types'
import { useParodyInteractions } from '../composables/useParodyInteractions'
import ParodyBacklink from '../components/ParodyBacklink.vue'
import ParodyHeader from '../components/parody/ParodyHeader.vue'
import ParodyPopup from '../components/parody/ParodyPopup.vue'
import ShareModal from '../components/ShareModal.vue'
import ProductCard from '../components/parody/ProductCard.vue'
import ParodyReviews from '../components/parody/ParodyReviews.vue'
import FeeCalculator from '../components/parody/FeeCalculator.vue'
import ParodyFooter from '../components/parody/ParodyFooter.vue'
import FloatingShareBar from '../components/parody/FloatingShareBar.vue'
import ReactionBar from '../components/parody/ReactionBar.vue'

const route = useRoute()
const router = useRouter()
const { user } = useUser()
const { getToken } = useClerkAuth()

const parody = ref<Parody | null>(null)
const loading = ref(true)
const error = ref('')
const isExpired = ref(false)
const showShareModal = ref(false)
const isRegenerating = ref(false)
const regenerateError = ref('')
const viewTracked = ref(false)

// Check if current user owns this parody
const isOwner = computed(() => {
  return user.value && parody.value && parody.value.user_id === user.value.id
})

// Interactions
const {
  cartItems,
  cartOpen,
  cartItemCount,
  addToCart,
  removeFromCart,
  activeFees,
  feeAnimating,
  addFee,
  initializeFees,
  activePopup,
  popupVisible,
  triggerPopup,
  closePopup,
  handlePopupButton,
  logoClickCount,
  easterEggMessage,
  showEasterEgg,
  glitchMode,
  handleLogoClick,
  handleScroll,
  handleMouseLeave,
  handleCheckout,
  startTimerPopup,
  stopTimerPopup,
} = useParodyInteractions()

const parodyData = computed<ParodyData | null>(() => {
  if (!parody.value?.parody_data) return null
  return parody.value.parody_data as ParodyData
})

const parodyConfig = computed<ParodyConfig | null>(() => {
  if (!parody.value?.parody_config) return null
  return parody.value.parody_config as ParodyConfig
})

// Share URL for the modal
const shareUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return window.location.href
  }
  return ''
})

// Cart subtotal (before fees)
const cartSubtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
)

// Theme-specific CSS variables
const themeColors: Record<ParodyTheme, { accent: string; secondary: string; glow: string }> = {
  default: { accent: '#7c3aed', secondary: '#ec4899', glow: 'rgba(124, 58, 237, 0.3)' },
  christmas: { accent: '#dc2626', secondary: '#16a34a', glow: 'rgba(220, 38, 38, 0.3)' },
  easter: { accent: '#ec4899', secondary: '#a855f7', glow: 'rgba(236, 72, 153, 0.3)' },
  sport: { accent: '#1d4ed8', secondary: '#dc2626', glow: 'rgba(29, 78, 216, 0.3)' },
  sensual: { accent: '#991b1b', secondary: '#1f1f1f', glow: 'rgba(153, 27, 27, 0.3)' },
  retro: { accent: '#ea580c', secondary: '#854d0e', glow: 'rgba(234, 88, 12, 0.3)' },
}

// Tone-specific visual styles
const toneStyles: Record<ParodyTone, { badge: string; cardShadow: string; bgTint: string }> = {
  negative: { badge: '#ef4444', cardShadow: 'rgba(239, 68, 68, 0.2)', bgTint: 'rgba(127, 29, 29, 0.03)' },
  positive: { badge: '#22c55e', cardShadow: 'rgba(34, 197, 94, 0.2)', bgTint: 'rgba(34, 197, 94, 0.03)' },
  balanced: { badge: '#6b7280', cardShadow: 'rgba(107, 114, 128, 0.15)', bgTint: 'rgba(107, 114, 128, 0.02)' },
  erotic: { badge: '#be185d', cardShadow: 'rgba(190, 24, 93, 0.2)', bgTint: 'rgba(190, 24, 93, 0.03)' },
}

const themeStyles = computed(() => {
  const theme = (parody.value?.theme as ParodyTheme) || 'default'
  const colors = themeColors[theme] || themeColors.default
  const tone = (parody.value?.tone as ParodyTone) || 'negative'
  const toneConfig = toneStyles[tone] || toneStyles.negative
  return {
    '--theme-accent': colors.accent,
    '--theme-secondary': colors.secondary,
    '--theme-glow': colors.glow,
    '--tone-badge': toneConfig.badge,
    '--tone-card-shadow': toneConfig.cardShadow,
    '--tone-bg-tint': toneConfig.bgTint,
  }
})

const themeClass = computed(() => {
  const theme = parody.value?.theme || 'default'
  return `theme-${theme}`
})

const toneClass = computed(() => {
  const tone = parody.value?.tone || 'negative'
  return `tone-${tone}`
})

onMounted(async () => {
  await fetchParody()

  // Set up scroll listener
  window.addEventListener('scroll', onScroll)

  // Set up exit intent
  document.addEventListener('mouseleave', onMouseLeave)

  // Start timer popup
  if (parodyData.value?.popups) {
    startTimerPopup(parodyData.value.popups)
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('mouseleave', onMouseLeave)
  stopTimerPopup()
})

function onScroll() {
  handleScroll(parodyData.value?.easterEggs, parodyData.value?.popups)
}

function onMouseLeave(e: MouseEvent) {
  // Only trigger if leaving from the top
  if (e.clientY <= 0) {
    handleMouseLeave(parodyData.value?.popups)
  }
}

async function fetchParody() {
  const slug = route.params.slug as string

  if (!slug) {
    error.value = 'Parody not found'
    loading.value = false
    return
  }

  try {
    const response = await fetch(`/.netlify/functions/get-parody?slug=${slug}`)

    if (response.status === 410) {
      const data = await response.json()
      error.value = data.error || 'This parody has expired'
      isExpired.value = true
      return
    }

    if (!response.ok) throw new Error('Failed to fetch parody')

    const data = await response.json()
    parody.value = data

    // Initialize fees from parody data
    if (data.parody_data?.fees) {
      initializeFees(data.parody_data.fees.slice(0, 4))
    }

    // Track view (once per page load)
    if (!viewTracked.value && data.slug) {
      viewTracked.value = true
      fetch('/.netlify/functions/track-engagement', {
        method: 'POST',
        body: JSON.stringify({ slug: data.slug, action: 'view' }),
      }).catch(() => {}) // Silent fail
    }
  } catch (e) {
    error.value = 'Parody not found'
    console.error(e)
  } finally {
    loading.value = false
  }
}

// Track shares for the counter
function trackShare(_platform: string) {
  if (!parody.value?.slug) return
  fetch('/.netlify/functions/track-engagement', {
    method: 'POST',
    body: JSON.stringify({ slug: parody.value.slug, action: 'share' }),
  }).catch(() => {})
}

function handleAddToCart(product: Product) {
  addToCart(product)
  // Add random fee occasionally
  if (Math.random() > 0.7 && parodyData.value?.fees?.length) {
    const randomFee = parodyData.value.fees[Math.floor(Math.random() * parodyData.value.fees.length)]
    if (randomFee) setTimeout(() => addFee(randomFee), 1000)
  }
  // Trigger popup
  triggerPopup('add_to_cart', parodyData.value?.popups)
}

function handleLogoClickEvent() {
  handleLogoClick(parodyData.value?.easterEggs)
  // Also trigger logo click popup on first click
  triggerPopup('logo_click', parodyData.value?.popups)
}

function handleSearchClick() {
  triggerPopup('search_click', parodyData.value?.popups)
}

function handleCartClick() {
  cartOpen.value = !cartOpen.value
  triggerPopup('cart_click', parodyData.value?.popups)
}

async function shareParody() {
  // Try native share first (mobile/modern browsers)
  if (navigator.share) {
    try {
      await navigator.share({
        url: window.location.href,
        title: parody.value?.parody_name || 'Check out this parody!',
        text: 'Check out this hilarious parody!'
      })
      return
    } catch {
      // User cancelled or error - fall through to modal
    }
  }
  // Fallback: show share modal
  showShareModal.value = true
}

async function regenerateParody() {
  if (!parody.value || !user.value || !isOwner.value) return

  if (!confirm('This will regenerate your parody with new content. It costs 1 credit. Continue?')) {
    return
  }

  isRegenerating.value = true
  regenerateError.value = ''

  try {
    const token = await getToken.value()

    const response = await fetch('/.netlify/functions/regenerate-parody', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        parodyId: parody.value.id,
        userId: user.value.id,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to start regeneration')
    }

    // Redirect to generate page to watch progress
    router.push(`/generate?id=${parody.value.id}`)
  } catch (e: any) {
    regenerateError.value = e.message
  } finally {
    isRegenerating.value = false
  }
}
</script>

<template>
  <!-- Full-page parody view -->
  <div
    class="min-h-screen transition-all duration-300"
    :class="[themeClass, toneClass, { 'animate-glitch': glitchMode }]"
    :style="{ ...themeStyles, backgroundColor: 'var(--color-bg-secondary)' }"
  >
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="text-6xl mb-4 animate-bounce">🎭</div>
        <p class="text-xl" style="color: var(--color-text-secondary);">Loading your parody...</p>
        <div class="flex justify-center gap-1 mt-4">
          <div class="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
          <div class="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
          <div class="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen">
      <div class="text-center max-w-md mx-auto px-4">
        <div class="text-6xl mb-4">{{ isExpired ? '⏰' : '😢' }}</div>
        <h2 v-if="isExpired" class="text-2xl font-bold mb-2" style="color: var(--color-text-primary);">
          Parody Expired
        </h2>
        <h2 v-else class="text-2xl font-bold mb-2" style="color: var(--color-text-primary);">
          Parody Not Found
        </h2>
        <p class="text-red-400 mb-6">{{ error }}</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <RouterLink
            to="/dashboard"
            class="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            Create New Parody
          </RouterLink>
          <RouterLink to="/" class="text-parody-primary hover:underline py-3">
            Back to Home
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Parody Content -->
    <div v-else-if="parody && parodyConfig">
      <!-- Theme Decorations Layer -->
      <div class="themed-decorations pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <!-- Christmas: Snowflakes -->
        <template v-if="parody.theme === 'christmas'">
          <div class="snowflake" style="left: 5%; animation-delay: 0s;">❄️</div>
          <div class="snowflake" style="left: 15%; animation-delay: 1s;">❅</div>
          <div class="snowflake" style="left: 25%; animation-delay: 2s;">❄️</div>
          <div class="snowflake" style="left: 45%; animation-delay: 0.5s;">❅</div>
          <div class="snowflake" style="left: 65%; animation-delay: 1.5s;">❄️</div>
          <div class="snowflake" style="left: 85%; animation-delay: 2.5s;">❅</div>
          <div class="snowflake" style="left: 95%; animation-delay: 0.7s;">❄️</div>
        </template>

        <!-- Easter: Floating eggs -->
        <template v-if="parody.theme === 'easter'">
          <div class="easter-egg" style="left: 8%; top: 20%;">🥚</div>
          <div class="easter-egg" style="left: 92%; top: 35%;">🐣</div>
          <div class="easter-egg" style="left: 5%; top: 60%;">🌸</div>
          <div class="easter-egg" style="left: 88%; top: 75%;">🐰</div>
          <div class="easter-egg" style="left: 12%; top: 85%;">🌷</div>
        </template>

        <!-- Sport: Stadium stripes -->
        <template v-if="parody.theme === 'sport'">
          <div class="sport-stripe sport-stripe-1"></div>
          <div class="sport-stripe sport-stripe-2"></div>
          <div class="scoreboard-corner">
            <span class="scoreboard-text">GAME ON</span>
          </div>
        </template>

        <!-- Sensual: Soft vignette overlay -->
        <template v-if="parody.theme === 'sensual'">
          <div class="sensual-vignette"></div>
          <div class="sensual-glow"></div>
        </template>

        <!-- Retro: Starburst elements -->
        <template v-if="parody.theme === 'retro'">
          <div class="retro-starburst" style="top: 10%; right: 5%;">✦</div>
          <div class="retro-starburst" style="bottom: 20%; left: 3%;">★</div>
          <div class="retro-starburst" style="top: 40%; left: 2%;">✧</div>
          <div class="retro-starburst" style="bottom: 40%; right: 4%;">✦</div>
          <div class="retro-dots"></div>
        </template>
      </div>

      <!-- Promotional Backlink Banner -->
      <ParodyBacklink
        :size="parody.backlink_size || 'large'"
        position="banner"
      />

      <!-- Parody Notice Banner -->
      <div class="bg-pink-500 text-white text-center py-2 text-sm flex items-center justify-center gap-4 flex-wrap">
        <span>🎭 This is a parody of <a :href="parody.original_url" target="_blank" rel="noopener" class="underline hover:text-white/80">{{ parody.original_url }}</a> - For entertainment only!</span>
        <div class="flex gap-2">
          <button
            v-if="isOwner"
            @click="regenerateParody"
            :disabled="isRegenerating"
            class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50"
          >
            {{ isRegenerating ? '🔄 Regenerating...' : '🔄 Regenerate' }}
          </button>
          <button
            @click="shareParody"
            class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-medium transition-colors"
          >
            🔥 Share this roast
          </button>
        </div>
      </div>

      <!-- Regenerate Error -->
      <div v-if="regenerateError" class="bg-red-500 text-white text-center py-2 text-sm">
        {{ regenerateError }}
      </div>

      <!-- Main Header -->
      <ParodyHeader
        :parody-name="parody.parody_name"
        :config="parodyConfig"
        :hero-tagline="parodyData?.heroTagline"
        :hero-subtitle="parodyData?.heroSubtitle"
        :announcements="parodyData?.announcements"
        :cart-item-count="cartItemCount"
        :logo-click-count="logoClickCount"
        :creator-url="parody.creator_url"
        :backlink-size="parody.backlink_size"
        @logo-click="handleLogoClickEvent"
        @cart-click="handleCartClick"
        @search-click="handleSearchClick"
      />

      <!-- Easter Egg Message -->
      <Transition name="slide-down">
        <div
          v-if="showEasterEgg"
          class="fixed top-20 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-bounce"
        >
          🎉 {{ easterEggMessage }}
        </div>
      </Transition>

      <!-- Inline Share CTA -->
      <div
        v-if="parody"
        class="text-center py-4 px-4"
        :style="{ backgroundColor: parodyConfig?.accentColor ? parodyConfig.accentColor + '15' : 'rgba(124, 58, 237, 0.08)' }"
      >
        <p class="text-sm text-gray-600 mb-2">This roast is too good to keep to yourself</p>
        <button
          @click="shareParody"
          class="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
        >
          Share this roast 🔥
        </button>
        <span v-if="(parody as any).share_count >= 5" class="ml-3 text-xs text-gray-400">
          {{ ((parody as any).share_count || 0).toLocaleString() }} shares
        </span>
      </div>

      <!-- Breaking News Ticker (for news sites) -->
      <div
        v-if="parody.site_type === 'news' && parodyData?.breakingNews"
        class="bg-red-600 text-white py-2 overflow-hidden"
      >
        <div class="animate-marquee whitespace-nowrap">
          <span class="font-bold mr-4">🔴 BREAKING:</span>
          {{ parodyData.breakingNews }}
          <span class="mx-8">•</span>
          {{ parodyData.breakingNews }}
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="grid lg:grid-cols-3 gap-8">
          <!-- Main Content (2 cols) -->
          <div class="lg:col-span-2">

            <!-- ========== NEWS LAYOUT ========== -->
            <template v-if="parody.site_type === 'news' && parodyData?.articles?.length">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>📰</span>
                  Today's Top Stories
                </h2>
                <span class="text-sm text-gray-500">{{ parodyData.articles.length }} articles</span>
              </div>

              <!-- Featured Article -->
              <div
                v-if="parodyData.articles[0]"
                class="mb-6 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer"
                @click="triggerPopup('newsletter', parodyData?.popups)"
              >
                <img :src="parodyData.articles[0].image" class="w-full h-64 object-cover" loading="lazy" />
                <div class="p-6">
                  <div class="flex items-center gap-2 mb-3">
                    <span v-if="parodyData.articles[0].isBreaking" class="bg-red-600 text-white px-2 py-1 text-xs font-bold rounded animate-pulse">BREAKING</span>
                    <span v-if="parodyData.articles[0].isSponsored" class="bg-yellow-500 text-black px-2 py-1 text-xs font-bold rounded">SPONSORED</span>
                    <span class="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase">{{ parodyData.articles[0].category }}</span>
                  </div>
                  <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2 hover:text-purple-600 transition-colors">
                    {{ parodyData.articles[0].headline }}
                  </h3>
                  <p class="text-gray-600 dark:text-gray-300 mb-4">{{ parodyData.articles[0].summary }}</p>
                  <div class="flex items-center gap-4 text-sm text-gray-500">
                    <span>By {{ parodyData.articles[0].author }}</span>
                    <span v-if="parodyData.articles[0].authorTitle" class="italic">{{ parodyData.articles[0].authorTitle }}</span>
                    <span>{{ parodyData.articles[0].readTime }}</span>
                    <span>💬 {{ parodyData.articles[0].commentCount?.toLocaleString() }}</span>
                  </div>
                </div>
              </div>

              <!-- Article Grid -->
              <div class="grid sm:grid-cols-2 gap-4">
                <div
                  v-for="article in parodyData.articles.slice(1, 7)"
                  :key="article.id"
                  class="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow hover:shadow-lg transition-all cursor-pointer"
                  @click="triggerPopup('newsletter', parodyData?.popups)"
                >
                  <img :src="article.image" class="w-full h-32 object-cover" loading="lazy" />
                  <div class="p-4">
                    <div class="flex items-center gap-2 mb-2">
                      <span v-if="article.isSponsored" class="bg-yellow-500 text-black px-1.5 py-0.5 text-xs font-bold rounded">AD</span>
                      <span class="text-xs text-purple-600 dark:text-purple-400 font-bold">{{ article.category }}</span>
                    </div>
                    <h4 class="font-bold text-gray-900 dark:text-white text-sm leading-tight hover:text-purple-600">
                      {{ article.headline }}
                    </h4>
                    <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>{{ article.readTime }}</span>
                      <span>💬 {{ article.commentCount?.toLocaleString() }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ========== SOCIAL LAYOUT ========== -->
            <template v-else-if="parody.site_type === 'social' && parodyData?.posts?.length">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>📱</span>
                  For You
                </h2>
                <span class="text-sm text-gray-500 dark:text-gray-400">(Definitely not ads)</span>
              </div>

              <!-- Posts Feed -->
              <div class="space-y-4">
                <div
                  v-for="post in parodyData.posts.slice(0, 8)"
                  :key="post.id"
                  class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow hover:shadow-lg transition-all"
                  :class="{ 'border-2 border-yellow-400': post.isPromoted }"
                >
                  <div v-if="post.isPromoted" class="text-xs text-yellow-600 font-bold mb-2">📢 Promoted</div>
                  <div class="flex gap-3">
                    <img :src="post.avatar" class="w-12 h-12 rounded-full" loading="lazy" />
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-900 dark:text-white">{{ post.author }}</span>
                        <span v-if="post.isVerified" class="text-blue-500">✓</span>
                        <span class="text-gray-500 text-sm">@{{ post.handle }}</span>
                        <span class="text-gray-400 text-sm">· {{ post.timestamp }}</span>
                      </div>
                      <p class="text-gray-800 dark:text-gray-200 mt-1">{{ post.content }}</p>
                      <div class="flex items-center gap-6 mt-3 text-gray-500">
                        <button class="flex items-center gap-1 hover:text-red-500 transition-colors">
                          <span>❤️</span>
                          <span class="text-sm">{{ post.likes?.toLocaleString() }}</span>
                        </button>
                        <button class="flex items-center gap-1 hover:text-green-500 transition-colors">
                          <span>🔄</span>
                          <span class="text-sm">{{ post.reposts?.toLocaleString() }}</span>
                        </button>
                        <button class="flex items-center gap-1 hover:text-blue-500 transition-colors">
                          <span>💬</span>
                          <span class="text-sm">{{ post.comments?.toLocaleString() }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ========== CORPORATE LAYOUT ========== -->
            <template v-else-if="parody.site_type === 'corporate'">
              <!-- Features -->
              <div v-if="parodyData?.features?.length" class="mb-12">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
                  🚀 Enterprise-Grade Solutions
                </h2>
                <div class="grid sm:grid-cols-2 gap-6">
                  <div
                    v-for="feature in parodyData.features"
                    :key="feature.id"
                    class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow hover:shadow-lg transition-all"
                  >
                    <div class="text-4xl mb-4">{{ feature.icon }}</div>
                    <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-2">{{ feature.title }}</h3>
                    <p class="text-gray-600 dark:text-gray-300 text-sm">{{ feature.description }}</p>
                  </div>
                </div>
              </div>

              <!-- Pricing -->
              <div v-if="parodyData?.pricingTiers?.length">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
                  💰 Pricing That Makes Sense (To Us)
                </h2>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div
                    v-for="tier in parodyData.pricingTiers"
                    :key="tier.id"
                    class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg relative"
                    :class="{ 'ring-2 ring-purple-500 scale-105': tier.isPopular }"
                  >
                    <div v-if="tier.isPopular" class="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      Most Popular
                    </div>
                    <h3 class="font-bold text-xl text-gray-900 dark:text-white mb-2">{{ tier.name }}</h3>
                    <div class="text-3xl font-bold text-purple-600 mb-4">
                      {{ tier.price }}
                      <span v-if="tier.period" class="text-sm font-normal text-gray-500">{{ tier.period }}</span>
                    </div>
                    <ul class="space-y-2 mb-6">
                      <li v-for="(f, i) in tier.features" :key="i" class="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                        <span class="text-green-500">✓</span>
                        {{ f }}
                      </li>
                    </ul>
                    <button
                      class="w-full py-3 rounded-xl font-bold transition-all"
                      :class="tier.isPopular ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200'"
                      @click="triggerPopup('checkout', parodyData?.popups)"
                    >
                      {{ tier.ctaText }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Testimonials -->
              <div v-if="parodyData?.testimonials?.length" class="mt-12">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
                  ⭐ What Our "Customers" Say
                </h2>
                <div class="grid sm:grid-cols-2 gap-6">
                  <div
                    v-for="t in parodyData.testimonials"
                    :key="t.id"
                    class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow"
                  >
                    <p class="text-gray-600 dark:text-gray-300 italic mb-4">"{{ t.quote }}"</p>
                    <div class="flex items-center gap-3">
                      <img :src="t.avatar" class="w-10 h-10 rounded-full" loading="lazy" />
                      <div>
                        <p class="font-bold text-gray-900 dark:text-white text-sm">{{ t.author }}</p>
                        <p class="text-xs text-gray-500">{{ t.title }}, {{ t.company }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ========== FOOD LAYOUT ========== -->
            <template v-else-if="parody.site_type === 'food' && parodyData?.menuItems?.length">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🍔</span>
                  Today's Menu
                </h2>
                <span class="text-sm text-gray-500">Delivery: 15-90 mins (probably)</span>
              </div>

              <!-- Menu Grid -->
              <div class="grid sm:grid-cols-2 gap-4">
                <div
                  v-for="item in parodyData.menuItems.slice(0, 8)"
                  :key="item.id"
                  class="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow hover:shadow-lg transition-all cursor-pointer"
                  @click="handleAddToCart({ ...item, reviews: 0, rating: 4, category: 'Food', deliveryTime: item.prepTime } as Product)"
                >
                  <div class="relative">
                    <img :src="item.image" class="w-full h-40 object-cover" loading="lazy" />
                    <div v-if="item.badges?.length" class="absolute top-2 left-2 flex gap-1">
                      <span
                        v-for="badge in item.badges"
                        :key="badge"
                        class="bg-orange-500 text-white px-2 py-0.5 text-xs font-bold rounded"
                      >
                        {{ badge }}
                      </span>
                    </div>
                  </div>
                  <div class="p-4">
                    <div class="flex justify-between items-start">
                      <h3 class="font-bold text-gray-900 dark:text-white">{{ item.name }}</h3>
                      <span class="font-bold text-green-600">${{ item.price.toFixed(2) }}</span>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">{{ item.description }}</p>
                    <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>⏱️ {{ item.prepTime }}</span>
                      <span v-if="item.calories">🔥 {{ item.calories }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ========== ECOMMERCE LAYOUT (default) ========== -->
            <template v-else-if="parodyData?.products?.length">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🛍️</span>
                  Today's Questionable Deals
                </h2>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ parodyData.products.length }} items
                </span>
              </div>

              <div class="grid sm:grid-cols-2 gap-6">
                <ProductCard
                  v-for="(product, index) in parodyData.products.slice(0, 8)"
                  :key="product.id"
                  :product="product"
                  :index="index"
                  @add-to-cart="handleAddToCart"
                  @price-click="triggerPopup('checkout', parodyData?.popups)"
                />
              </div>
            </template>

            <!-- ========== TRAVEL LAYOUT ========== -->
            <template v-else-if="parodyData?.destinations?.length">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span>✈️</span>
                  Places You'll Regret Visiting
                </h2>
                <span class="text-sm text-gray-500">{{ parodyData.destinations.length }} traps</span>
              </div>

              <!-- Urgency Messages -->
              <div v-if="parodyData.urgencyMessages?.length" class="mb-4 space-y-2">
                <div
                  v-for="(msg, i) in parodyData.urgencyMessages.slice(0, 2)"
                  :key="i"
                  class="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 rounded-lg text-sm font-medium animate-pulse"
                >
                  ⚠️ {{ msg }}
                </div>
              </div>

              <div class="grid sm:grid-cols-2 gap-6">
                <div
                  v-for="(dest, index) in parodyData.destinations.slice(0, 6)"
                  :key="dest.id"
                  class="destination-card bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
                  :style="{ animationDelay: `${index * 100}ms` }"
                >
                  <div class="relative">
                    <img :src="dest.image" :alt="dest.name" class="w-full h-48 object-cover" loading="lazy" />
                    <div class="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      ${{ dest.averagePrice }}+
                    </div>
                  </div>
                  <div class="p-5">
                    <h3 class="font-bold text-xl text-gray-900 dark:text-white">{{ dest.name }}</h3>
                    <p class="text-gray-500 dark:text-gray-400">{{ dest.country }}</p>
                    <p class="text-gray-600 dark:text-gray-300 mt-2 italic">"{{ dest.tagline }}"</p>

                    <div class="flex items-center gap-1 mt-3">
                      <span v-for="i in 5" :key="i" class="text-lg">
                        {{ i <= dest.trapRating ? '⚠️' : '⚪' }}
                      </span>
                      <span class="text-sm text-gray-500 ml-2">Trap Rating</span>
                    </div>

                    <div v-if="dest.reasonsToAvoid?.length" class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p class="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2">Why to avoid:</p>
                      <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li v-for="reason in dest.reasonsToAvoid.slice(0, 3)" :key="reason" class="flex items-start gap-2">
                          <span class="text-red-500">✗</span>
                          {{ reason }}
                        </li>
                      </ul>
                    </div>

                    <button class="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all">
                      Book This Mistake →
                    </button>
                  </div>
                </div>
              </div>
            </template>

            <!-- ========== PLACEHOLDER ========== -->
            <div v-else class="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
              <div class="text-6xl mb-4">🎭</div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {{ parody.parody_name }}
              </h3>
              <p class="text-gray-500">Content is being generated. The jokes are marinating!</p>
            </div>
          </div>

          <!-- Sidebar (1 col) -->
          <div class="space-y-6">

            <!-- SOCIAL: Trending Topics -->
            <div v-if="parody.site_type === 'social' && parodyData?.trending?.length" class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-4">🔥 Trending for you</h3>
              <div class="space-y-3">
                <div
                  v-for="(tag, i) in parodyData.trending.slice(0, 6)"
                  :key="i"
                  class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
                >
                  <p class="font-bold text-purple-600 dark:text-purple-400">{{ tag }}</p>
                  <p class="text-xs text-gray-500">{{ Math.floor(Math.random() * 50 + 10) }}K posts</p>
                </div>
              </div>
            </div>

            <!-- SOCIAL: Suggested Profiles -->
            <div v-if="parody.site_type === 'social' && parodyData?.suggestedProfiles?.length" class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-4">Who to follow</h3>
              <div class="space-y-4">
                <div
                  v-for="profile in parodyData.suggestedProfiles.slice(0, 4)"
                  :key="profile.id"
                  class="flex items-center gap-3"
                >
                  <img :src="profile.avatar" class="w-10 h-10 rounded-full" loading="lazy" />
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-900 dark:text-white text-sm truncate">
                      {{ profile.name }}
                      <span v-if="profile.isVerified" class="text-blue-500 ml-1">✓</span>
                    </p>
                    <p class="text-xs text-gray-500 truncate">@{{ profile.handle }}</p>
                  </div>
                  <button class="px-3 py-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-xs font-bold hover:opacity-80">
                    Follow
                  </button>
                </div>
              </div>
            </div>

            <!-- Fee Calculator (for ecommerce, food, travel) -->
            <FeeCalculator
              v-if="['ecommerce', 'food', 'travel'].includes(parody.site_type || '')"
              :fees="activeFees"
              :subtotal="cartSubtotal"
              :fee-animating="feeAnimating"
              @add-fee="addFee"
            />

            <!-- Cart Summary (for ecommerce, food) -->
            <div v-if="cartItems.length > 0 && ['ecommerce', 'food'].includes(parody.site_type || '')" class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span>🛒</span>
                {{ parody.site_type === 'food' ? 'Your Order' : 'Your Cart of Regret' }}
              </h3>
              <div class="space-y-3 max-h-60 overflow-y-auto">
                <div
                  v-for="item in cartItems"
                  :key="item.product.id"
                  class="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <img :src="item.product.image" class="w-12 h-12 rounded object-cover" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ item.product.name }}
                    </p>
                    <p class="text-xs text-gray-500">Qty: {{ item.quantity }}</p>
                  </div>
                  <button
                    @click="removeFromCart(item.product.id)"
                    class="text-red-500 hover:text-red-700 p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <button
                @click="handleCheckout(parodyData?.popups)"
                class="mt-4 w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-bold hover:shadow-lg transition-all"
              >
                {{ parody.site_type === 'food' ? 'Place Order (+ Mystery Fees)' : 'Checkout (More Fees Await)' }}
              </button>
            </div>

            <!-- NEWS: Sponsored Content -->
            <div v-if="parody.site_type === 'news'" class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span class="text-yellow-500">📢</span>
                Sponsored Content
              </h3>
              <div class="space-y-4">
                <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p class="text-xs text-yellow-600 font-bold mb-1">ADVERTISEMENT</p>
                  <p class="text-sm font-bold text-gray-900 dark:text-white">10 Shocking Things About Your Mattress (Number 7 Will Haunt You)</p>
                  <p class="text-xs text-gray-500 mt-1">Sponsored by MattressMax™</p>
                </div>
                <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p class="text-xs text-yellow-600 font-bold mb-1">PROMOTED</p>
                  <p class="text-sm font-bold text-gray-900 dark:text-white">Doctors HATE This One Weird Trick</p>
                  <p class="text-xs text-gray-500 mt-1">Sponsored by TotallyLegitHealth.biz</p>
                </div>
              </div>
            </div>

            <!-- Newsletter Signup (for all) -->
            <div class="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
              <h3 class="font-bold text-lg mb-2">
                {{ parody.site_type === 'news' ? 'Subscribe Now!' : parody.site_type === 'social' ? 'Get Premium ✓' : 'Join Our Newsletter!' }}
              </h3>
              <p class="text-white/80 text-sm mb-4">
                {{ parody.site_type === 'news' ? 'Only $99/month for less ads (still ads though)' : parody.site_type === 'social' ? 'Edit your posts! Longer videos! Blue checkmark!' : 'Get 0.5% off your next regret!' }}
              </p>
              <button
                @click="triggerPopup('newsletter', parodyData?.popups)"
                class="w-full bg-white text-purple-600 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                {{ parody.site_type === 'social' ? 'Subscribe $8/mo' : 'Sign Me Up! 📧' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Reaction Bar -->
      <ReactionBar
        v-if="parody"
        :reactions="(parody as any).reactions || { dead: 0, fire: 0, savage: 0, too_real: 0 }"
        :slug="parody.slug"
        @share="shareParody"
      />

      <!-- Reviews Section -->
      <ParodyReviews
        v-if="parodyData?.reviews?.length"
        :reviews="parodyData.reviews"
      />

      <!-- Footer -->
      <ParodyFooter
        :parody-name="parody.parody_name"
        :original-url="parody.original_url"
        :trust-badges="parodyData?.trustBadges"
        :faqs="parodyData?.faqs"
        :creator-url="parody.creator_url"
        :backlink-size="parody.backlink_size"
      />
    </div>

    <!-- Popup -->
    <ParodyPopup
      :popup="activePopup"
      :visible="popupVisible"
      @close="closePopup"
      @button-click="handlePopupButton"
    />

    <!-- Share Modal -->
    <ShareModal
      v-if="parody"
      :visible="showShareModal"
      :url="shareUrl"
      :title="parody.parody_name"
      @close="showShareModal = false"
    />

    <!-- Floating Share Bar -->
    <FloatingShareBar
      v-if="parody && !loading && !error"
      :url="shareUrl"
      :title="parody.parody_name"
      :share-count="(parody as any).share_count || 0"
      @share="trackShare"
    />
  </div>
</template>

<style scoped>
.destination-card {
  animation: card-entrance 0.5s ease-out backwards;
}

@keyframes card-entrance {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.animate-glitch {
  animation: glitch 0.3s ease-in-out infinite;
}

@keyframes glitch {
  0%, 100% {
    transform: translate(0);
    filter: hue-rotate(0deg);
  }
  20% {
    transform: translate(-2px, 2px);
    filter: hue-rotate(90deg);
  }
  40% {
    transform: translate(2px, -2px);
    filter: hue-rotate(180deg);
  }
  60% {
    transform: translate(-2px, -2px);
    filter: hue-rotate(270deg);
  }
  80% {
    transform: translate(2px, 2px);
    filter: hue-rotate(360deg);
  }
}

/* Breaking news ticker animation */
.animate-marquee {
  display: inline-block;
  animation: marquee 20s linear infinite;
}

@keyframes marquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

/* ===== THEME STYLES ===== */

/* Christmas theme */
.theme-christmas :deep(.bg-gradient-to-r) {
  --tw-gradient-from: #dc2626 !important;
  --tw-gradient-to: #16a34a !important;
}

.theme-christmas :deep(.bg-purple-600) {
  background-color: #dc2626 !important;
}

.theme-christmas :deep(.text-purple-600) {
  color: #dc2626 !important;
}

.theme-christmas :deep(.ring-purple-500) {
  --tw-ring-color: #dc2626 !important;
}

/* Easter theme */
.theme-easter :deep(.bg-gradient-to-r) {
  --tw-gradient-from: #ec4899 !important;
  --tw-gradient-to: #a855f7 !important;
}

.theme-easter :deep(.bg-purple-600) {
  background-color: #ec4899 !important;
}

.theme-easter :deep(.text-purple-600) {
  color: #ec4899 !important;
}

.theme-easter :deep(.ring-purple-500) {
  --tw-ring-color: #ec4899 !important;
}

/* Sport theme */
.theme-sport :deep(.bg-gradient-to-r) {
  --tw-gradient-from: #1d4ed8 !important;
  --tw-gradient-to: #dc2626 !important;
}

.theme-sport :deep(.bg-purple-600) {
  background-color: #1d4ed8 !important;
}

.theme-sport :deep(.text-purple-600) {
  color: #1d4ed8 !important;
}

.theme-sport :deep(.ring-purple-500) {
  --tw-ring-color: #1d4ed8 !important;
}

/* Sensual theme */
.theme-sensual :deep(.bg-gradient-to-r) {
  --tw-gradient-from: #991b1b !important;
  --tw-gradient-to: #1f1f1f !important;
}

.theme-sensual :deep(.bg-purple-600) {
  background-color: #991b1b !important;
}

.theme-sensual :deep(.text-purple-600) {
  color: #991b1b !important;
}

.theme-sensual :deep(.ring-purple-500) {
  --tw-ring-color: #991b1b !important;
}

.theme-sensual :deep(.bg-pink-500) {
  background-color: #991b1b !important;
}

/* Retro theme */
.theme-retro :deep(.bg-gradient-to-r) {
  --tw-gradient-from: #ea580c !important;
  --tw-gradient-to: #854d0e !important;
}

.theme-retro :deep(.bg-purple-600) {
  background-color: #ea580c !important;
}

.theme-retro :deep(.text-purple-600) {
  color: #ea580c !important;
}

.theme-retro :deep(.ring-purple-500) {
  --tw-ring-color: #ea580c !important;
}

.theme-retro :deep(.bg-pink-500) {
  background-color: #854d0e !important;
}

/* ===== TONE STYLES ===== */

/* Negative tone - Dark, exposé-style with warning elements */
.tone-negative {
  --tone-indicator: #ef4444;
}

.tone-negative :deep(.bg-white) {
  box-shadow: 0 2px 8px var(--tone-card-shadow), inset 0 0 0 1px rgba(239, 68, 68, 0.05);
}

.tone-negative :deep(.rounded-xl) {
  position: relative;
}

.tone-negative :deep(.text-yellow-600),
.tone-negative :deep(.text-amber-600) {
  color: #dc2626 !important;
}

/* Positive tone - Bright, sparkly, suspiciously perfect */
.tone-positive {
  --tone-indicator: #22c55e;
}

.tone-positive :deep(.bg-white) {
  box-shadow: 0 2px 12px var(--tone-card-shadow), 0 0 20px rgba(34, 197, 94, 0.1);
}

.tone-positive :deep(.text-yellow-500) {
  color: #fbbf24 !important;
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
}

.tone-positive :deep(.bg-gradient-to-r) {
  filter: saturate(1.2) brightness(1.05);
}

/* Balanced tone - Muted, professional, realistic */
.tone-balanced {
  --tone-indicator: #6b7280;
}

.tone-balanced :deep(.bg-white) {
  box-shadow: 0 1px 4px var(--tone-card-shadow);
}

.tone-balanced :deep(.text-purple-600) {
  color: #4b5563 !important;
}

.tone-balanced :deep(.bg-gradient-to-r) {
  filter: saturate(0.85);
}

.tone-balanced :deep(.bg-purple-600) {
  background-color: #4b5563 !important;
}

/* Erotic tone - Sensual, mysterious, romantic */
.tone-erotic {
  --tone-indicator: #be185d;
}

.tone-erotic :deep(.bg-white) {
  box-shadow: 0 4px 16px var(--tone-card-shadow), 0 0 30px rgba(190, 24, 93, 0.08);
}

.tone-erotic :deep(.bg-gradient-to-r) {
  --tw-gradient-from: #be185d !important;
  --tw-gradient-to: #7c3aed !important;
}

.tone-erotic :deep(.bg-purple-600) {
  background-color: #be185d !important;
}

.tone-erotic :deep(.text-purple-600) {
  color: #be185d !important;
}

.tone-erotic :deep(.ring-purple-500) {
  --tw-ring-color: #be185d !important;
}

.tone-erotic :deep(button:hover) {
  transform: scale(1.02);
  transition: transform 0.2s ease;
}

/* ===== THEMED DECORATIONS ===== */

/* Christmas snowflakes */
.snowflake {
  position: absolute;
  top: -50px;
  font-size: 24px;
  opacity: 0.6;
  animation: snowfall 8s linear infinite;
  z-index: 0;
}

@keyframes snowfall {
  0% {
    transform: translateY(-50px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* Easter decorations */
.easter-egg {
  position: absolute;
  font-size: 32px;
  opacity: 0.3;
  animation: easter-float 4s ease-in-out infinite;
}

.easter-egg:nth-child(2) {
  animation-delay: 0.5s;
}

.easter-egg:nth-child(3) {
  animation-delay: 1s;
}

.easter-egg:nth-child(4) {
  animation-delay: 1.5s;
}

.easter-egg:nth-child(5) {
  animation-delay: 2s;
}

@keyframes easter-float {
  0%, 100% {
    transform: translateY(0) rotate(-5deg);
  }
  50% {
    transform: translateY(-15px) rotate(5deg);
  }
}

/* Sport theme */
.sport-stripe {
  position: absolute;
  height: 100%;
  width: 8px;
  opacity: 0.08;
}

.sport-stripe-1 {
  left: 0;
  background: repeating-linear-gradient(
    to bottom,
    #1d4ed8 0px,
    #1d4ed8 20px,
    transparent 20px,
    transparent 40px
  );
}

.sport-stripe-2 {
  right: 0;
  background: repeating-linear-gradient(
    to bottom,
    #dc2626 0px,
    #dc2626 20px,
    transparent 20px,
    transparent 40px
  );
}

.scoreboard-corner {
  position: absolute;
  top: 100px;
  right: 20px;
  background: linear-gradient(135deg, #1d4ed8, #dc2626);
  padding: 8px 16px;
  border-radius: 4px;
  transform: rotate(3deg);
  opacity: 0.15;
}

.scoreboard-text {
  font-family: 'Impact', sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: white;
  letter-spacing: 2px;
}

/* Sensual theme */
.sensual-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 40%,
    rgba(159, 18, 57, 0.08) 100%
  );
}

.sensual-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80%;
  height: 80%;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    ellipse at center,
    rgba(190, 24, 93, 0.03) 0%,
    transparent 70%
  );
  filter: blur(40px);
}

/* Retro theme */
.retro-starburst {
  position: absolute;
  font-size: 48px;
  color: #ea580c;
  opacity: 0.15;
  animation: retro-pulse 2s ease-in-out infinite;
}

.retro-starburst:nth-child(2) {
  animation-delay: 0.5s;
  color: #facc15;
}

.retro-starburst:nth-child(3) {
  animation-delay: 1s;
  color: #84cc16;
}

.retro-starburst:nth-child(4) {
  animation-delay: 1.5s;
}

@keyframes retro-pulse {
  0%, 100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.15;
  }
  50% {
    transform: scale(1.1) rotate(10deg);
    opacity: 0.25;
  }
}

.retro-dots {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #ea580c 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.03;
}

/* Theme-specific header gradients */
.theme-christmas .bg-pink-500 {
  background: linear-gradient(90deg, #dc2626 0%, #16a34a 50%, #dc2626 100%) !important;
}

.theme-easter .bg-pink-500 {
  background: linear-gradient(90deg, #f9a8d4 0%, #a5f3fc 50%, #d9f99d 100%) !important;
  color: #6b21a8 !important;
}

.theme-sport .bg-pink-500 {
  background: linear-gradient(90deg, #1d4ed8 0%, #dc2626 100%) !important;
}

.theme-sensual .bg-pink-500 {
  background: linear-gradient(90deg, #9f1239 0%, #1f1f1f 100%) !important;
}

.theme-retro .bg-pink-500 {
  background: linear-gradient(90deg, #ea580c 0%, #facc15 50%, #84cc16 100%) !important;
  color: #1f2937 !important;
}
</style>
