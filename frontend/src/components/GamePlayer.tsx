import React from 'react'
import { useParams } from 'react-router-dom'
import { User } from '../types/index.js'

interface GamePlayerProps {
  currentUser: User
}

const GamePlayer: React.FC<GamePlayerProps> = ({ currentUser }) => {
  const { gameId } = useParams<{ gameId: string }>()

  return (
    <div className="game-player">
      <h2>Game Player View</h2>
      <p>Game ID: {gameId}</p>
      <p>Player: {currentUser.name}</p>
      <p>Player functionality will be implemented here</p>
    </div>
  )
}

export default GamePlayer