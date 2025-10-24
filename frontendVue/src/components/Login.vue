<template>
  <div class="login-container">
    <div class="card login-card">
      <h1 class="login-title">Iniciar Sesión</h1>
      <form id="loginForm" class="login-form" @submit.prevent="handleSubmit">
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
            v-model="password"
          />
        </div>
        
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Cargando...' : 'Ingresar' }}
        </button>
      </form>
      
      <div class="login-links">
        <p>¿No tienes cuenta? <router-link to="/register">Regístrate aquí</router-link></p>
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

const email = ref('')
const password = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true

  try {
    const authResponse = await AuthService.login({ 
      email: email.value, 
      password: password.value 
    })
    
    addToast({ message: 'Login exitoso', type: 'success' })
    
    try {
      await router.push('/dashboard')
    } catch (navError) {
      console.error('Login: Error en navegación:', navError)
      // Si falla la navegación, intentar redirección forzada
      window.location.href = '/dashboard'
    }
    
  } catch (error) {
    console.error('Login: Error en login:', error)
    addToast({ message: 'Error en login: ' + (error as Error).message, type: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--background);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.login-title {
  text-align: center;
  margin-bottom: 2rem;
  color: var(--text);
  font-size: 1.5rem;
  font-weight: 600;
}

.login-form {
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

.login-links {
  margin-top: 1.5rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.login-links a {
  color: var(--primary);
  text-decoration: none;
}

.login-links a:hover {
  text-decoration: underline;
}
</style>