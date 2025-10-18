import React from 'react'
import { TeamColor } from '../types'

interface TeamSelectionProps {
  currentGame: any
  currentUser: any
  socket: any
  onTeamSelected: () => void
}

const TeamSelection: React.FC<TeamSelectionProps> = ({
  currentGame,
  currentUser,
  socket,
  onTeamSelected
}) => {
  // Get current player's team
  const currentPlayer = currentGame?.players?.find((p: any) => p?.user?.id === currentUser?.id)
  const currentTeam = currentPlayer?.team || 'none'

  // Available teams based on game team count
  const availableTeams: TeamColor[] = ['blue', 'red', 'green', 'yellow']
  const teamCount = currentGame?.teamCount || 2
  const teams = availableTeams.slice(0, teamCount)

  const selectTeam = (team: TeamColor) => {
    if (!socket || !currentGame || !currentUser) return

    // Find current player
    const player = currentGame.players?.find((p: any) => p?.user?.id === currentUser.id)

    // Close the popup immediately before sending the WebSocket request
    onTeamSelected()

    // Send team update via WebSocket
    socket.emit('gameAction', {
      gameId: currentGame.id,
      action: 'updatePlayerTeam',
      data: {
        playerId: player?.id,
        userId: currentUser.id,
        team: team
      }
    })
  }

  const getTeamButtonClass = (team: TeamColor) => {
    const baseClass = 'team-btn'
    const isActive = currentTeam === team
    return `${baseClass} ${team} ${isActive ? 'active' : ''}`
  }

  const getTeamDisplayName = (team: TeamColor) => {
    return team === 'none' ? 'NONE' : team.toUpperCase()
  }

  return (
    <div className="team-selection-overlay">
      <div className="team-selection-container">
        <div className="team-selection-header">
          <h4>Selecciona tu equipo:</h4>
          <button 
            className="team-selection-close"
            onClick={onTeamSelected}
          >
            ×
          </button>
        </div>
        <div className="team-buttons-container">
          {teams.map(team => (
            <button
              key={team}
              className={getTeamButtonClass(team)}
              onClick={() => selectTeam(team)}
            >
              {getTeamDisplayName(team)}
            </button>
          ))}
          <button
            className={getTeamButtonClass('none')}
            onClick={() => selectTeam('none')}
          >
            NONE
          </button>
        </div>
        <div className="current-team-info">
          Equipo actual: <strong>{getTeamDisplayName(currentTeam as TeamColor)}</strong>
        </div>
      </div>
    </div>
  )
}

export default TeamSelection