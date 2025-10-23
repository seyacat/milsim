import { createSignal, onMount, Show } from 'solid-js'
import { Route, Navigate, useParams, Router } from '@solidjs/router'
import { AuthService } from './services/auth'
import { User } from './types/index'
import Login from './components/Login'
import Register from './components/Register'
import Dashboard from './components/Dashboard'
import CreateGame from './components/CreateGame'
import GameOwner from './components/GameOwner'
import GamePlayer from './components/GamePlayer'
import { ToastProvider } from './contexts/ToastContext'

// Componente wrapper para GameOwner que obtiene el gameId de los parámetros
function GameOwnerWrapper() {
  const params = useParams()
  return <GameOwner gameId={params.gameId} />
}

// Componente wrapper para GamePlayer que obtiene el gameId de los parámetros
function GamePlayerWrapper() {
  const params = useParams()
  return <GamePlayer gameId={params.gameId} />
}

function App() {
  const [currentUser, setCurrentUser] = createSignal<User | null>(null)
  const [loading, setLoading] = createSignal(true)

  onMount(() => {
    const user = AuthService.getCurrentUser()
    setCurrentUser(user)
    setLoading(false)
  })

  // Función para actualizar el usuario que se pasa a los componentes
  const handleLogin = (user: User) => {
    setCurrentUser(user)
  }

  return (
    <Show when={!loading()} fallback={
      <div class="loading">
        <div>Cargando Milsim...</div>
      </div>
    }>
      <Route path="/login" component={() =>
        currentUser() ? <Navigate href="/dashboard" /> : <Login onLogin={handleLogin} />
      } />
      
      <Route path="/register" component={() =>
        currentUser() ? <Navigate href="/dashboard" /> : <Register />
      } />
      
      <Route path="/dashboard" component={() =>
        currentUser() ? <Dashboard currentUser={currentUser()} /> : <Navigate href="/login" />
      } />
      
      <Route path="/create-game" component={() =>
        currentUser() ? <CreateGame currentUser={currentUser()} /> : <Navigate href="/login" />
      } />
      
      <Route path="/owner/:gameId" component={GameOwnerWrapper} />
      
      <Route path="/player/:gameId" component={GamePlayerWrapper} />
      
      <Route path="/" component={() =>
        <Navigate href={currentUser() ? "/dashboard" : "/login"} />
      } />
    </Show>
  )
}

function AppWrapper() {
  return (
    <ToastProvider>
      <Router>
        <App />
      </Router>
    </ToastProvider>
  )
}

export default AppWrapper