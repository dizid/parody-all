<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Parody, ParodyData, ParodyConfig } from '../types'
import ParodyBacklink from '../components/ParodyBacklink.vue'

const route = useRoute()

const parody = ref<Parody | null>(null)
const loading = ref(true)
const error = ref('')
const isExpired = ref(false)

const parodyData = computed<ParodyData | null>(() => {
  if (!parody.value?.parody_data) return null
  return parody.value.parody_data as ParodyData
})

const parodyConfig = computed<ParodyConfig | null>(() => {
  if (!parody.value?.parody_config) return null
  return parody.value.parody_config as ParodyConfig
})

onMounted(async () => {
  await fetchParody()
})

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
  } catch (e) {
    error.value = 'Parody not found'
    console.error(e)
  } finally {
    loading.value = false
  }
}

function shareParody() {
  navigator.clipboard.writeText(window.location.href)
  alert('Link copied to clipboard!')
}
</script>

<template>
  <!-- Full-page parody view without the main site header -->
  <div class="min-h-screen bg-gray-100">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="animate-spin text-4xl mb-4">🎭</div>
        <p class="text-gray-600">Loading parody...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center min-h-screen">
      <div class="text-center max-w-md mx-auto px-4">
        <div class="text-4xl mb-4">{{ isExpired ? '⏰' : '😢' }}</div>
        <h2 v-if="isExpired" class="text-xl font-bold mb-2">Parody Expired</h2>
        <p class="text-red-500 mb-6">{{ error }}</p>
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
    <div v-else-if="parody">
      <!-- Promotional Backlink Banner -->
      <ParodyBacklink
        :size="parody.backlink_size || 'large'"
        position="banner"
      />

      <!-- Parody Banner -->
      <div class="bg-parody-accent text-white text-center py-2 text-sm">
        🎭 This is a parody of {{ parody.original_url }} - For entertainment only!
        <button @click="shareParody" class="ml-4 underline hover:no-underline">
          Share
        </button>
      </div>

      <!-- Parody Header -->
      <header
        class="bg-gradient-to-r from-parody-primary to-parody-secondary text-white py-4"
        :style="parodyConfig ? { background: `linear-gradient(to right, ${parodyConfig.primaryColor}, ${parodyConfig.secondaryColor})` } : {}"
      >
        <div class="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <h1 class="text-2xl font-bold">{{ parody.parody_name }}</h1>
          <p v-if="parodyConfig?.tagline" class="text-white/80">{{ parodyConfig.tagline }}</p>
        </div>
      </header>

      <!-- E-Commerce Layout -->
      <div v-if="parody.site_type === 'ecommerce'" class="max-w-7xl mx-auto px-4 py-8">
        <!-- Products Grid -->
        <div v-if="parodyData?.products?.length" class="mb-12">
          <h2 class="text-2xl font-bold mb-6">Today's Absurd Deals</h2>
          <div class="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div
              v-for="product in parodyData.products.slice(0, 8)"
              :key="product.id"
              class="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <img :src="product.image" :alt="product.name" class="w-full h-48 object-cover bg-gray-200" />
              <div class="p-4">
                <h3 class="font-semibold text-sm line-clamp-2 mb-2">{{ product.name }}</h3>
                <div class="flex items-baseline gap-2">
                  <span class="text-lg font-bold text-red-600">${{ product.price.toFixed(2) }}</span>
                  <span v-if="product.originalPrice" class="text-sm text-gray-400 line-through">
                    ${{ product.originalPrice.toFixed(2) }}
                  </span>
                </div>
                <div v-if="product.badges?.length" class="flex flex-wrap gap-1 mt-2">
                  <span
                    v-for="badge in product.badges.slice(0, 2)"
                    :key="badge"
                    class="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded"
                  >
                    {{ badge }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-2">{{ product.deliveryTime }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Fees Section -->
        <div v-if="parodyData?.fees?.length" class="bg-white rounded-lg p-6 mb-12">
          <h2 class="text-xl font-bold mb-4">Totally Reasonable Fees</h2>
          <div class="space-y-3">
            <div v-for="fee in parodyData.fees" :key="fee.name" class="flex justify-between items-start border-b pb-3">
              <div>
                <p class="font-medium">{{ fee.name }}</p>
                <p class="text-sm text-gray-500">{{ fee.reason }}</p>
              </div>
              <span class="font-bold text-red-600">${{ fee.amount.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Travel Layout -->
      <div v-else-if="parody.site_type === 'travel'" class="max-w-7xl mx-auto px-4 py-8">
        <!-- Destinations -->
        <div v-if="parodyData?.destinations?.length" class="mb-12">
          <h2 class="text-2xl font-bold mb-6">Places NOT to Visit</h2>
          <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="dest in parodyData.destinations.slice(0, 6)"
              :key="dest.id"
              class="bg-white rounded-lg shadow-sm overflow-hidden"
            >
              <img :src="dest.image" :alt="dest.name" class="w-full h-48 object-cover bg-gray-200" />
              <div class="p-4">
                <h3 class="font-bold text-lg">{{ dest.name }}</h3>
                <p class="text-sm text-gray-500">{{ dest.country }}</p>
                <p class="text-sm text-gray-600 mt-2 italic">"{{ dest.tagline }}"</p>
                <div class="flex items-center gap-1 mt-2">
                  <span v-for="i in 5" :key="i" class="text-lg">
                    {{ i <= dest.trapRating ? '⚠️' : '⚪' }}
                  </span>
                  <span class="text-sm text-gray-500 ml-2">Trap Rating</span>
                </div>
                <div v-if="dest.reasonsToAvoid?.length" class="mt-3">
                  <p class="text-xs font-semibold text-red-600 uppercase">Why to avoid:</p>
                  <ul class="text-xs text-gray-600 mt-1 space-y-1">
                    <li v-for="reason in dest.reasonsToAvoid.slice(0, 3)" :key="reason">• {{ reason }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Generic Layout -->
      <div v-else class="max-w-7xl mx-auto px-4 py-8">
        <div class="bg-white rounded-lg p-8 text-center">
          <p class="text-4xl mb-4">🎭</p>
          <h2 class="text-2xl font-bold mb-4">{{ parody.parody_name }}</h2>
          <p class="text-gray-600">
            This parody of {{ parody.original_url }} is being generated.
            Check back soon!
          </p>
        </div>
      </div>

      <!-- Footer -->
      <footer class="bg-gray-800 text-white py-8 mt-12">
        <div class="max-w-7xl mx-auto px-4 text-center">
          <p class="text-lg">🎭 {{ parody.parody_name }}</p>
          <p class="text-gray-400 text-sm mt-2">
            A parody of {{ parody.original_url }} - This is satire, not real!
          </p>
          <p class="text-gray-500 text-xs mt-4">
            Generated by <a href="/" class="underline">Parody Everything</a>
          </p>
        </div>
      </footer>
    </div>
  </div>
</template>
