<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Product } from '../../types'

const props = defineProps<{
  product: Product
  index: number
}>()

const emit = defineEmits<{
  addToCart: [product: Product]
  priceClick: []
}>()

const isHovered = ref(false)
const isAdding = ref(false)

// Staggered animation delay
const animationDelay = computed(() => `${props.index * 100}ms`)

async function handleAddToCart() {
  isAdding.value = true
  await new Promise(resolve => setTimeout(resolve, 300))
  emit('addToCart', props.product)
  isAdding.value = false
}

// Format price with animation potential
function formatPrice(price: number) {
  return `$${price.toFixed(2)}`
}
</script>

<template>
  <div
    class="product-card group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
    :style="{ animationDelay }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Image container -->
    <div class="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-700">
      <img
        :src="product.image"
        :alt="product.name"
        class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
        loading="lazy"
      />

      <!-- Badges -->
      <div class="absolute top-3 left-3 flex flex-wrap gap-2">
        <span
          v-for="badge in product.badges?.slice(0, 2)"
          :key="badge"
          class="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full shadow-md animate-pulse"
        >
          {{ badge }}
        </span>
      </div>

      <!-- Quick add overlay -->
      <div
        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
      >
        <button
          @click="handleAddToCart"
          :disabled="isAdding"
          class="bg-white text-gray-900 px-6 py-3 rounded-xl font-bold transform -translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-600 hover:to-pink-600 hover:text-white shadow-lg"
        >
          {{ isAdding ? '✓ Added!' : '🛒 Add to Cart' }}
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4">
      <!-- Title -->
      <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-2 min-h-[3rem] mb-2">
        {{ product.name }}
      </h3>

      <!-- Rating -->
      <div class="flex items-center gap-2 mb-2">
        <div class="flex">
          <span
            v-for="i in 5"
            :key="i"
            class="text-sm"
          >
            {{ i <= Math.round(product.rating) ? '⭐' : '☆' }}
          </span>
        </div>
        <span class="text-sm text-gray-500 dark:text-gray-400">
          ({{ product.reviews.toLocaleString() }})
        </span>
      </div>

      <!-- Price -->
      <div
        class="flex items-baseline gap-2 cursor-pointer"
        @click="emit('priceClick')"
      >
        <span class="text-2xl font-bold text-red-600">
          {{ formatPrice(product.price) }}
        </span>
        <span
          v-if="product.originalPrice"
          class="text-sm text-gray-500 line-through relative"
        >
          {{ formatPrice(product.originalPrice) }}
          <span class="price-slash absolute inset-0 bg-red-500 h-0.5 top-1/2 -rotate-12" />
        </span>
        <span
          v-if="product.originalPrice"
          class="text-xs text-green-600 font-semibold"
        >
          {{ Math.round((1 - product.price / product.originalPrice) * 100) }}% off!
        </span>
      </div>

      <!-- Delivery -->
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-1">
        <span>📦</span>
        {{ product.deliveryTime }}
      </p>

      <!-- Top review teaser -->
      <div
        v-if="product.topReview"
        class="mt-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
      >
        <p class="text-xs text-gray-600 dark:text-gray-400 italic line-clamp-2">
          "{{ product.topReview }}"
        </p>
      </div>
    </div>

    <!-- Add to cart button (mobile) -->
    <div class="p-4 pt-0 md:hidden">
      <button
        @click="handleAddToCart"
        :disabled="isAdding"
        class="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
      >
        {{ isAdding ? '✓ Added!' : 'Add to Cart' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.product-card {
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

.price-slash {
  animation: slash-appear 0.3s ease-out 0.5s backwards;
}

@keyframes slash-appear {
  from {
    transform: scaleX(0) rotate(-12deg);
  }
  to {
    transform: scaleX(1) rotate(-12deg);
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
