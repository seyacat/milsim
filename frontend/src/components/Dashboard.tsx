import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GameService } from '../services/game.js'
import { Game, User } from '../types/index.js'
import { useToast } from '../contexts/ToastContext.js'
import { AuthService } from '../services/auth.js'

interface DashboardProps {
  currentUser: User
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser }) => {
  // console.log('Dashboard: Renderizando con currentUser:', currentUser)
  const [, setGames] = useState<Game[]>([])
  const [allGames, setAllGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyOwnGames, setShowOnlyOwnGames] = useState(false)
  const navigate = useNavigate()
  const { addToast } = useToast()

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    try {
      const gamesData = await GameService.getGames()
      setGames(gamesData)
      setAllGames(gamesData)
    } catch (error) {
      addToast({ message: 'Error loading games: ' + (error as Error).message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortGames = (gamesList: Game[]) => {
    const filteredGames = gamesList.filter(game => {
      const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (game.description && game.description.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesOwnGames = !showOnlyOwnGames || isGameOwner(game)
      
      return matchesSearch && matchesOwnGames
    })
    
    filteredGames.sort((a, b) => {
      const connectionsA = a.activeConnections || 0
      const connectionsB = b.activeConnections || 0
      return connectionsB - connectionsA
    })
    
    return filteredGames.slice(0, 10)
  }

  const isGameOwner = (game: Game) => {
    if (!game.owner || !currentUser) {
      return false
    }
    return game.owner.id === currentUser.id
  }

  const deleteGame = async (gameId: number) => {
    if (!confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
      return
    }

    try {
      await GameService.deleteGame(gameId)
      addToast({ message: 'Game deleted successfully', type: 'success' })
      loadGames()
    } catch (error) {
      addToast({ message: 'Error deleting game: ' + (error as Error).message, type: 'error' })
    }
  }

  const enterGame = (game: Game) => {
    if (isGameOwner(game)) {
      navigate(`/owner/${game.id}`)
    } else {
      navigate(`/player/${game.id}`)
    }
  }

  const createGame = () => {
    navigate('/create-game')
  }

  const logout = () => {
    // console.log('Dashboard: Ejecutando logout...')
    AuthService.logout()
    // Forzar recarga para limpiar completamente el estado
    window.location.href = '/login'
  }

  const filteredGames = filterAndSortGames(allGames)

  if (loading) {
    return <div className="loading">Loading games...</div>
  }

  return (
    <div className="container">
      <div className="header flex justify-between items-center">
        <h1>Dashboard - Milsim Games</h1>
        <div className="flex gap-2">
          <button className="btn btn-success" onClick={createGame}>
            Create Game
          </button>
          <button className="btn btn-danger" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
      
      <div className="card">
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input
              type="text"
              placeholder="Search by name..."
              className="form-input"
              style={{ width: '100%' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={showOnlyOwnGames}
                onChange={(e) => setShowOnlyOwnGames(e.target.checked)}
              />
              <span style={{ fontSize: '12px' }}>Show only my games</span>
            </label>
          </div>
        </div>
        
        <div style={{ height: '1px', background: 'var(--border)', margin: '15px 0' }}></div>
        
        <div className="games-grid">
          {filteredGames.length === 0 ? (
            <div className="empty-state">No games match the filters</div>
          ) : (
            filteredGames.map(game => (
              <div key={game.id} className="game-card" onClick={() => enterGame(game)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{game.name}</span>
                  <span>Owner: {game.owner?.name || 'Unknown'}</span>
                  <span className={`status-${game.status}`}>Status: {game.status}</span>
                  <span>Players: {game.activeConnections || 0}</span>
                  {isGameOwner(game) ? (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteGame(game.id)
                      }}
                      title="Delete game"
                    >
                      🗑️
                    </button>
                  ) : <span></span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard