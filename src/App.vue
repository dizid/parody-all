<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { useAuth } from './composables/useAuth'
import { useTheme } from './composables/useTheme'

const { isSignedIn, signOut } = useAuth()
const { theme, toggleTheme } = useTheme()
</script>

<template>
  <div class="min-h-screen" style="background-color: var(--color-bg-primary);">
    <!-- Header -->
    <header class="shadow-sm border-b" style="background-color: var(--color-bg-card); border-color: var(--color-border);">
      <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2">
          <span class="text-2xl">🎭</span>
          <span class="font-bold text-xl" style="color: var(--color-text-primary);">Parody Everything</span>
        </RouterLink>

        <div class="flex items-center gap-4">
          <!-- Theme Toggle -->
          <button
            @click="toggleTheme"
            class="p-2 rounded-lg transition-colors hover:bg-parody-primary/10"
            :title="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <span v-if="theme === 'dark'" class="text-xl">☀️</span>
            <span v-else class="text-xl">🌙</span>
          </button>

          <template v-if="isSignedIn">
            <RouterLink
              to="/dashboard"
              class="hover:text-parody-primary transition-colors"
              style="color: var(--color-text-secondary);"
            >
              Dashboard
            </RouterLink>
            <button
              @click="signOut"
              class="hover:text-parody-primary transition-colors"
              style="color: var(--color-text-secondary);"
            >
              Sign Out
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="bg-parody-primary text-white px-4 py-2 rounded-lg hover:bg-parody-primary/90 transition-colors"
            >
              Sign In
            </RouterLink>
          </template>
        </div>
      </nav>
    </header>

    <!-- Main content -->
    <main>
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="border-t mt-auto py-8" style="background-color: var(--color-bg-card); border-color: var(--color-border);">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center" style="color: var(--color-text-secondary);">
        <p>🎭 Parody Everything &copy; 2025 - Turn any website into comedy gold</p>
        <p class="text-sm mt-2">This is a parody site generator. All generated content is satirical.</p>
      </div>
    </footer>
  </div>
</template>
