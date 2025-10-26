<template>
  <div class="game-panel location-info-panel">
    <div>Estado GPS: <span>{{ gpsStatus }}</span></div>
    <div>Lat: <span>{{ currentPosition ? currentPosition.lat.toFixed(6) : '-' }}</span></div>
    <div>Lng: <span>{{ currentPosition ? currentPosition.lng.toFixed(6) : '-' }}</span></div>
    <div>Precisión: <span>{{ currentPosition ? currentPosition.accuracy.toFixed(1) + 'm' : '-' }}</span></div>
    
    <div class="time-select-container">
      <label class="panel-label">Tiempo:</label>
      <select
        class="panel-select"
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
.time-select-container {
  margin-top: 10px;
}
</style>