<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  visible: boolean
  url: string
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()

const copied = ref(false)

// Share URLs for each platform
const shareLinks = computed(() => {
  const encodedUrl = encodeURIComponent(props.url)
  const encodedTitle = encodeURIComponent(props.title)

  return {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}%20%E2%80%94%20uncomfortably%20accurate%20%F0%9F%98%82&hashtags=parody`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=Check%20this%20out:%20${encodedUrl}`,
  }
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  } catch {
    // Fallback for older browsers
    const input = document.createElement('input')
    input.value = props.url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copied.value = true
    setTimeout(() => copied.value = false, 2000)
  }
}

function openShare(url: string) {
  window.open(url, '_blank', 'width=600,height=400')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="emit('close')"
        />

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <!-- Header -->
          <div class="bg-gradient-to-r from-purple-600 to-pink-600 p-5 text-center">
            <div class="text-3xl mb-1">📤</div>
            <h3 class="text-xl font-bold text-white">Share this roast</h3>
          </div>

          <!-- Content -->
          <div class="p-5 space-y-4">
            <!-- URL Copy Section -->
            <div class="flex gap-2">
              <input
                type="text"
                :value="url"
                readonly
                class="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-gray-700 text-sm truncate"
              />
              <button
                @click="copyLink"
                class="px-4 py-2 rounded-lg font-medium transition-all duration-200"
                :class="copied
                  ? 'bg-green-500 text-white'
                  : 'bg-purple-600 text-white hover:bg-purple-700'"
              >
                {{ copied ? '✓ Copied!' : 'Copy' }}
              </button>
            </div>

            <!-- Social Share Buttons -->
            <div>
              <p class="text-sm text-gray-500 mb-3 text-center">Your friends need to see this:</p>
              <div class="grid grid-cols-4 gap-3">
                <!-- Twitter/X -->
                <button
                  @click="openShare(shareLinks.twitter)"
                  class="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <span class="text-2xl">𝕏</span>
                  <span class="text-xs text-gray-600">Twitter</span>
                </button>

                <!-- Facebook -->
                <button
                  @click="openShare(shareLinks.facebook)"
                  class="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-100 hover:bg-blue-100 transition-colors"
                >
                  <span class="text-2xl text-blue-600">f</span>
                  <span class="text-xs text-gray-600">Facebook</span>
                </button>

                <!-- WhatsApp -->
                <button
                  @click="openShare(shareLinks.whatsapp)"
                  class="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-100 hover:bg-green-100 transition-colors"
                >
                  <span class="text-2xl">💬</span>
                  <span class="text-xs text-gray-600">WhatsApp</span>
                </button>

                <!-- Email -->
                <button
                  @click="openShare(shareLinks.email)"
                  class="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <span class="text-2xl">✉️</span>
                  <span class="text-xs text-gray-600">Email</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Close button -->
          <button
            @click="emit('close')"
            class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.9) translateY(20px);
}
</style>
