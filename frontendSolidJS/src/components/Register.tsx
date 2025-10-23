import { createSignal } from 'solid-js'
import { AuthService } from '../services/auth'
import { useToast } from '../contexts/ToastContext'

export default function Register() {
  const { addToast } = useToast()
  const [name, setName] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)

    try {
      await AuthService.register({
        name: name(),
        email: email(),
        password: password()
      })
      
      addToast({ message: 'Registro exitoso', type: 'success' })
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Register error:', error)
      addToast({ message: error instanceof Error ? error.message : 'Error al registrarse', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="register-container">
      <div class="register-form">
        <h2>Registrarse</h2>
        <form onSubmit={handleSubmit}>
          <div class="form-group">
            <label for="name">Nombre:</label>
            <input
              type="text"
              id="name"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              required
            />
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              required
            />
          </div>
          <div class="form-group">
            <label for="password">Contraseña:</label>
            <input
              type="password"
              id="password"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading()}>
            {loading() ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        <p>
          ¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a>
        </p>
      </div>
    </div>
  )
}