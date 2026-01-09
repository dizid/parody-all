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
      path: '/generate/:id',
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

export default router
