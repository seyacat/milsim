import { inject } from 'vue'
import { Toast, ToastType } from '../types/index.js'

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

export const useToast = () => {
  const toastContext = inject<ToastContextType>('toast')
  
  if (!toastContext) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  
  return toastContext
}