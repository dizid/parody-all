<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Fee } from '../../types'

const props = defineProps<{
  fees: Fee[]
  subtotal: number
  feeAnimating: boolean
}>()

const emit = defineEmits<{
  addFee: [fee: Fee]
}>()

const showDetails = ref(false)
const surpriseFeeAdded = ref(false)

// Calculate total with fees
const feesTotal = computed(() =>
  props.fees.reduce((sum, fee) => sum + fee.amount, 0)
)

const grandTotal = computed(() => props.subtotal + feesTotal.value)

// Add a surprise fee when hovering the total
function onTotalHover() {
  if (!surpriseFeeAdded.value && props.fees.length > 0) {
    surpriseFeeAdded.value = true
    emit('addFee', {
      name: 'Hover Curiosity Fee',
      amount: 0.99,
      reason: 'You looked at the total too long'
    })
  }
}

function formatPrice(amount: number) {
  return `$${amount.toFixed(2)}`
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
    <!-- Header -->
    <div class="bg-gradient-to-r from-green-500 to-emerald-500 p-4">
      <h3 class="text-xl font-bold text-white flex items-center gap-2">
        <span>💰</span>
        Totally Transparent Pricing™
      </h3>
      <p class="text-white/80 text-sm">No hidden fees* (*fees are hidden)</p>
    </div>

    <div class="p-6">
      <!-- Subtotal -->
      <div class="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700">
        <span class="text-gray-600 dark:text-gray-400">Subtotal</span>
        <span class="font-semibold text-gray-900 dark:text-white">{{ formatPrice(subtotal) }}</span>
      </div>

      <!-- Fees list -->
      <div class="py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          @click="showDetails = !showDetails"
          class="w-full flex justify-between items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <span class="flex items-center gap-2">
            <span>Fees & Charges</span>
            <span class="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full">
              {{ fees.length }} fees
            </span>
          </span>
          <div class="flex items-center gap-2">
            <span class="font-semibold text-red-600">+{{ formatPrice(feesTotal) }}</span>
            <span class="transform transition-transform" :class="{ 'rotate-180': showDetails }">▼</span>
          </div>
        </button>

        <!-- Fee details -->
        <Transition name="expand">
          <div v-if="showDetails" class="mt-4 space-y-3">
            <div
              v-for="(fee, index) in fees"
              :key="fee.name"
              class="fee-item flex justify-between items-start pl-4 py-2 border-l-2 border-gray-200 dark:border-gray-600"
              :class="{ 'animate-pulse bg-yellow-50 dark:bg-yellow-900/20': feeAnimating && index === fees.length - 1 }"
              :style="{ animationDelay: `${index * 100}ms` }"
            >
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ fee.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-500 italic">{{ fee.reason }}</p>
              </div>
              <span class="text-sm font-semibold text-red-600 ml-4">+{{ formatPrice(fee.amount) }}</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Grand total -->
      <div
        class="flex justify-between items-center py-4 cursor-pointer group"
        @mouseenter="onTotalHover"
      >
        <span class="text-lg font-bold text-gray-900 dark:text-white">
          Grand Total
          <span class="text-xs font-normal text-gray-400">(before additional fees)</span>
        </span>
        <div class="text-right">
          <span class="text-2xl font-bold text-purple-600 group-hover:animate-pulse">
            {{ formatPrice(grandTotal) }}
          </span>
          <p class="text-xs text-gray-400">+ tax + tips + vibes</p>
        </div>
      </div>

      <!-- Checkout button -->
      <button
        class="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        Proceed to More Fees →
      </button>

      <!-- Trust indicators -->
      <div class="mt-4 flex justify-center gap-4 text-xs text-gray-400">
        <span>🔒 Secure-ish</span>
        <span>💳 We accept everything</span>
        <span>📦 Shipping extra</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fee-item {
  animation: fee-slide-in 0.3s ease-out backwards;
}

@keyframes fee-slide-in {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
