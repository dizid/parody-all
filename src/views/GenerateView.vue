<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import type { Parody } from '../types'

const route = useRoute()
const router = useRouter()

const parody = ref<Parody | null>(null)
const loading = ref(true)
const error = ref('')

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
  const id = route.params.id as string

  try {
    const { data, error: fetchError } = await supabase
      .from('parodies')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    parody.value = data

    if (data.status === 'complete') {
      router.push(`/p/${data.slug}`)
    } else if (data.status === 'failed') {
      error.value = 'Generation failed. Please try again.'
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
    <div class="bg-white rounded-2xl shadow-lg p-8 text-center">
      <div v-if="loading">
        <div class="animate-spin text-4xl mb-4">⏳</div>
        <p class="text-gray-600">Loading...</p>
      </div>

      <div v-else-if="error">
        <div class="text-4xl mb-4">😢</div>
        <p class="text-red-500 mb-4">{{ error }}</p>
        <RouterLink to="/dashboard" class="text-parody-primary hover:underline">
          Back to Dashboard
        </RouterLink>
      </div>

      <div v-else-if="parody">
        <h1 class="text-2xl font-bold mb-2">Generating Your Parody</h1>
        <p class="text-gray-600 mb-8">{{ parody.original_url }}</p>

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
                  ? 'bg-parody-primary/10'
                  : 'bg-gray-100'
              ]"
            >
              {{ step.icon }}
            </div>
            <div class="text-left">
              <p
                :class="[
                  'font-medium',
                  index <= getCurrentStep() ? 'text-parody-dark' : 'text-gray-400'
                ]"
              >
                {{ step.label }}
              </p>
              <p
                v-if="index === getCurrentStep() && parody.status !== 'complete'"
                class="text-sm text-parody-primary animate-pulse"
              >
                In progress...
              </p>
            </div>
          </div>
        </div>

        <!-- Loading Animation -->
        <div v-if="parody.status !== 'complete'" class="py-4">
          <div class="flex justify-center gap-1">
            <div class="w-3 h-3 bg-parody-primary rounded-full animate-bounce" style="animation-delay: 0ms"></div>
            <div class="w-3 h-3 bg-parody-primary rounded-full animate-bounce" style="animation-delay: 150ms"></div>
            <div class="w-3 h-3 bg-parody-primary rounded-full animate-bounce" style="animation-delay: 300ms"></div>
          </div>
          <p class="text-gray-500 mt-4 text-sm">
            This usually takes 30-60 seconds. Don't close this page.
          </p>
        </div>

        <!-- Complete -->
        <div v-else class="py-4">
          <p class="text-green-600 font-semibold mb-4">Your parody is ready!</p>
          <RouterLink
            :to="`/p/${parody.slug}`"
            class="inline-block bg-parody-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-parody-primary/90 transition-colors"
          >
            View Parody →
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
