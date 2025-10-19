import React, { useState, useEffect } from 'react'
import { Game } from '../types'

interface GameResults {
  gameDuration: number
  teams: string[]
  controlPoints: Array<{
    name: string
    teamTimes: Record<string, number>
    teamCaptures: Record<string, number>
  }>
  teamTotals: Record<string, number>
  teamCaptureTotals: Record<string, number>
  playerCaptureStats: Array<{
    userName: string
    team: string
    codeCaptureCount: number
    positionCaptureCount: number
    bombDeactivationCount: number
    bombExplosionCount: number
  }>
  positionChallengeStats: {
    controlPoints: Array<{
      name: string
      teamPoints: Record<string, number>
    }>
    teamTotals: Record<string, number>
  }
}

interface GameResultsDialogProps {
  isOpen: boolean
  onClose: () => void
  currentGame: Game | null
  gameId: string | undefined
}

const GameResultsDialog: React.FC<GameResultsDialogProps> = ({
  isOpen,
  onClose,
  currentGame,
  gameId
}) => {
  const [results, setResults] = useState<GameResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && gameId) {
      loadGameResults()
    }
  }, [isOpen, gameId])

  const loadGameResults = async () => {
    if (!gameId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const token = localStorage.getItem('token')
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`/api/games/${gameId}/results`, {
        headers: headers
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error('Error al cargar resultados del juego: ' + response.status)
      }
      
      const resultsData = await response.json()
      setResults(resultsData)
    } catch (error) {
      console.error('Error loading game results:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="game-results-overlay" onClick={onClose}>
      <div className="game-results-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="game-results-header">
          <h3 className="game-results-title">Resumen del Juego</h3>
          <p className="game-results-subtitle">¡Juego Finalizado!</p>
        </div>
        
        <div className="game-results-content">
          {isLoading && (
            <div className="game-results-loading">
              Cargando resultados del juego...
            </div>
          )}
          
          {error && (
            <div className="game-results-error">
              {error}
            </div>
          )}
          
          {!isLoading && !error && results && (
            <>
              {/* Game Summary Section */}
              <div className="game-results-section">
                <h4 className="game-results-section-title">Resumen General</h4>
                <div className="game-results-table-container">
                  <table className="game-results-table">
                    <tbody>
                      <tr>
                        <td><strong>Duración:</strong></td>
                        <td>{formatDuration(results.gameDuration)}</td>
                      </tr>
                      <tr>
                        <td><strong>Jugadores:</strong></td>
                        <td>{currentGame?.players?.length || 0}</td>
                      </tr>
                      <tr>
                        <td><strong>Equipos:</strong></td>
                        <td>{currentGame?.teamCount || 2}</td>
                      </tr>
                      <tr>
                        <td><strong>Puntos de control:</strong></td>
                        <td>{currentGame?.controlPoints?.length || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Results Table */}
              {results.controlPoints && results.controlPoints.length > 0 && (
                <div className="game-results-section">
                  <h4 className="game-results-section-title">Resultados por Equipos</h4>
                  <div className="game-results-table-container">
                    <table className="game-results-table">
                      <thead>
                        <tr>
                          <th rowSpan={2}>Punto de Control</th>
                          {results.teams.map(team => (
                            <th key={team} colSpan={2}>
                              <div className="game-results-team">
                                <div className={`team-color ${team}`}></div>
                                {team.toUpperCase()}
                              </div>
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {results.teams.map(team => (
                            <React.Fragment key={team}>
                              <th>Tiempo</th>
                              <th>Tomados</th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.controlPoints.map(cp => (
                          <tr key={cp.name}>
                            <td>{cp.name}</td>
                            {results.teams.map(team => (
                              <React.Fragment key={team}>
                                <td>{formatTime(cp.teamTimes?.[team] || 0)}</td>
                                <td>{cp.teamCaptures?.[team] || 0}</td>
                              </React.Fragment>
                            ))}
                          </tr>
                        ))}
                        <tr className="totals-row">
                          <td><strong>TOTAL</strong></td>
                          {results.teams.map(team => (
                            <React.Fragment key={team}>
                              <td><strong>{formatTime(results.teamTotals?.[team] || 0)}</strong></td>
                              <td><strong>{results.teamCaptureTotals?.[team] || 0}</strong></td>
                            </React.Fragment>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Player Capture Statistics */}
              {results.playerCaptureStats && (
                <div className="game-results-section">
                  <h4 className="game-results-section-title">Resultados por Jugador</h4>
                  <div className="game-results-table-container">
                    <table className="game-results-table">
                      <thead>
                         <tr>
                           <th>Jugador</th>
                           <th>Equipo</th>
                           <th>Código</th>
                           <th>Presencia</th>
                           <th>Desactivaciones</th>
                           <th>Explosiones</th>
                         </tr>
                       </thead>
                       <tbody>
                         {results.playerCaptureStats
                           .sort((a, b) => (b.codeCaptureCount + b.positionCaptureCount) - (a.codeCaptureCount + a.positionCaptureCount))
                           .map(player => (
                             <tr key={player.userName}>
                               <td>{player.userName}</td>
                               <td>
                                 <div className="game-results-team">
                                   <div className={`team-color ${player.team}`}></div>
                                   {player.team.toUpperCase()}
                                 </div>
                               </td>
                               <td>{player.codeCaptureCount}</td>
                               <td>{player.positionCaptureCount}</td>
                               <td>{player.bombDeactivationCount || 0}</td>
                               <td>{player.bombExplosionCount || 0}</td>
                             </tr>
                           ))}
                       </tbody>
                    </table>
                  </div>
                </div>
              )}

            </>
          )}
        </div>
        
        <div className="game-results-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default GameResultsDialog