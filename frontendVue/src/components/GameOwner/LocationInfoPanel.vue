<template>
  <div class="location-info-panel">
    <div>Estado GPS: <span>{{ gpsStatus }}</span></div>
    <div>Lat: <span>{{ currentPosition ? currentPosition.lat.toFixed(6) : '-' }}</span></div>
    <div>Lng: <span>{{ currentPosition ? currentPosition.lng.toFixed(6) : '-' }}</span></div>
    <div>Precisión: <span>{{ currentPosition ? currentPosition.accuracy.toFixed(1) + 'm' : '-' }}</span></div>
    
    <div style="margin-top: 10px">
      <label style="color: white; font-size: 12px; display: block; margin-bottom: 5px">Tiempo:</label>
      <select
        style="width: 100%; padding: 5px; border-radius: 3px; background: #333; color: white; border: 1px solid #666"
        @change="handleTimeSelect"
        :value="defaultTimeValue"
      >
        <option value="20">20 seg (test)</option>
        <option value="300">5 min</option>
        <option value="600">10 min</option>
        <option value="1200">20 min</option>
        <option value="3600">1 hora</option>
        <option value="0">indefinido</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '../../composables/useToast.js'

const { addToast } = useToast()

defineProps<{
  gpsStatus: string
  currentPosition: any
  defaultTimeValue: number
}>()

const emit = defineEmits<{
  timeSelect: [timeInSeconds: number]
}>()

const handleTimeSelect = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const timeInSeconds = parseInt(target.value)
  emit('timeSelect', timeInSeconds)
}
</script>

<style scoped>
.location-info-panel {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  padding: 10px;
  color: white;
  font-size: 12px;
  backdrop-filter: blur(10px);
}
</style>