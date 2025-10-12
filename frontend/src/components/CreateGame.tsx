import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameService } from '../services/game.js'
import { User } from '../types/index.js'
import { useToast } from '../contexts/ToastContext.js'

interface CreateGameProps {
  currentUser: User
}

const CreateGame: React.FC<CreateGameProps> = ({ currentUser }) => {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!name.trim()) {
      addToast({ message: 'El nombre del juego es requerido', type: 'error' })
      setLoading(false)
      return
    }

    try {
      const game = await GameService.createGame({
        name: name.trim(),
        ownerId: currentUser.id,
        totalTime: 1200 // 20 minutes in seconds
      })
      addToast({ message: '¡Juego creado exitosamente!', type: 'success' })
      
      // Redirect to the game page after a short delay
      setTimeout(() => {
        navigate(`/owner/${game.id}`)
      }, 1500)
    } catch (error) {
      console.error('Error creating game:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      addToast({ message: `Error al crear el juego: ${errorMessage}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const cancel = () => {
    navigate('/dashboard')
  }

  return (
    <div className="create-game-container">
      <div className="card create-game-card">
        <h1 className="create-game-title">Crear Nuevo Juego</h1>
        <form id="createGameForm" className="create-game-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">Nombre del Juego:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              className="form-input" 
              required 
              placeholder="Ingresa el nombre del juego"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="form-buttons">
            <button type="button" className="btn btn-secondary" onClick={cancel}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Juego'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGame