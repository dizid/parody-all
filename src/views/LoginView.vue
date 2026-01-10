<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { SignIn, useAuth } from '@clerk/vue'

const router = useRouter()
const { isSignedIn } = useAuth()

// Redirect if already logged in
watch(isSignedIn, (signedIn) => {
  if (signedIn) router.push('/dashboard')
}, { immediate: true })
</script>

<template>
  <div class="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
    <!-- Animated background -->
    <div class="fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
    </div>

    <div class="w-full max-w-md">
      <!-- Header -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg shadow-purple-500/30 mb-4">
          <span class="text-3xl">🎭</span>
        </div>
        <h1 class="text-3xl font-black" style="color: var(--color-text-primary);">Welcome to Parody Everything</h1>
        <p class="mt-2" style="color: var(--color-text-secondary);">Sign in to start creating hilarious parodies</p>
      </div>

      <!-- Free trial badge -->
      <div class="rounded-xl p-4 mb-6 border border-green-500/30 bg-green-500/10">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🎁</span>
          <div>
            <p class="font-semibold text-green-400">First parody is FREE!</p>
            <p class="text-sm text-green-500/80">No credit card required</p>
          </div>
        </div>
      </div>

      <!-- Clerk SignIn Component -->
      <div class="flex justify-center">
        <SignIn
          :appearance="{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border-0 bg-transparent',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtonsBlockButton: 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-300',
              formButtonPrimary: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300',
              footerActionLink: 'text-purple-600 font-bold hover:text-purple-700'
            }
          }"
        />
      </div>

      <!-- Trust badges -->
      <div class="flex items-center justify-center gap-6 mt-8 text-sm" style="color: var(--color-text-secondary)">
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
          </svg>
          Secure
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"/>
          </svg>
          Fast
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
          </svg>
          Free to Start
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}

.animate-blob {
  animation: blob 7s infinite;
}

.animation-delay-2000 { animation-delay: 2s; }
.animation-delay-4000 { animation-delay: 4s; }
</style>
