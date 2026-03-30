<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useUser, useAuth as useClerkAuth } from '@clerk/vue'
import { PRICING_TIERS, type Parody } from '../types'

interface Profile {
  id: string
  tier: string
  parodies_used: number
  parodies_limit: number
  stripe_customer_id?: string
  creator_url?: string | null
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

// Creator URL settings
const creatorUrl = ref('')
const isSavingUrl = ref(false)
const urlSaveMessage = ref('')

// Check if user can set custom URL (creator or pro tier)
const canSetCreatorUrl = computed(() => {
  return profile.value && ['creator', 'pro'].includes(profile.value.tier)
})

// Computed: credits remaining
const creditsRemaining = computed(() => {
  if (!profile.value) return 0
  if (profile.value.parodies_limit === -1) return Infinity
  return Math.max(0, profile.value.parodies_limit - profile.value.parodies_used)
})

const canGenerate = computed(() => creditsRemaining.value > 0)

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
    const token = await getToken.value()
    const response = await fetch('/.netlify/functions/list-parodies', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
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
    const token = await getToken.value()
    const response = await fetch('/.netlify/functions/get-profile', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    if (response.ok) {
      profile.value = await response.json()
      creatorUrl.value = profile.value?.creator_url || ''
    }
  } catch (e) {
    console.error('Error fetching profile:', e)
  }
}

async function saveCreatorUrl() {
  if (!user.value || !canSetCreatorUrl.value) return

  isSavingUrl.value = true
  urlSaveMessage.value = ''

  try {
    const token = await getToken.value()
    const response = await fetch('/.netlify/functions/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        creatorUrl: creatorUrl.value || null,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save')
    }

    // Update local profile
    if (profile.value) {
      profile.value.creator_url = creatorUrl.value || null
    }
    urlSaveMessage.value = 'URL saved! New parodies will use this link.'
    setTimeout(() => urlSaveMessage.value = '', 3000)
  } catch (e: any) {
    urlSaveMessage.value = e.message || 'Failed to save URL. Please try again.'
  } finally {
    isSavingUrl.value = false
  }
}

async function purchaseCredits(tier: 'single' | 'creator' | 'pro' = 'single') {
  if (!user.value) return

  isPurchasing.value = true
  paymentMessage.value = ''

  // Map tier to correct Stripe price ID
  const priceIds: Record<string, string> = {
    single: import.meta.env.VITE_STRIPE_SINGLE_PRICE_ID || import.meta.env.VITE_STRIPE_PRICE_ID,
    creator: import.meta.env.VITE_STRIPE_CREATOR_PRICE_ID,
    pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
  }
  const priceId = priceIds[tier]

  if (!priceId) {
    paymentMessage.value = `Price not configured for ${tier} tier. Please contact support.`
    isPurchasing.value = false
    return
  }

  try {
    const token = await getToken.value()

    const response = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userEmail: user.value.primaryEmailAddress?.emailAddress,
        priceId,
        tier,
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

  if (!canGenerate.value) {
    paymentMessage.value = 'You have no credits remaining. Please purchase more to continue.'
    return
  }

  isGenerating.value = true
  paymentMessage.value = ''

  try {
    const token = await getToken.value()

    if (!token) {
      router.push('/login')
      return
    }

    const response = await fetch('/.netlify/functions/generate-parody', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: url.value,
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
              <span v-if="profile?.tier === 'pro'">Pro Plan • {{ creditsRemaining }} credits this month</span>
              <span v-else-if="profile?.tier === 'creator'">Creator Plan • {{ creditsRemaining }} credits this month</span>
              <span v-else>{{ creditsRemaining }} credit{{ creditsRemaining === 1 ? '' : 's' }} remaining</span>
            </p>
          </div>
        </div>
        <button
          @click="purchaseCredits('single')"
          :disabled="isPurchasing"
          class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {{ isPurchasing ? 'Loading...' : (profile?.tier === 'none' || creditsRemaining === 0 ? 'Get Credits' : 'Buy More') }}
        </button>
      </div>
    </div>

    <!-- Creator URL Settings (for Creator/Pro tiers) -->
    <div v-if="canSetCreatorUrl" class="rounded-2xl shadow-lg p-6 mb-8" style="background-color: var(--color-bg-card);">
      <h2 class="text-xl font-semibold mb-2" style="color: var(--color-text-primary);">
        Custom Backlink URL
      </h2>
      <p class="text-sm mb-4" style="color: var(--color-text-secondary);">
        Your parodies will link back to this URL in the header and footer
      </p>

      <div class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="creatorUrl"
          type="url"
          placeholder="https://yoursite.com"
          class="flex-1 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
          style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary);"
        />
        <button
          @click="saveCreatorUrl"
          :disabled="isSavingUrl"
          class="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold disabled:opacity-50 transition-colors"
        >
          {{ isSavingUrl ? 'Saving...' : 'Save URL' }}
        </button>
      </div>

      <p v-if="urlSaveMessage" class="text-sm mt-2" :class="urlSaveMessage.includes('saved') ? 'text-green-600' : 'text-red-500'">
        {{ urlSaveMessage }}
      </p>

      <p class="text-xs mt-3" style="color: var(--color-text-secondary);">
        Leave empty to use default ParodyHumor.lol backlinks
      </p>
    </div>

    <!-- No Credits Paywall -->
    <div v-if="profile && creditsRemaining === 0" class="rounded-2xl shadow-lg p-8 mb-8 text-center" style="background-color: var(--color-bg-card); border: 2px solid var(--color-border);">
      <div class="text-5xl mb-4">💳</div>
      <h2 class="text-2xl font-bold mb-2" style="color: var(--color-text-primary);">Get Credits to Generate Parodies</h2>
      <p class="mb-6" style="color: var(--color-text-secondary);">Choose a plan that works for you</p>

      <div class="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <!-- Single -->
        <div class="rounded-xl p-4 border" style="border-color: var(--color-border);">
          <h3 class="font-bold" style="color: var(--color-text-primary);">{{ PRICING_TIERS.single.name }}</h3>
          <p class="text-2xl font-black text-purple-600">${{ PRICING_TIERS.single.price }}</p>
          <p class="text-sm mb-3" style="color: var(--color-text-secondary);">one-time</p>
          <button
            @click="purchaseCredits('single')"
            class="w-full bg-purple-100 text-purple-700 py-2 rounded-lg font-medium hover:bg-purple-200 transition-colors"
          >
            Buy Now
          </button>
        </div>

        <!-- Creator (Highlighted) -->
        <div class="rounded-xl p-4 border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50">
          <div class="text-xs font-bold text-yellow-600 mb-1">BEST VALUE</div>
          <h3 class="font-bold" style="color: var(--color-text-primary);">{{ PRICING_TIERS.creator.name }}</h3>
          <p class="text-2xl font-black text-purple-600">${{ PRICING_TIERS.creator.price }}<span class="text-sm font-normal">/mo</span></p>
          <p class="text-sm mb-3" style="color: var(--color-text-secondary);">10 parodies/month</p>
          <button
            @click="purchaseCredits('creator')"
            class="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 py-2 rounded-lg font-bold hover:shadow-lg transition-all"
          >
            Subscribe
          </button>
        </div>

        <!-- Pro -->
        <div class="rounded-xl p-4 border" style="border-color: var(--color-border);">
          <h3 class="font-bold" style="color: var(--color-text-primary);">{{ PRICING_TIERS.pro.name }}</h3>
          <p class="text-2xl font-black text-purple-600">${{ PRICING_TIERS.pro.price }}<span class="text-sm font-normal">/mo</span></p>
          <p class="text-sm mb-3" style="color: var(--color-text-secondary);">Unlimited parodies</p>
          <button
            @click="purchaseCredits('pro')"
            class="w-full bg-purple-100 text-purple-700 py-2 rounded-lg font-medium hover:bg-purple-200 transition-colors"
          >
            Subscribe
          </button>
        </div>
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
          :disabled="isGenerating || !url || !canGenerate"
          class="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 transition-all whitespace-nowrap"
        >
          {{ isGenerating ? 'Starting...' : canGenerate ? 'Generate Parody' : 'No Credits' }}
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
        <p v-if="creditsRemaining > 0" class="text-sm mt-2">You have {{ creditsRemaining }} credit{{ creditsRemaining === 1 ? '' : 's' }} ready to use</p>
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
            <div class="flex items-center gap-3 mt-1">
              <p class="text-xs" style="color: var(--color-text-secondary); opacity: 0.7;">
                {{ new Date(parody.created_at).toLocaleDateString() }}
              </p>
              <span v-if="parody.tone && !['standard', 'negative', 'positive', 'balanced'].includes(parody.tone)" class="text-xs px-2 py-0.5 rounded-full"
                :class="parody.tone === 'dark' ? 'bg-gray-800 text-white' : 'bg-pink-100 text-pink-700'"
              >
                {{ parody.tone === 'erotic' ? '🔥 Sexy' : parody.tone === 'dark' ? '💀 Dark' : parody.tone }}
              </span>
            </div>
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
