<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  reactions: Record<string, number>
  slug: string
}>()

const emit = defineEmits<{
  react: [reaction: string]
  share: []
}>()

const userReacted = ref<string | null>(null)
const showShareNudge = ref(false)

const reactionTypes = [
  { key: 'dead', emoji: '😂', label: 'Dead' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'savage', emoji: '💀', label: 'Savage' },
  { key: 'too_real', emoji: '👏', label: 'Too Real' },
]

const totalReactions = computed(() =>
  Object.values(props.reactions || {}).reduce((sum, n) => sum + (n || 0), 0)
)

async function react(reaction: string) {
  if (userReacted.value) return // One reaction per session

  userReacted.value = reaction
  emit('react', reaction)

  // Track reaction
  try {
    await fetch('/.netlify/functions/track-engagement', {
      method: 'POST',
      body: JSON.stringify({ slug: props.slug, action: 'react', reaction }),
    })
  } catch {
    // Silent fail — don't block UX for analytics
  }

  // Show share nudge after reacting
  showShareNudge.value = true
  setTimeout(() => showShareNudge.value = false, 6000)
}
</script>

<template>
  <div class="py-6">
    <!-- Reaction buttons -->
    <div class="flex items-center justify-center gap-3 flex-wrap">
      <span class="text-sm text-gray-500 font-medium mr-2">How was this roast?</span>

      <button
        v-for="r in reactionTypes"
        :key="r.key"
        @click="react(r.key)"
        class="group flex items-center gap-1.5 px-4 py-2 rounded-full border transition-all duration-200"
        :class="[
          userReacted === r.key
            ? 'bg-purple-100 border-purple-400 scale-110'
            : userReacted
              ? 'opacity-50 cursor-default border-gray-200'
              : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50 hover:scale-105 cursor-pointer'
        ]"
      >
        <span class="text-xl" :class="{ 'animate-bounce': userReacted === r.key }">{{ r.emoji }}</span>
        <span class="text-sm font-medium text-gray-600">{{ r.label }}</span>
        <span
          v-if="(reactions?.[r.key] || 0) > 0"
          class="text-xs text-gray-400 ml-0.5"
        >
          {{ reactions[r.key] }}
        </span>
      </button>

      <!-- Total count -->
      <span v-if="totalReactions > 0" class="text-sm text-gray-400 ml-2">
        {{ totalReactions.toLocaleString() }} reactions
      </span>
    </div>

    <!-- Share nudge after reacting -->
    <Transition name="nudge">
      <div
        v-if="showShareNudge"
        class="mt-4 text-center"
      >
        <p class="text-sm text-gray-500 mb-2">Enjoyed this roast? Your friends would too.</p>
        <button
          @click="emit('share')"
          class="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200"
        >
          Share this roast 🔥
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.nudge-enter-active,
.nudge-leave-active {
  transition: all 0.3s ease;
}

.nudge-enter-from,
.nudge-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
