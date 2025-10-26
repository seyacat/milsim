import { createRouter, createWebHistory } from 'vue-router'
import { AuthService } from '../services/auth.js'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../components/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../components/Register.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../components/Dashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/create-game',
      name: 'create-game',
      component: () => import('../components/CreateGame.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/game/:gameId',
      name: 'game',
      component: () => import('../components/Game.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      redirect: () => {
        const user = AuthService.getCurrentUser()
        return user ? '/dashboard' : '/login'
      }
    }
  ]
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = AuthService.isAuthenticated()
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (!to.meta.requiresAuth && isAuthenticated) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router