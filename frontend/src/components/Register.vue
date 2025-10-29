<template>
  <div class="register-container">
    <div class="card register-card">
      <h1 class="register-title">Crear Cuenta</h1>
      <form id="registerForm" class="register-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label for="name" class="form-label">Nombre:</label>
          <input 
            type="text" 
            id="name" 
            name="name" 
            class="form-input" 
            required
            v-model="name"
          />
        </div>
        
        <div class="form-group">
          <label for="email" class="form-label">Email:</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            class="form-input" 
            required
            v-model="email"
          />
        </div>
        
        <div class="form-group">
          <label for="password" class="form-label">Contraseña:</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            class="form-input" 
            required 
            minlength="6"
            v-model="password"
          />
        </div>
        
        <div class="form-group">
          <label for="confirmPassword" class="form-label">Confirmar Contraseña:</label>
          <input 
            type="password" 
            id="confirmPassword" 
            name="confirmPassword" 
            class="form-input" 
            required
            v-model="confirmPassword"
          />
        </div>
        
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Cargando...' : 'Registrarse' }}
        </button>
      </form>
      
      <div class="register-links">
        <p>¿Ya tienes cuenta? <router-link to="/login">Inicia sesión aquí</router-link></p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AuthService } from '../services/auth.js'
import { useToast } from '../composables/useToast.js'

const router = useRouter()
const { addToast } = useToast()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  if (password.value !== confirmPassword.value) {
    addToast({ message: 'Las contraseñas no coinciden', type: 'error' })
    return
  }

  if (password.value.length < 6) {
    addToast({ message: 'La contraseña debe tener al menos 6 caracteres', type: 'error' })
    return
  }

  loading.value = true

  try {
    await AuthService.register({ 
      name: name.value, 
      email: email.value, 
      password: password.value 
    })
    addToast({ message: '¡Cuenta creada exitosamente! Redirigiendo...', type: 'success' })
    
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (error) {
    addToast({ message: 'Error en registro: ' + (error as Error).message, type: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--background);
  padding: 20px;
}

.register-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.register-title {
  text-align: center;
  margin-bottom: 2rem;
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: 600;
}

.register-form {
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
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--card-background);
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary);
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

.register-links {
  margin-top: 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.register-links a {
  color: var(--primary);
  text-decoration: none;
}

.register-links a:hover {
  text-decoration: underline;
}
</style>