import { createSignal } from 'solid-js'
import { AuthService } from '../services/auth'
import { User } from '../types/index'
import { useToast } from '../contexts/ToastContext'

interface LoginProps {
  onLogin: (user: User) => void
}

export default function Login(props: LoginProps) {
  const { addToast } = useToast()
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await AuthService.login({
        email: email(),
        password: password()
      })
      
      props?.onLogin?.(response.user)
      addToast({ message: 'Inicio de sesión exitoso', type: 'success' })
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Login error:', error)
      addToast({ message: error instanceof Error ? error.message : 'Error al iniciar sesión', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="login-container">
      <div class="login-form">
        <h2>Iniciar Sesión</h2>
        <form onSubmit={handleSubmit}>
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
            {loading() ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        <p>
          ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
        </p>
      </div>
    </div>
  )
}