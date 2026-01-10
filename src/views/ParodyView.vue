<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Parody, ParodyData, ParodyConfig, Product } from '../types'
import { useParodyInteractions } from '../composables/useParodyInteractions'
import ParodyBacklink from '../components/ParodyBacklink.vue'
import ParodyHeader from '../components/parody/ParodyHeader.vue'
import ParodyPopup from '../components/parody/ParodyPopup.vue'
import ProductCard from '../components/parody/ProductCard.vue'
import ParodyReviews from '../components/parody/ParodyReviews.vue'
import FeeCalculator from '../components/parody/FeeCalculator.vue'
import ParodyFooter from '../components/parody/ParodyFooter.vue'

const route = useRoute()

const parody = ref<Parody | null>(null)
const loading = ref(true)
const error = ref('')
const isExpired = ref(false)

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

// Cart subtotal (before fees)
const cartSubtotal = computed(() =>
  cartItems.value.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
)

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
  } catch (e) {
    error.value = 'Parody not found'
    console.error(e)
  } finally {
    loading.value = false
  }
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
}

function shareParody() {
  navigator.clipboard.writeText(window.location.href)
  alert('Link copied! Now spread the chaos!')
}
</script>

<template>
  <!-- Full-page parody view -->
  <div
    class="min-h-screen transition-all duration-300"
    :class="{ 'animate-glitch': glitchMode }"
    style="background-color: var(--color-bg-secondary);"
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
      <!-- Promotional Backlink Banner -->
      <ParodyBacklink
        :size="parody.backlink_size || 'large'"
        position="banner"
      />

      <!-- Parody Notice Banner -->
      <div class="bg-pink-500 text-white text-center py-2 text-sm flex items-center justify-center gap-4 flex-wrap">
        <span>🎭 This is a parody of {{ parody.original_url }} - For entertainment only!</span>
        <button
          @click="shareParody"
          class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-medium transition-colors"
        >
          📤 Share
        </button>
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
        @logo-click="handleLogoClickEvent"
        @cart-click="cartOpen = !cartOpen"
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
      />
    </div>

    <!-- Popup -->
    <ParodyPopup
      :popup="activePopup"
      :visible="popupVisible"
      @close="closePopup"
      @button-click="handlePopupButton"
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
</style>
