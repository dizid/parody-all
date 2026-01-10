<script setup lang="ts">
import type { BacklinkSize } from '../types'

defineProps<{
  size: BacklinkSize
  position?: 'banner' | 'footer' | 'floating'
}>()

const sizeClasses = {
  large: 'py-4 text-base',
  small: 'py-2 text-xs',
  none: '',
}

const floatingClasses = {
  large: 'bottom-4 right-4 p-4 rounded-xl shadow-lg',
  small: 'bottom-2 right-2 p-2 rounded-md shadow-sm',
  none: '',
}
</script>

<template>
  <!-- No backlink for 'none' size (Pro tier) -->
  <template v-if="size === 'none'"></template>

  <!-- Banner style (top of page) -->
  <div
    v-else-if="position === 'banner'"
    :class="[
      'bg-gradient-to-r from-purple-600 to-pink-500 text-white text-center',
      sizeClasses[size]
    ]"
  >
    <a
      href="https://parodyhumor.lol"
      target="_blank"
      class="hover:underline inline-flex items-center gap-2"
    >
      <span class="text-lg" v-if="size === 'large'">🎭</span>
      <span v-if="size === 'large'">
        Create your own parody site at <strong>ParodyHumor.lol</strong>
      </span>
      <span v-else>
        Made with ParodyHumor.lol
      </span>
      <span>→</span>
    </a>
  </div>

  <!-- Footer style -->
  <div
    v-else-if="position === 'footer'"
    :class="[
      'bg-gray-900 text-white text-center',
      sizeClasses[size]
    ]"
  >
    <a
      href="https://parodyhumor.lol"
      target="_blank"
      class="hover:underline inline-flex items-center gap-2"
    >
      <span v-if="size === 'large'">🎭 This parody was created with </span>
      <strong>ParodyHumor.lol</strong>
      <span v-if="size === 'large'"> - Turn any website into comedy gold!</span>
    </a>
  </div>

  <!-- Floating badge -->
  <div
    v-else
    :class="[
      'fixed bg-white border border-gray-200 z-50',
      floatingClasses[size]
    ]"
  >
    <a
      href="https://parodyhumor.lol"
      target="_blank"
      class="flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors"
    >
      <span>🎭</span>
      <span v-if="size === 'large'">Made with <strong>ParodyHumor.lol</strong></span>
      <span v-else>parodyhumor.lol</span>
    </a>
  </div>
</template>
