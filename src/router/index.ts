import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/generate',
      name: 'generate',
      component: () => import('../views/GenerateView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/p/:slug',
      name: 'parody',
      component: () => import('../views/ParodyView.vue'),
    },
  ],
})

// Note: Auth guard is handled by Clerk at component level
// DashboardView and GenerateView watch isSignedIn and redirect if not authenticated

export default router
