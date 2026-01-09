<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { supabase } from '../lib/supabase'
import type { Parody } from '../types'

const router = useRouter()
const { user } = useAuth()

const parodies = ref<Parody[]>([])
const loading = ref(true)
const url = ref('')
const isGenerating = ref(false)

// Redirect if not logged in
if (!user.value) {
  router.push('/login')
}

onMounted(async () => {
  await fetchParodies()
})

async function fetchParodies() {
  if (!user.value) return

  try {
    const { data, error } = await supabase
      .from('parodies')
      .select('*')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    parodies.value = data || []
  } catch (e) {
    console.error('Error fetching parodies:', e)
  } finally {
    loading.value = false
  }
}

async function startGeneration() {
  if (!url.value || !user.value) return

  isGenerating.value = true

  try {
    // Create a new parody record
    const slug = `parody-${Date.now()}`
    const { data, error } = await supabase
      .from('parodies')
      .insert({
        user_id: user.value.id,
        slug,
        original_url: url.value,
        site_type: 'ecommerce', // Will be detected by AI
        parody_name: 'Generating...',
        status: 'analyzing',
      })
      .select()
      .single()

    if (error) throw error

    // Navigate to generation progress page
    router.push(`/generate/${data.id}`)
  } catch (e) {
    console.error('Error starting generation:', e)
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

    <!-- Create New Parody -->
    <div class="bg-white rounded-2xl shadow-lg p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Create New Parody</h2>
      <form @submit.prevent="startGeneration" class="flex gap-4">
        <input
          v-model="url"
          type="text"
          placeholder="Enter a URL to parody (e.g., amazon.com)"
          class="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-parody-primary"
        />
        <button
          type="submit"
          :disabled="isGenerating || !url"
          class="bg-parody-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-parody-primary/90 disabled:opacity-50"
        >
          {{ isGenerating ? 'Starting...' : 'Generate ($2.50)' }}
        </button>
      </form>
    </div>

    <!-- Parodies List -->
    <div class="bg-white rounded-2xl shadow-lg p-6">
      <h2 class="text-xl font-semibold mb-4">Your Parodies</h2>

      <div v-if="loading" class="text-center py-8 text-gray-500">
        Loading...
      </div>

      <div v-else-if="parodies.length === 0" class="text-center py-8 text-gray-500">
        <p class="text-4xl mb-4">🎭</p>
        <p>No parodies yet. Create your first one above!</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="parody in parodies"
          :key="parody.id"
          class="border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:border-parody-primary/30 transition-colors"
        >
          <div>
            <h3 class="font-semibold">{{ parody.parody_name }}</h3>
            <p class="text-sm text-gray-500">{{ parody.original_url }}</p>
            <p class="text-xs text-gray-400 mt-1">
              {{ new Date(parody.created_at).toLocaleDateString() }}
            </p>
          </div>
          <div class="flex items-center gap-4">
            <span
              :class="[
                'px-3 py-1 rounded-full text-sm font-medium',
                getStatusBadge(parody.status).class
              ]"
            >
              {{ getStatusBadge(parody.status).text }}
            </span>
            <RouterLink
              v-if="parody.status === 'complete'"
              :to="`/p/${parody.slug}`"
              class="text-parody-primary hover:underline"
            >
              View →
            </RouterLink>
            <RouterLink
              v-else-if="parody.status === 'generating' || parody.status === 'analyzing'"
              :to="`/generate/${parody.id}`"
              class="text-parody-primary hover:underline"
            >
              Progress →
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Billing Section -->
    <div class="bg-white rounded-2xl shadow-lg p-6 mt-8">
      <h2 class="text-xl font-semibold mb-4">Billing</h2>
      <p class="text-gray-600 mb-4">
        You're on usage-based billing. Each parody costs $2.50.
      </p>
      <p class="text-sm text-gray-500">
        Parodies generated: {{ parodies.filter(p => p.status === 'complete').length }}
      </p>
    </div>
  </div>
</template>
