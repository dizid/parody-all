<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { useAuth } from './composables/useAuth'

const { user, signOut } = useAuth()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-parody-light to-gray-100">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <RouterLink to="/" class="flex items-center gap-2">
          <span class="text-2xl">🎭</span>
          <span class="font-bold text-xl text-parody-dark">Parody Everything</span>
        </RouterLink>

        <div class="flex items-center gap-4">
          <template v-if="user">
            <RouterLink
              to="/dashboard"
              class="text-gray-600 hover:text-parody-primary transition-colors"
            >
              Dashboard
            </RouterLink>
            <button
              @click="signOut"
              class="text-gray-600 hover:text-parody-primary transition-colors"
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
    <footer class="bg-white border-t border-gray-200 mt-auto py-8">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
        <p>🎭 Parody Everything &copy; 2025 - Turn any website into comedy gold</p>
        <p class="text-sm mt-2">This is a parody site generator. All generated content is satirical.</p>
      </div>
    </footer>
  </div>
</template>
