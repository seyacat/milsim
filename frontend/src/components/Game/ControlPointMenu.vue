<template>
  <div
    ref="menuRef"
    class="control-point-menu"
  >
    <div class="menu-content">
      <div class="menu-title">
        Crear Punto de Control
      </div>
      <button
        class="create-btn"
        @click="handleCreateControlPoint"
      >
        Crear
      </button>
      <button
        class="cancel-btn"
        @click="onClose"
      >
        Cancelar
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  position: { lat: number; lng: number }
}

interface Emits {
  (e: 'close'): void
  (e: 'createControlPoint', lat: number, lng: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const menuRef = ref<HTMLDivElement | null>(null)

const handleCreateControlPoint = () => {
  emit('createControlPoint', props.position.lat, props.position.lng)
  emit('close')
}

const onClose = () => {
  emit('close')
}

// Handle click outside
onMounted(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
      onClose()
    }
  }

  document.addEventListener('click', handleClickOutside)
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })
})
</script>

<style scoped>
.control-point-menu {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid #4CAF50;
  border-radius: 8px;
  padding: 20px;
  z-index: 9999;
  min-width: 220px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
  color: white;
  font-family: Arial, sans-serif;
  pointer-events: auto;
}

.menu-content {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 10px;
}

.menu-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 5px;
  text-align: center;
  color: white;
}

.create-btn {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
  transition: background-color 0.3s;
}

.create-btn:hover {
  background: #45a049;
}

.cancel-btn {
  padding: 8px 16px;
  background: transparent;
  color: #ccc;
  border: 1px solid #666;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  width: 100%;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-color: #888;
}
</style>