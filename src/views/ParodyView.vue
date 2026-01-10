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

      <!-- Main Content Grid -->
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="grid lg:grid-cols-3 gap-8">
          <!-- Products Section (2 cols) -->
          <div class="lg:col-span-2">
            <!-- Section Title -->
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>🛍️</span>
                {{ parody.site_type === 'travel' ? "Places You'll Regret Visiting" : "Today's Questionable Deals" }}
              </h2>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ parodyData?.products?.length || 0 }} items
              </span>
            </div>

            <!-- Products Grid -->
            <div
              v-if="parodyData?.products?.length"
              class="grid sm:grid-cols-2 gap-6"
            >
              <ProductCard
                v-for="(product, index) in parodyData.products.slice(0, 8)"
                :key="product.id"
                :product="product"
                :index="index"
                @add-to-cart="handleAddToCart"
                @price-click="triggerPopup('checkout', parodyData?.popups)"
              />
            </div>

            <!-- Destinations Grid (for travel) -->
            <div
              v-else-if="parodyData?.destinations?.length"
              class="grid sm:grid-cols-2 gap-6"
            >
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

                  <!-- Trap Rating -->
                  <div class="flex items-center gap-1 mt-3">
                    <span v-for="i in 5" :key="i" class="text-lg">
                      {{ i <= dest.trapRating ? '⚠️' : '⚪' }}
                    </span>
                    <span class="text-sm text-gray-500 ml-2">Trap Rating</span>
                  </div>

                  <!-- Reasons to Avoid -->
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

            <!-- Placeholder if no content -->
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
            <!-- Fee Calculator -->
            <FeeCalculator
              :fees="activeFees"
              :subtotal="cartSubtotal"
              :fee-animating="feeAnimating"
              @add-fee="addFee"
            />

            <!-- Cart Summary -->
            <div v-if="cartItems.length > 0" class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span>🛒</span>
                Your Cart of Regret
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
                Checkout (More Fees Await)
              </button>
            </div>

            <!-- Newsletter Signup (fake) -->
            <div class="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 text-white">
              <h3 class="font-bold text-lg mb-2">Join Our Newsletter!</h3>
              <p class="text-white/80 text-sm mb-4">Get 0.5% off your next regret!</p>
              <button
                @click="triggerPopup('newsletter', parodyData?.popups)"
                class="w-full bg-white text-purple-600 py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                Sign Me Up! 📧
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
</style>
