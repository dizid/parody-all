<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Parody } from '../types'

const route = useRoute()
const router = useRouter()

const parody = ref<Parody | null>(null)
const loading = ref(true)
const error = ref('')
const pollCount = ref(0)

const MAX_POLLS = 40 // 40 polls * 3 seconds = 2 minutes max wait
const STUCK_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

const steps = [
  { id: 'analyzing', label: 'Analyzing Website', icon: '🔍' },
  { id: 'generating', label: 'Generating Parody Content', icon: '🤖' },
  { id: 'complete', label: 'Complete!', icon: '✅' },
]

let pollInterval: number | null = null

onMounted(async () => {
  await fetchParody()
  startPolling()
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
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
    const response = await fetch(`/.netlify/functions/get-parody?id=${id}`)
    if (!response.ok) throw new Error('Failed to fetch parody')

    const data = await response.json()
    parody.value = data

    if (data.status === 'complete') {
      if (pollInterval) clearInterval(pollInterval)
      router.push(`/p/${data.slug}`)
    } else if (data.status === 'failed') {
      if (pollInterval) clearInterval(pollInterval)
      error.value = data.error_message || 'Generation failed. Please try again.'
    } else if (data.status === 'generating') {
      // Check if generation is stuck
      const createdAt = new Date(data.created_at).getTime()
      const now = Date.now()
      if (now - createdAt > STUCK_THRESHOLD_MS) {
        if (pollInterval) clearInterval(pollInterval)
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
  pollInterval = window.setInterval(async () => {
    pollCount.value++

    if (pollCount.value > MAX_POLLS) {
      if (pollInterval) clearInterval(pollInterval)
      error.value = 'Generation is taking longer than expected. Please check back in a few minutes or try again.'
      return
    }

    await fetchParody()
  }, 3000)
}

function getCurrentStep() {
  if (!parody.value) return 0
  const idx = steps.findIndex(s => s.id === parody.value!.status)
  return idx >= 0 ? idx : 0
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
          <p class="mt-4 text-sm" style="color: var(--color-text-secondary);">
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
