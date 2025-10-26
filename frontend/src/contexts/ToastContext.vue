<template>
  <div>
    <slot />
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', toast.type]"
        @click="removeToast(toast.id)"
      >
        <div class="toast-content">
          {{ toast.message }}
        </div>
        <button
          class="toast-close"
          @click.stop="removeToast(toast.id)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import { Toast, ToastType } from '../types/index.js'

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const toasts = ref<Toast[]>([])

const addToast = (toast: Omit<Toast, 'id'>) => {
  const id = Math.random().toString(36).substr(2, 9)
  const newToast: Toast = { ...toast, id }
  toasts.value.push(newToast)

  // Auto-remove after 2 seconds by default, unless a specific duration is provided
  const duration = toast.duration && toast.duration > 0 ? toast.duration : 2000
  setTimeout(() => {
    removeToast(id)
  }, duration)
}

const removeToast = (id: string) => {
  toasts.value = toasts.value.filter(toast => toast.id !== id)
}

// Provide the toast context to child components
const toastContext: ToastContextType = {
  toasts: toasts.value,
  addToast,
  removeToast
}

provide('toast', toastContext)
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 4px;
  min-width: 300px;
  max-width: 400px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s ease;
}

.toast.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.toast.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.toast.warning {
  background-color: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.toast.info {
  background-color: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.toast-content {
  flex: 1;
  margin-right: 10px;
}

.toast-close {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.toast-close:hover {
  opacity: 1;
}
</style>