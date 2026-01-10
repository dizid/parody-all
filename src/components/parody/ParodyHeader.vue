<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ParodyConfig, Announcement } from '../../types'

const props = defineProps<{
  parodyName: string
  config: ParodyConfig
  heroTagline?: string
  heroSubtitle?: string
  announcements?: Announcement[]
  cartItemCount: number
  logoClickCount: number
}>()

const emit = defineEmits<{
  logoClick: []
  cartClick: []
  searchSubmit: [query: string]
}>()

const searchQuery = ref('')
const showSearch = ref(false)
const currentAnnouncementIndex = ref(0)

// Rotate announcements
const currentAnnouncement = computed(() => {
  if (!props.announcements?.length) return null
  return props.announcements[currentAnnouncementIndex.value % props.announcements.length]
})

// Auto-rotate announcements
setInterval(() => {
  if (props.announcements?.length) {
    currentAnnouncementIndex.value++
  }
}, 5000)

// Fake search suggestions
const searchSuggestions = [
  "Things you don't need",
  "Regrettable purchases",
  "How to get a refund",
  "Where is my order",
  "Why is this so expensive",
  "Is this a scam",
]

const fakeSuggestion = computed(() => {
  if (!searchQuery.value) return ''
  return searchSuggestions[Math.floor(Math.random() * searchSuggestions.length)]
})

function handleSearch() {
  emit('searchSubmit', searchQuery.value)
  searchQuery.value = ''
}

function handleBlur() {
  setTimeout(() => showSearch.value = false, 200)
}
</script>

<template>
  <header class="relative">
    <!-- Announcement Banner -->
    <Transition name="slide" mode="out-in">
      <div
        v-if="currentAnnouncement"
        :key="currentAnnouncement.id"
        :class="[
          'py-2 px-4 text-center text-sm font-medium',
          currentAnnouncement.type === 'warning' ? 'bg-yellow-400 text-yellow-900' :
          currentAnnouncement.type === 'sale' ? 'bg-red-500 text-white' :
          currentAnnouncement.type === 'urgent' ? 'bg-orange-500 text-white animate-pulse' :
          'bg-blue-500 text-white'
        ]"
      >
        <span class="mr-2">{{ currentAnnouncement.icon }}</span>
        {{ currentAnnouncement.text }}
      </div>
    </Transition>

    <!-- Main Header -->
    <div
      class="py-6 px-4"
      :style="{
        background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.secondaryColor} 100%)`
      }"
    >
      <div class="max-w-7xl mx-auto">
        <!-- Top bar with logo and cart -->
        <div class="flex items-center justify-between mb-6">
          <!-- Logo -->
          <div
            class="flex items-center gap-3 cursor-pointer select-none group"
            @click="emit('logoClick')"
          >
            <div class="text-4xl transform group-hover:scale-110 transition-transform duration-200">
              🎭
            </div>
            <h1 class="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
              {{ parodyName }}
            </h1>
            <span
              v-if="logoClickCount > 0"
              class="text-xs bg-white/20 px-2 py-1 rounded-full text-white/80"
            >
              {{ 5 - logoClickCount }} more...
            </span>
          </div>

          <!-- Cart button -->
          <button
            @click="emit('cartClick')"
            class="relative bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
          >
            <span class="text-xl">🛒</span>
            <span class="hidden sm:inline">Cart</span>
            <span
              v-if="cartItemCount > 0"
              class="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold animate-bounce"
            >
              {{ cartItemCount > 99 ? '99+' : cartItemCount }}
            </span>
          </button>
        </div>

        <!-- Search bar -->
        <div class="relative max-w-2xl mx-auto">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search for things you probably don't need..."
              class="w-full px-5 py-3 pr-12 rounded-xl bg-white/95 text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-white/50 shadow-lg"
              @focus="showSearch = true"
              @blur="handleBlur"
              @keyup.enter="handleSearch"
            />
            <button
              @click="handleSearch"
              class="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-2 rounded-lg hover:shadow-lg transition-all"
            >
              🔍
            </button>
          </div>

          <!-- Fake autocomplete -->
          <Transition name="fade">
            <div
              v-if="showSearch && searchQuery.length > 0"
              class="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl overflow-hidden z-10"
            >
              <div class="p-3 hover:bg-gray-100 cursor-pointer text-gray-600">
                <span class="text-gray-400">🔍</span>
                {{ searchQuery }} <span class="text-gray-400 italic">- {{ fakeSuggestion }}</span>
              </div>
              <div class="p-3 hover:bg-gray-100 cursor-pointer text-gray-600">
                <span class="text-gray-400">🔥</span>
                "{{ searchQuery }}" is trending among regretful buyers
              </div>
            </div>
          </Transition>
        </div>

        <!-- Hero text -->
        <div class="text-center mt-8 mb-4">
          <h2
            v-if="heroTagline"
            class="text-3xl md:text-5xl font-bold text-white drop-shadow-lg mb-3 leading-tight"
          >
            {{ heroTagline }}
          </h2>
          <p
            v-if="heroSubtitle"
            class="text-lg md:text-xl text-white/90"
          >
            {{ heroSubtitle }}
          </p>
          <p
            v-else-if="config.tagline"
            class="text-lg md:text-xl text-white/90"
          >
            {{ config.tagline }}
          </p>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
