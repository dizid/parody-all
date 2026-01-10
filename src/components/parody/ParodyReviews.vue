<script setup lang="ts">
import { ref } from 'vue'
import type { Review } from '../../types'

defineProps<{
  reviews: Review[]
}>()

const helpfulClicked = ref<Set<string>>(new Set())
const notHelpfulClicked = ref<Set<string>>(new Set())

function markHelpful(reviewId: string) {
  helpfulClicked.value.add(reviewId)
}

function markNotHelpful(reviewId: string) {
  notHelpfulClicked.value.add(reviewId)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function handleLoadMore() {
  alert('Just kidding, these are all the reviews we made up!')
}
</script>

<template>
  <section class="py-12 px-4 bg-gray-50 dark:bg-gray-900">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center gap-3">
        <span>⭐</span>
        Customer Reviews
        <span class="text-sm font-normal text-gray-500 dark:text-gray-400">
          (Definitely Real)
        </span>
      </h2>

      <div class="space-y-6">
        <div
          v-for="(review, index) in reviews"
          :key="review.id"
          class="review-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow"
          :style="{ animationDelay: `${index * 100}ms` }"
        >
          <!-- Header -->
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <!-- Avatar -->
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg">
                {{ review.author.charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-gray-900 dark:text-white">
                    {{ review.author }}
                  </span>
                  <span
                    v-if="review.verified"
                    class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                  >
                    <span>✓</span> Verified Purchase
                  </span>
                </div>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ formatDate(review.date) }}
                </span>
              </div>
            </div>

            <!-- Rating -->
            <div class="flex flex-col items-end">
              <div class="flex">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="text-lg"
                >
                  {{ i <= review.rating ? '⭐' : '☆' }}
                </span>
              </div>
              <span
                v-if="review.rating === 5"
                class="text-xs text-gray-400 italic mt-1"
              >
                Suspiciously positive
              </span>
            </div>
          </div>

          <!-- Review text -->
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
            {{ review.text }}
          </p>

          <!-- Helpful buttons -->
          <div class="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <span class="text-sm text-gray-500 dark:text-gray-400">
              Was this review helpful?
            </span>
            <button
              @click="markHelpful(review.id)"
              :class="[
                'flex items-center gap-1 text-sm px-3 py-1 rounded-full transition-all',
                helpfulClicked.has(review.id)
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/50'
              ]"
            >
              <span>👍</span>
              Yes ({{ (review.helpful || 0) + (helpfulClicked.has(review.id) ? 1 : 0) }})
            </button>
            <button
              @click="markNotHelpful(review.id)"
              :class="[
                'flex items-center gap-1 text-sm px-3 py-1 rounded-full transition-all',
                notHelpfulClicked.has(review.id)
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/50'
              ]"
            >
              <span>👎</span>
              No ({{ (review.notHelpful || 0) + (notHelpfulClicked.has(review.id) ? 1 : 0) }})
            </button>
          </div>
        </div>
      </div>

      <!-- Load more (fake) -->
      <div class="text-center mt-8">
        <button
          class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-8 py-3 rounded-xl font-semibold hover:border-purple-500 hover:text-purple-600 transition-all"
          @click="handleLoadMore"
        >
          Load More Reviews
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.review-card {
  animation: review-entrance 0.4s ease-out backwards;
}

@keyframes review-entrance {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
