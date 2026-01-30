<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth as useClerkAuth } from '@clerk/vue'
import type { Parody } from '../types'

const route = useRoute()
const router = useRouter()
const { getToken } = useClerkAuth()

const parody = ref<Parody | null>(null)
const loading = ref(true)
const error = ref('')
const pollCount = ref(0)

// Email notification state
const elapsedSeconds = ref(0)
const showEmailCapture = computed(() => elapsedSeconds.value >= 60 && !emailSubmitted.value)
const notificationEmail = ref('')
const emailSubmitted = ref(false)
const emailSubmitting = ref(false)
const emailError = ref('')

// Exponential backoff polling to reduce server load
const INITIAL_POLL_INTERVAL = 2000  // Start at 2 seconds
const MAX_POLL_INTERVAL = 15000     // Max 15 seconds between polls
const BACKOFF_MULTIPLIER = 1.5      // Increase by 50% each time after threshold
const BACKOFF_THRESHOLD = 10        // Start backing off after 10 polls
const MAX_POLL_TIME_MS = 6 * 60 * 1000 // Stop polling after 6 minutes
const STUCK_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes before showing stuck message

const steps = [
  { id: 'analyzing', label: 'Analyzing Website', icon: '🔍' },
  { id: 'generating', label: 'Generating Parody Content', icon: '🤖' },
  { id: 'complete', label: 'Complete!', icon: '✅' },
]

let pollTimeout: number | null = null
let elapsedInterval: number | null = null
let currentPollInterval = INITIAL_POLL_INTERVAL
let pollStartTime = 0

onMounted(async () => {
  pollStartTime = Date.now()
  await fetchParody()
  startPolling()
  // Track elapsed time
  elapsedInterval = window.setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
})

onUnmounted(() => {
  if (pollTimeout) {
    clearTimeout(pollTimeout)
  }
  if (elapsedInterval) {
    clearInterval(elapsedInterval)
  }
})

async function fetchParody() {
  const id = route.query.id as string

  if (!id) {
    error.value = 'No parody ID provided'
    loading.value = false
    return
  }

  try {
    const token = await getToken.value()
    const response = await fetch(`/.netlify/functions/get-parody?id=${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    if (!response.ok) throw new Error('Failed to fetch parody')

    const data = await response.json()
    parody.value = data

    if (data.status === 'complete') {
      if (pollTimeout) clearTimeout(pollTimeout)
      router.push(`/p/${data.slug}`)
    } else if (data.status === 'failed') {
      if (pollTimeout) clearTimeout(pollTimeout)
      error.value = data.error_message || 'Generation failed. Please try again.'
    } else if (data.status === 'generating') {
      // Check if generation is stuck
      const createdAt = new Date(data.created_at).getTime()
      const now = Date.now()
      if (now - createdAt > STUCK_THRESHOLD_MS) {
        if (pollTimeout) clearTimeout(pollTimeout)
        error.value = 'Generation appears to be stuck. Please try creating a new parody.'
      }
    }
  } catch (e) {
    error.value = 'Failed to load parody status'
    console.error(e)
  } finally {
    loading.value = false
  }
}

function startPolling() {
  const poll = async () => {
    pollCount.value++

    // Check if we've exceeded max poll time
    if (Date.now() - pollStartTime > MAX_POLL_TIME_MS) {
      error.value = 'Generation is taking longer than expected. Please check back in a few minutes or try again.'
      return
    }

    await fetchParody()

    // If still in progress, schedule next poll
    if (parody.value?.status !== 'complete' && parody.value?.status !== 'failed' && !error.value) {
      // Apply exponential backoff after threshold
      if (pollCount.value > BACKOFF_THRESHOLD) {
        currentPollInterval = Math.min(
          currentPollInterval * BACKOFF_MULTIPLIER,
          MAX_POLL_INTERVAL
        )
      }

      pollTimeout = window.setTimeout(poll, currentPollInterval)
    }
  }

  // Start first poll after initial interval
  pollTimeout = window.setTimeout(poll, currentPollInterval)
}

function getCurrentStep() {
  if (!parody.value) return 0
  const idx = steps.findIndex(s => s.id === parody.value!.status)
  return idx >= 0 ? idx : 0
}

async function submitEmail() {
  if (!notificationEmail.value || !parody.value) return

  emailSubmitting.value = true
  emailError.value = ''

  try {
    const response = await fetch('/.netlify/functions/save-notification-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parodyId: parody.value.id,
        email: notificationEmail.value,
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to save email')
    }

    emailSubmitted.value = true
  } catch (e: any) {
    emailError.value = e.message || 'Failed to save email. Please try again.'
  } finally {
    emailSubmitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-16">
    <div class="rounded-2xl shadow-lg p-8 text-center" style="background-color: var(--color-bg-card);">
      <div v-if="loading">
        <div class="animate-spin text-4xl mb-4">⏳</div>
        <p style="color: var(--color-text-secondary);">Loading...</p>
      </div>

      <div v-else-if="error">
        <div class="text-4xl mb-4">😢</div>
        <p class="text-red-500 mb-4">{{ error }}</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <RouterLink
            to="/dashboard"
            class="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            Try Again
          </RouterLink>
          <RouterLink to="/dashboard" class="text-purple-600 hover:underline py-3">
            Back to Dashboard
          </RouterLink>
        </div>
      </div>

      <div v-else-if="parody">
        <h1 class="text-2xl font-bold mb-2" style="color: var(--color-text-primary);">Generating Your Parody</h1>
        <p class="mb-8" style="color: var(--color-text-secondary);">{{ parody.original_url }}</p>

        <!-- Progress Steps -->
        <div class="space-y-6 mb-8">
          <div
            v-for="(step, index) in steps"
            :key="step.id"
            class="flex items-center gap-4"
          >
            <div
              :class="[
                'w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all',
                index <= getCurrentStep()
                  ? 'bg-purple-500/20'
                  : 'bg-gray-500/20'
              ]"
            >
              {{ step.icon }}
            </div>
            <div class="text-left">
              <p
                class="font-medium"
                :style="{ color: index <= getCurrentStep() ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }"
              >
                {{ step.label }}
              </p>
              <p
                v-if="index === getCurrentStep() && parody.status !== 'complete'"
                class="text-sm text-purple-600 animate-pulse"
              >
                In progress...
              </p>
            </div>
          </div>
        </div>

        <!-- Loading Animation -->
        <div v-if="parody.status !== 'complete'" class="py-4">
          <div class="flex justify-center gap-1">
            <div class="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>

          <!-- Email capture after 60 seconds -->
          <div v-if="showEmailCapture" class="mt-6 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20">
            <p class="text-purple-700 dark:text-purple-300 font-medium mb-2">Taking longer than expected...</p>
            <p class="text-sm mb-4" style="color: var(--color-text-secondary);">
              Enter your email and we'll notify you when it's ready. You can close this page.
            </p>
            <form @submit.prevent="submitEmail" class="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <input
                v-model="notificationEmail"
                type="email"
                placeholder="your@email.com"
                required
                class="flex-1 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                style="background-color: var(--color-bg-secondary); border: 1px solid var(--color-border); color: var(--color-text-primary);"
              />
              <button
                type="submit"
                :disabled="emailSubmitting || !notificationEmail"
                class="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 transition-all whitespace-nowrap"
              >
                {{ emailSubmitting ? 'Saving...' : 'Notify Me' }}
              </button>
            </form>
            <p v-if="emailError" class="text-red-500 text-sm mt-2">{{ emailError }}</p>
          </div>

          <!-- Email submitted confirmation -->
          <div v-else-if="emailSubmitted" class="mt-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <p class="text-green-700 dark:text-green-300 font-medium">You're all set!</p>
            <p class="text-sm mt-1" style="color: var(--color-text-secondary);">
              We'll email you at <strong>{{ notificationEmail }}</strong> when your parody is ready.
              <br />You can safely close this page.
            </p>
            <RouterLink
              to="/dashboard"
              class="inline-block mt-4 text-purple-600 hover:underline"
            >
              Back to Dashboard
            </RouterLink>
          </div>

          <!-- Regular waiting message (first 60 seconds) -->
          <p v-else class="mt-4 text-sm" style="color: var(--color-text-secondary);">
            This usually takes 30-60 seconds. Don't close this page.
          </p>
        </div>

        <!-- Complete -->
        <div v-else class="py-4">
          <p class="text-green-600 font-semibold mb-4">Your parody is ready!</p>
          <RouterLink
            :to="`/p/${parody.slug}`"
            class="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            View Parody →
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
