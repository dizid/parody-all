<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  url: string
  title: string
  shareCount: number
}>()

const emit = defineEmits<{
  share: [platform: string]
}>()

const visible = ref(false)
const copied = ref(false)
const dismissed = ref(false)

// Show after 5s or 30% scroll, whichever comes first
let scrollHandler: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function show() {
  if (!dismissed.value) {
    visible.value = true
  }
}

function dismiss() {
  dismissed.value = true
  visible.value = false
}

onMounted(() => {
  timer = setTimeout(show, 5000)

  scrollHandler = () => {
    const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight)
    if (scrollPercent > 0.3) {
      show()
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler)
      }
    }
  }
  window.addEventListener('scroll', scrollHandler, { passive: true })
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.url)
    copied.value = true
    emit('share', 'copy')
    setTimeout(() => copied.value = false, 2000)
  } catch {
    // Fallback
    const input = document.createElement('input')
    input.value = props.url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copied.value = true
    emit('share', 'copy')
    setTimeout(() => copied.value = false, 2000)
  }
}

function shareTwitter() {
  const text = encodeURIComponent(`I turned ${new URL(props.url).pathname.split('/').pop()} into a parody and it's uncomfortably accurate`)
  const url = encodeURIComponent(props.url)
  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}&hashtags=parody`, '_blank', 'width=600,height=400')
  emit('share', 'twitter')
}

function shareWhatsApp() {
  const text = encodeURIComponent(`Look what I found ${props.url}`)
  window.open(`https://wa.me/?text=${text}`, '_blank')
  emit('share', 'whatsapp')
}
</script>

<template>
  <Transition name="slide-in">
    <div
      v-if="visible"
      class="fixed z-40 flex items-center gap-2
             bottom-4 left-1/2 -translate-x-1/2
             md:bottom-auto md:top-1/2 md:right-4 md:left-auto md:translate-x-0 md:-translate-y-1/2 md:flex-col"
    >
      <!-- Main pill -->
      <div class="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 p-2 flex md:flex-col items-center gap-1.5">
        <!-- Label -->
        <span class="text-xs font-bold text-gray-500 px-2 hidden md:block">SHARE</span>

        <!-- Twitter/X -->
        <button
          @click="shareTwitter"
          class="w-10 h-10 rounded-xl bg-gray-100 hover:bg-black hover:text-white flex items-center justify-center text-lg transition-all duration-200"
          title="Share on X"
        >
          𝕏
        </button>

        <!-- WhatsApp -->
        <button
          @click="shareWhatsApp"
          class="w-10 h-10 rounded-xl bg-gray-100 hover:bg-green-500 hover:text-white flex items-center justify-center text-lg transition-all duration-200"
          title="Share on WhatsApp"
        >
          💬
        </button>

        <!-- Copy Link -->
        <button
          @click="copyLink"
          class="w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-200"
          :class="copied ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-purple-500 hover:text-white'"
          title="Copy link"
        >
          {{ copied ? '✓' : '🔗' }}
        </button>

        <!-- Share count -->
        <div v-if="shareCount >= 5" class="text-xs text-gray-400 font-medium px-1 text-center">
          {{ shareCount.toLocaleString() }}
        </div>

        <!-- Dismiss -->
        <button
          @click="dismiss"
          class="w-6 h-6 rounded-full text-gray-300 hover:text-gray-500 flex items-center justify-center text-xs transition-colors md:mt-1"
        >
          ✕
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Mobile: slide up from bottom */
.slide-in-enter-from,
.slide-in-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Desktop: slide in from right */
@media (min-width: 768px) {
  .slide-in-enter-from,
  .slide-in-leave-to {
    opacity: 0;
    transform: translateY(-50%) translateX(20px);
  }
}
</style>
