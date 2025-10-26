<template>
  <div class="game-panel location-info-panel">
    <div>Estado GPS: <span>{{ gpsStatus }}</span></div>
    <div>Lat: <span>{{ currentPosition ? currentPosition.lat.toFixed(6) : '-' }}</span></div>
    <div>Lng: <span>{{ currentPosition ? currentPosition.lng.toFixed(6) : '-' }}</span></div>
    <div>Precisión: <span>{{ currentPosition ? currentPosition.accuracy.toFixed(1) + 'm' : '-' }}</span></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  gpsStatus: string
  currentPosition: any
}>()
</script>

<style scoped>
</style>