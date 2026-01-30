<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TrustBadge, FAQ } from '../../types'

const props = defineProps<{
  parodyName: string
  originalUrl: string
  trustBadges?: TrustBadge[]
  faqs?: FAQ[]
  creatorUrl?: string | null
  backlinkSize?: string
}>()

// Extract domain from creator URL for display
const creatorDomain = computed(() => {
  if (!props.creatorUrl) return ''
  try {
    return new URL(props.creatorUrl).hostname.replace('www.', '')
  } catch {
    return props.creatorUrl
  }
})

// Determine the backlink URL and text
const backlinkUrl = computed(() => props.creatorUrl || 'https://parodyhumor.lol')
const backlinkText = computed(() => props.creatorUrl ? `Made by ${creatorDomain.value}` : 'Made with ParodyHumor.lol')

const copyrightClicks = ref(0)
const showSecret = ref(false)
const expandedFaq = ref<string | null>(null)

function handleCopyrightClick() {
  copyrightClicks.value++
  if (copyrightClicks.value >= 3) {
    showSecret.value = true
    copyrightClicks.value = 0
    setTimeout(() => {
      showSecret.value = false
    }, 3000)
  }
}

function toggleFaq(id: string) {
  expandedFaq.value = expandedFaq.value === id ? null : id
}
</script>

<template>
  <footer class="bg-gray-900 text-white">
    <!-- FAQ Section -->
    <section v-if="faqs?.length" class="py-12 px-4 border-b border-gray-800">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl font-bold mb-8 flex items-center gap-3">
          <span>❓</span>
          Frequently Asked Questions
          <span class="text-sm font-normal text-gray-500">(That We Made Up)</span>
        </h2>

        <div class="space-y-4">
          <div
            v-for="faq in faqs"
            :key="faq.id"
            class="bg-gray-800/50 rounded-xl overflow-hidden"
          >
            <button
              @click="toggleFaq(faq.id)"
              class="w-full p-5 text-left flex justify-between items-center hover:bg-gray-800 transition-colors"
            >
              <span class="font-medium">{{ faq.question }}</span>
              <span
                class="transform transition-transform duration-200"
                :class="{ 'rotate-180': expandedFaq === faq.id }"
              >
                ▼
              </span>
            </button>
            <Transition name="expand">
              <div
                v-if="expandedFaq === faq.id"
                class="px-5 pb-5 text-gray-400"
              >
                {{ faq.answer }}
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </section>

    <!-- Trust Badges -->
    <section v-if="trustBadges?.length" class="py-8 px-4 border-b border-gray-800">
      <div class="max-w-4xl mx-auto">
        <div class="flex flex-wrap justify-center gap-6">
          <div
            v-for="badge in trustBadges"
            :key="badge.id"
            class="group relative flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full hover:bg-gray-700 transition-colors cursor-help"
          >
            <span class="text-xl">{{ badge.icon }}</span>
            <span class="font-medium">{{ badge.name }}</span>

            <!-- Tooltip -->
            <div
              v-if="badge.tooltip"
              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
            >
              {{ badge.tooltip }}
              <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Footer -->
    <div class="py-12 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="grid md:grid-cols-4 gap-8 mb-12">
          <!-- About -->
          <div>
            <h3 class="font-bold mb-4 flex items-center gap-2">
              <span>🎭</span>
              {{ parodyName }}
            </h3>
            <p class="text-gray-400 text-sm leading-relaxed">
              This is a parody site created for entertainment purposes. No actual products or services are offered.
              If you tried to buy something, that's on you.
            </p>
          </div>

          <!-- Fake Links 1 -->
          <div>
            <h3 class="font-bold mb-4">Customer "Service"</h3>
            <ul class="space-y-2 text-gray-400 text-sm">
              <li class="hover:text-white cursor-pointer">Contact Us (We Won't Reply)</li>
              <li class="hover:text-white cursor-pointer">Returns (LOL)</li>
              <li class="hover:text-white cursor-pointer">Shipping Info (It's Bad)</li>
              <li class="hover:text-white cursor-pointer">Track Order (Good Luck)</li>
            </ul>
          </div>

          <!-- Fake Links 2 -->
          <div>
            <h3 class="font-bold mb-4">Legal-ish</h3>
            <ul class="space-y-2 text-gray-400 text-sm">
              <li class="hover:text-white cursor-pointer">Privacy Policy (We Sell Everything)</li>
              <li class="hover:text-white cursor-pointer">Terms of Service (You Lose)</li>
              <li class="hover:text-white cursor-pointer">Cookie Policy (We Use All of Them)</li>
              <li class="hover:text-white cursor-pointer">Your Rights (Lmao)</li>
            </ul>
          </div>

          <!-- Fake Newsletter -->
          <div>
            <h3 class="font-bold mb-4">Subscribe to Regret</h3>
            <p class="text-gray-400 text-sm mb-4">Get spam delivered straight to your inbox!</p>
            <div class="flex gap-2">
              <input
                type="email"
                placeholder="your@email.com"
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
              />
              <button class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-medium transition-colors">
                Spam Me
              </button>
            </div>
          </div>
        </div>

        <!-- Payment icons (fake) -->
        <div class="flex justify-center gap-4 mb-8 text-3xl grayscale opacity-50">
          <span title="Visa (probably)">💳</span>
          <span title="Mastercard (maybe)">💳</span>
          <span title="PayPal (definitely not)">💰</span>
          <span title="Bitcoin (why)">₿</span>
          <span title="Cash (yes please)">💵</span>
        </div>

        <!-- Parody disclaimer -->
        <div class="text-center py-6 border-t border-gray-800">
          <p class="text-gray-500 text-sm mb-2">
            🎭 This is a parody of
            <a :href="originalUrl" target="_blank" class="text-purple-400 hover:text-purple-300">
              {{ originalUrl }}
            </a>
            - For entertainment purposes only!
          </p>
          <p
            class="text-gray-600 text-xs cursor-pointer hover:text-gray-400 transition-colors"
            @click="handleCopyrightClick"
          >
            © {{ new Date().getFullYear() }} {{ parodyName }}. No rights reserved. We made this up.
          </p>

          <!-- Easter egg -->
          <Transition name="fade">
            <p v-if="showSecret" class="mt-4 text-purple-400 text-sm animate-pulse">
              🎉 You found the secret! Your reward: absolutely nothing. Congrats!
            </p>
          </Transition>
        </div>

        <!-- Made with ParodyHumor.lol or Creator URL -->
        <div class="text-center pt-6 border-t border-gray-800">
          <a
            :href="backlinkUrl"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span>🎭</span>
            <span>{{ backlinkText }}</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
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
  max-height: 200px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
