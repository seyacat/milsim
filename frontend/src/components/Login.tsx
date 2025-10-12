import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthService } from '../services/auth.js'
import { useToast } from '../contexts/ToastContext.js'

interface LoginProps {
  onLogin: (user: any) => void
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const submitLogin = async () => {
      try {
        const authResponse = await AuthService.login({ email, password })
        
        onLogin(authResponse.user)
        
        addToast({ message: 'Login exitoso', type: 'success' })
        
        try {
          navigate('/dashboard')
        } catch (navError) {
          console.error('Login: Error en navegación:', navError)
          // Si falla la navegación, intentar redirección forzada
          window.location.href = '/dashboard'
        }
        
      } catch (error) {
        console.error('Login: Error en login:', error)
        addToast({ message: 'Error en login: ' + (error as Error).message, type: 'error' })
      } finally {
        setLoading(false)
      }
    }

    submitLogin()
  }

  return (
    <div className="login-container">
      <div className="card login-card">
        <h1 className="login-title">Iniciar Sesión</h1>
        <form id="loginForm" className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              className="form-input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">Contraseña:</label>
            <input
              type="password"
              id="password"
              name="password"
              className="form-input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Cargando...' : 'Ingresar'}
          </button>
        </form>
        
        <div className="login-links">
          <p>¿No tienes cuenta? <Link to="/register">Regístrate aquí</Link></p>
        </div>
      </div>
    </div>
  )
}

export default Login