import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthService } from '../services/auth.js'
import { useToast } from '../contexts/ToastContext.js'

const Register: React.FC = () => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      addToast({ message: 'Las contraseñas no coinciden', type: 'error' })
      return
    }

    if (password.length < 6) {
      addToast({ message: 'La contraseña debe tener al menos 6 caracteres', type: 'error' })
      return
    }

    setLoading(true)

    try {
      await AuthService.register({ name, email, password })
      addToast({ message: '¡Cuenta creada exitosamente! Redirigiendo...', type: 'success' })
      
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (error) {
      addToast({ message: 'Error en registro: ' + (error as Error).message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-container">
      <div className="card register-card">
        <h1 className="register-title">Crear Cuenta</h1>
        <form id="registerForm" className="register-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Nombre:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              className="form-input" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Confirmar Contraseña:</label>
            <input 
              type="password" 
              id="confirmPassword" 
              name="confirmPassword" 
              className="form-input" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Cargando...' : 'Registrarse'}
          </button>
        </form>
        
        <div className="register-links">
          <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link></p>
        </div>
      </div>
    </div>
  )
}

export default Register