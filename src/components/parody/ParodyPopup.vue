<script setup lang="ts">
import type { Popup, PopupButton } from '../../types'

defineProps<{
  popup: Popup | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  buttonClick: [index: number]
}>()

// Helper to get button label (handles both string and PopupButton formats)
function getButtonLabel(btn: string | PopupButton): string {
  return typeof btn === 'string' ? btn : btn.label
}

// Helper to check if button is primary
function isPrimaryButton(btn: string | PopupButton, index: number): boolean {
  if (typeof btn === 'string') {
    return index === 0 // First button is primary for string arrays
  }
  return btn.primary ?? index === 0
}
</script>

<template>
  <Teleport to="body">
    <Transition name="popup">
      <div
        v-if="visible && popup"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="emit('close')"
        />

        <!-- Popup content -->
        <div class="popup-content relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <!-- Header with icon -->
          <div class="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-center">
            <div class="text-5xl mb-2 animate-bounce">{{ popup.icon || '🎉' }}</div>
            <h3 class="text-2xl font-bold text-white">{{ popup.title }}</h3>
          </div>

          <!-- Message -->
          <div class="p-6">
            <p class="text-gray-700 dark:text-gray-300 text-center text-lg leading-relaxed">
              {{ popup.message }}
            </p>
          </div>

          <!-- Buttons -->
          <div class="p-4 bg-gray-50 dark:bg-gray-800 flex flex-col gap-3">
            <button
              v-for="(btn, index) in popup.buttons"
              :key="index"
              @click="emit('buttonClick', index)"
              :class="[
                'px-6 py-3 rounded-xl font-semibold transition-all duration-200',
                isPrimaryButton(btn, index)
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm'
              ]"
            >
              {{ getButtonLabel(btn) }}
            </button>
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
.popup-enter-active,
.popup-leave-active {
  transition: all 0.3s ease;
}

.popup-enter-from,
.popup-leave-to {
  opacity: 0;
}

.popup-enter-from .popup-content,
.popup-leave-to .popup-content {
  transform: scale(0.8) translateY(20px);
}

.popup-enter-active .popup-content,
.popup-leave-active .popup-content {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.popup-content {
  animation: popup-shake 0.5s ease-in-out;
}

@keyframes popup-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}
</style>
