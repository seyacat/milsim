import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthService } from './services/auth.js'
import { User } from './types/index.js'
import Login from './components/Login.js'
import Register from './components/Register.js'
import Dashboard from './components/Dashboard.js'
import CreateGame from './components/CreateGame.js'
import GameOwner from './components/GameOwner.js'
import GamePlayer from './components/GamePlayer.js'
import { ToastProvider } from './contexts/ToastContext.js'

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('App: useEffect inicial - obteniendo usuario actual')
    const user = AuthService.getCurrentUser()
    console.log('App: Usuario obtenido:', user)
    setCurrentUser(user)
    setLoading(false)
  }, [])

  // Función para actualizar el usuario que se pasa a los componentes
  const handleLogin = (user: User) => {
    console.log('App: handleLogin llamado con usuario:', user)
    setCurrentUser(user)
  }

  if (loading) {
    return (
      <div className="loading">
        <div>Cargando Milsim...</div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route 
            path="/login"
            element={
              currentUser ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />
            }
          />
          <Route
            path="/register"
            element={
              currentUser ? <Navigate to="/dashboard" replace /> : <Register />
            }
          />
          <Route
            path="/dashboard"
            element={
              currentUser ? <Dashboard currentUser={currentUser} /> : <Navigate to="/login" replace />
            }
          />
          <Route 
            path="/create-game" 
            element={
              currentUser ? <CreateGame currentUser={currentUser} /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/owner/:gameId" 
            element={
              currentUser ? <GameOwner currentUser={currentUser} /> : <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/player/:gameId" 
            element={
              currentUser ? <GamePlayer currentUser={currentUser} /> : <Navigate to="/login" replace />
            } 
          />
          <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  )
}

export default App