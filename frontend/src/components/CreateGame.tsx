import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameService } from '../services/game.js'
import { User } from '../types/index.js'
import { useToast } from '../contexts/ToastContext.js'

interface CreateGameProps {
  currentUser: User
}

const CreateGame: React.FC<CreateGameProps> = () => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [totalTime, setTotalTime] = useState(3600) // 1 hour in seconds
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await GameService.createGame({
        name,
        description,
        totalTime
      })
      addToast({ message: 'Game created successfully', type: 'success' })
      navigate('/dashboard')
    } catch (error) {
      addToast({ message: 'Error creating game: ' + error, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-game-container">
      <div className="create-game-form">
        <h2>Create New Game</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Game Name:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Description:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label>Game Duration (minutes):</label>
            <input
              type="number"
              value={totalTime / 60}
              onChange={(e) => setTotalTime(parseInt(e.target.value) * 60)}
              min="1"
              max="240"
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Game'}
            </button>
            <button 
              type="button" 
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGame