<template>
  <div id="app">
    <ToastProvider>
      <router-view />
    </ToastProvider>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from './services/auth.js'
import { User } from './types/index.js'
import ToastProvider from './contexts/ToastContext.vue'

const router = useRouter()
const currentUser = ref<User | null>(null)
const loading = ref(true)

onMounted(() => {
  const user = AuthService.getCurrentUser()
  currentUser.value = user
  loading.value = false
})

// Function to update user that is passed to components
const handleLogin = (user: User) => {
  currentUser.value = user
}

// Expose handleLogin for child components if needed
defineExpose({
  handleLogin
})
</script>

<style>
@import './styles/pages.css';

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-size: 18px;
  color: var(--text-primary);
}
</style>