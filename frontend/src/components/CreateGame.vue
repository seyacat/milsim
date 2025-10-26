<template>
  <div class="create-game-container">
    <div class="card create-game-card">
      <h1 class="create-game-title">Crear Nuevo Juego</h1>
      <form id="createGameForm" class="create-game-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="name" class="form-label">Nombre del Juego:</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            class="form-input" 
            required 
            placeholder="Ingresa el nombre del juego"
            v-model="name"
          />
        </div>
        
        <div class="form-buttons">
          <button type="button" class="btn btn-secondary" @click="cancel">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Creando...' : 'Crear Juego' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { GameService } from '../services/game.js'
import { useToast } from '../composables/useToast.js'
import { AuthService } from '../services/auth.js'

const router = useRouter()
const { addToast } = useToast()

const name = ref('')
const loading = ref(false)

const currentUser = AuthService.getCurrentUser()

const handleSubmit = async () => {
  if (!name.value.trim()) {
    addToast({ message: 'El nombre del juego es requerido', type: 'error' })
    loading.value = false
    return
  }

  loading.value = true

  try {
    const game = await GameService.createGame({
      name: name.value.trim(),
      ownerId: currentUser?.id,
      totalTime: 1200 // 20 minutes in seconds
    })
    addToast({ message: '¡Juego creado exitosamente!', type: 'success' })
    
    // Redirect to the game page after a short delay
    setTimeout(() => {
      router.push(`/owner/${game.id}`)
    }, 1500)
  } catch (error) {
    console.error('Error creating game:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    addToast({ message: `Error al crear el juego: ${errorMessage}`, type: 'error' })
  } finally {
    loading.value = false
  }
}

const cancel = () => {
  router.push('/dashboard')
}
</script>

<style scoped>
.create-game-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--background);
  padding: 20px;
}

.create-game-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.create-game-title {
  text-align: center;
  margin-bottom: 2rem;
  color: var(--text);
  font-size: 1.5rem;
  font-weight: 600;
}

.create-game-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 500;
  color: var(--text);
  font-size: 0.9rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--card-background);
  color: var(--text);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
}

.form-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--secondary);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--secondary-dark);
}
</style>