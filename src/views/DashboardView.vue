<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useUser, useAuth as useClerkAuth } from '@clerk/vue'
import type { Parody } from '../types'

interface Profile {
  id: string
  tier: string
  parodies_used: number
  parodies_limit: number
  stripe_customer_id?: string
}

const router = useRouter()
const route = useRoute()
const { isSignedIn } = useAuth()
const { user } = useUser()
const { getToken } = useClerkAuth()

const parodies = ref<Parody[]>([])
const profile = ref<Profile | null>(null)
const loading = ref(true)
const url = ref('')
const isGenerating = ref(false)
const isPurchasing = ref(false)
const paymentMessage = ref('')

// Computed: credits remaining
const creditsRemaining = computed(() => {
  if (!profile.value) return 0
  if (profile.value.parodies_limit === -1) return Infinity
  return Math.max(0, profile.value.parodies_limit - profile.value.parodies_used)
})

const canGenerate = computed(() => creditsRemaining.value > 0)

// Test bypass via URL param ?test=test123
const testKey = computed(() => route.query.test as string | undefined)

// Check for payment result on mount
onMounted(() => {
  const payment = route.query.payment
  if (payment === 'success') {
    paymentMessage.value = 'Payment successful! Your credits have been added.'
    // Clear the query param
    router.replace({ query: {} })
    // Refresh profile to get updated credits
    if (user.value) fetchProfile()
  } else if (payment === 'cancelled') {
    paymentMessage.value = 'Payment was cancelled.'
    router.replace({ query: {} })
  }
})

// Redirect if not logged in
watch(isSignedIn, (signedIn) => {
  if (signedIn === false) router.push('/login')
}, { immediate: true })

// Fetch data when user is available
watch(user, async (newUser) => {
  if (newUser) {
    await Promise.all([fetchParodies(), fetchProfile()])
  }
}, { immediate: true })

async function fetchParodies() {
  if (!user.value) {
    loading.value = false
    return
  }

  try {
    const response = await fetch(`/.netlify/functions/list-parodies?userId=${user.value.id}`)
    if (response.ok) {
      parodies.value = await response.json()
    }
  } catch (e) {
    console.error('Error fetching parodies:', e)
  } finally {
    loading.value = false
  }
}

async function fetchProfile() {
  if (!user.value) return

  try {
    const response = await fetch(`/.netlify/functions/get-profile?userId=${user.value.id}`)
    if (response.ok) {
      profile.value = await response.json()
    }
  } catch (e) {
    console.error('Error fetching profile:', e)
  }
}

async function purchaseCredits() {
  if (!user.value) return

  isPurchasing.value = true
  paymentMessage.value = ''

  try {
    const token = await getToken.value()

    const response = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: user.value.id,
        userEmail: user.value.primaryEmailAddress?.emailAddress,
        priceId: import.meta.env.VITE_STRIPE_PRICE_ID,
        quantity: 1,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create checkout')
    }

    const { url } = await response.json()
    window.location.href = url
  } catch (e: any) {
    console.error('Error creating checkout:', e)
    paymentMessage.value = e.message || 'Failed to start checkout. Please try again.'
  } finally {
    isPurchasing.value = false
  }
}

async function startGeneration() {
  if (!url.value || !user.value) return

  // Allow bypass with test key
  if (!canGenerate.value && !testKey.value) {
    paymentMessage.value = 'You have no credits remaining. Please purchase more to continue.'
    return
  }

  isGenerating.value = true
  paymentMessage.value = ''

  try {
    const token = await getToken.value()

    const response = await fetch('/.netlify/functions/generate-parody-background', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: url.value,
        userId: user.value.id,
        ...(testKey.value && { testKey: testKey.value }),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to start generation')
    }

    const data = await response.json()
    router.push(`/generate?id=${data.id}`)
  } catch (e: any) {
    console.error('Error starting generation:', e)
    paymentMessage.value = e.message || 'Failed to start generation. Please try again.'
  } finally {
    isGenerating.value = false
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'complete':
      return { text: 'Complete', class: 'bg-green-100 text-green-800' }
    case 'generating':
      return { text: 'Generating...', class: 'bg-yellow-100 text-yellow-800' }
    case 'analyzing':
      return { text: 'Analyzing...', class: 'bg-blue-100 text-blue-800' }
    case 'failed':
      return { text: 'Failed', class: 'bg-red-100 text-red-800' }
    default:
      return { text: status, class: 'bg-gray-100 text-gray-800' }
  }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-8">Dashboard</h1>

    <!-- Payment Message -->
    <div
      v-if="paymentMessage"
      :class="[
        'rounded-xl p-4 mb-6',
        paymentMessage.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      ]"
    >
      {{ paymentMessage }}
    </div>

    <!-- User Info -->
    <div v-if="user" class="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-6 mb-8">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <img
            v-if="user.imageUrl"
            :src="user.imageUrl"
            :alt="user.fullName || 'User'"
            class="w-12 h-12 rounded-full"
          />
          <div>
            <p class="font-semibold text-lg">{{ user.fullName || user.primaryEmailAddress?.emailAddress }}</p>
            <p class="text-white/80 text-sm">
              {{ profile?.tier === 'unlimited' ? 'Unlimited' : `${creditsRemaining} credit${creditsRemaining === 1 ? '' : 's'} remaining` }}
            </p>
          </div>
        </div>
        <button
          @click="purchaseCredits"
          :disabled="isPurchasing"
          class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {{ isPurchasing ? 'Loading...' : 'Buy Credits' }}
        </button>
      </div>
    </div>

    <!-- Create New Parody -->
    <div class="rounded-2xl shadow-lg p-6 mb-8" style="background-color: var(--color-bg-card);">
      <h2 class="text-xl font-semibold mb-4" style="color: var(--color-text-primary);">Create New Parody</h2>
      <form @submit.prevent="startGeneration" class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="url"
          type="text"
          placeholder="Enter a URL to parody (e.g., amazon.com)"
          class="flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary);"
        />
        <button
          type="submit"
          :disabled="isGenerating || !url || (!canGenerate && !testKey)"
          class="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 transition-all whitespace-nowrap"
        >
          {{ isGenerating ? 'Starting...' : (canGenerate || testKey) ? 'Generate Parody' : 'No Credits' }}
        </button>
      </form>
    </div>

    <!-- Parodies List -->
    <div class="rounded-2xl shadow-lg p-6" style="background-color: var(--color-bg-card);">
      <h2 class="text-xl font-semibold mb-4" style="color: var(--color-text-primary);">Your Parodies</h2>

      <div v-if="loading" class="text-center py-8" style="color: var(--color-text-secondary);">
        Loading...
      </div>

      <div v-else-if="parodies.length === 0" class="text-center py-8" style="color: var(--color-text-secondary);">
        <p class="text-4xl mb-4">🎭</p>
        <p>No parodies yet. Create your first one above!</p>
        <p class="text-sm mt-2">Your first parody is FREE!</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="parody in parodies"
          :key="parody.id"
          class="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-300 transition-colors"
          style="border: 1px solid var(--color-border);"
        >
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold truncate" style="color: var(--color-text-primary);">{{ parody.parody_name }}</h3>
            <a
              :href="parody.original_url.startsWith('http') ? parody.original_url : `https://${parody.original_url}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm hover:underline truncate block"
              style="color: var(--color-text-secondary);"
              @click.stop
            >
              {{ parody.original_url }}
            </a>
            <p class="text-xs mt-1" style="color: var(--color-text-secondary); opacity: 0.7;">
              {{ new Date(parody.created_at).toLocaleDateString() }}
            </p>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span
              :class="[
                'px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap',
                getStatusBadge(parody.status).class
              ]"
            >
              {{ getStatusBadge(parody.status).text }}
            </span>
            <RouterLink
              v-if="parody.status === 'complete' && parody.slug"
              :to="`/p/${parody.slug}`"
              class="text-purple-600 hover:underline whitespace-nowrap"
            >
              View →
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
