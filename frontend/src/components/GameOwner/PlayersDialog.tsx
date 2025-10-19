import React, { useState, useEffect } from 'react'
import { Player, TeamColor } from '../../types'

interface PlayersDialogProps {
  isOpen: boolean
  onClose: () => void
  players: Player[]
  currentGameId: number
  socket: any
  teamCount: number
  onTeamCountChange: (count: number) => void
}

const PlayersDialog: React.FC<PlayersDialogProps> = ({
  isOpen,
  onClose,
  players,
  currentGameId,
  socket,
  teamCount,
  onTeamCountChange
}) => {
  const [playersData, setPlayersData] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load players data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadPlayersData()
    }
  }, [isOpen])

  // Update players data when props change
  useEffect(() => {
    if (players) {
      setPlayersData([...players].sort((a, b) =>
        (a.user?.name || '').localeCompare(b.user?.name || '')
      ))
    } else {
      setPlayersData([])
    }
  }, [players])

  const loadPlayersData = () => {
    setIsLoading(true)
    // In the React version, we already have players data from props
    // This function is kept for consistency with the old system
    setIsLoading(false)
  }

  const updatePlayerTeam = (playerId: number, team: TeamColor) => {
    if (socket && currentGameId) {
      socket.emit('gameAction', {
        gameId: currentGameId,
        action: 'updatePlayerTeam',
        data: {
          playerId,
          team
        }
      })
    }
  }

  const createTeamButtons = (player: Player) => {
    const teams: TeamColor[] = (['blue', 'red', 'green', 'yellow'] as TeamColor[]).slice(0, teamCount)
    const buttons = []

    // Add team buttons
    teams.forEach(team => {
      const isActive = player.team === team
      buttons.push(
        <button
          key={team}
          className={`team-btn ${team} ${isActive ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            updatePlayerTeam(player.id, team)
          }}
        >
          {team.toUpperCase()}
        </button>
      )
    })

    // Add "none" button
    const isNoneActive = player.team === 'none'
    buttons.push(
      <button
        key="none"
        className={`team-btn none ${isNoneActive ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          updatePlayerTeam(player.id, 'none')
        }}
      >
        NONE
      </button>
    )

    return buttons
  }

  const handleTeamCountChange = (count: number) => {
    onTeamCountChange(count)
  }

  if (!isOpen) return null

  return (
    <div className="teams-dialog-overlay" onClick={onClose}>
      <div className="teams-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="teams-dialog-header">
          <h3>Gestión de Equipos</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="teams-dialog-content">
          {/* Team count selector */}
          <div className="team-count-selector">
            <h4>Número de Equipos:</h4>
            <div className="team-count-buttons">
              {[2, 3, 4].map(count => (
                <button
                  key={count}
                  className={`team-count-btn ${teamCount === count ? 'active' : ''}`}
                  onClick={() => handleTeamCountChange(count)}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Players list */}
          <div className="players-list-section">
            <h4>Jugadores:</h4>
            <div className="players-list">
              {isLoading ? (
                <div className="loading">Cargando jugadores...</div>
              ) : playersData.length === 0 ? (
                <div className="no-players">No hay jugadores en el juego</div>
              ) : (
                playersData.map(player => (
                  <div key={player.id} className="player-row">
                    <div className="player-name">
                      {player.user?.name || 'Jugador'}
                    </div>
                    <div className="player-teams">
                      {createTeamButtons(player)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PlayersDialog