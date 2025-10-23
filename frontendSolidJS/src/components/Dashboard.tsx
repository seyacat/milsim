import { createSignal, onMount, Show, For } from 'solid-js'
import { GameService } from '../services/game'
import { Game, User } from '../types/index'
import { useToast } from '../contexts/ToastContext'

interface DashboardProps {
  currentUser: User | null
}

export default function Dashboard(props: DashboardProps) {
  console.log('Dashboard component rendering, currentUser:', props?.currentUser)
  const { addToast } = useToast()
  const [games, setGames] = createSignal<Game[]>([])
  const [loading, setLoading] = createSignal(true)
  const [hasLoaded, setHasLoaded] = createSignal(false)

  onMount(() => {
    console.log('Dashboard onMount called')
    if (!hasLoaded()) {
      console.log('Loading games...')
      loadGames()
      setHasLoaded(true)
    }
  })

  const loadGames = async () => {
    try {
      console.log('Calling GameService.getGames()...')
      const gamesData = await GameService.getGames()
      console.log('Games data received:', gamesData)
      setGames(gamesData)
      console.log('Games state updated, games count:', games().length)
    } catch (error) {
      console.error('Error loading games:', error)
      addToast({ message: 'Error al cargar los juegos', type: 'error' })
    } finally {
      setLoading(false)
      console.log('Loading set to false')
    }
  }

  const handleCreateGame = () => {
    window.location.href = '/create-game'
  }

  const handleJoinGame = (gameId: number) => {
    window.location.href = `/player/${gameId}`
  }

  const handleManageGame = (gameId: number) => {
    window.location.href = `/owner/${gameId}`
  }

  console.log('Dashboard render - loading:', loading(), 'games count:', games().length)
  
  try {
    console.log("Dashboard rendering start")
    console.log("Games data:", games())
    console.log("Loading state:", loading())
    
    // Render simple de prueba
    return (
      <>
        <div style={{ background: 'red', color: 'white', padding: '20px', margin: '10px', 'z-index': 9999, position: 'relative' }}>
          TEST: Dashboard está renderizando - Si ves esto, el componente funciona
        </div>
        <div class="dashboard-container" style={{ background: 'white', padding: '20px', 'min-height': '100vh' }}>
          <div class="dashboard-header">
            <h1>Dashboard</h1>
            <div class="dashboard-actions">
              <button onClick={handleCreateGame}>Crear Juego</button>
            </div>
          </div>

          <Show when={!loading()} fallback={<div>Cargando juegos...</div>}>
            <div class="games-grid">
              <div style={{ background: 'yellow', padding: '10px', margin: '5px' }}>
                Games count: {games().length}
              </div>
              <For each={games()}>
                {(game) => (
                  <div class="game-card">
                    <h3>{game?.name || 'Juego sin nombre'}</h3>
                    <p>{game?.description || 'Sin descripción'}</p>
                    <p>Estado: <span class={`game-status status-${game?.status || 'unknown'}`}>{game?.status || 'unknown'}</span></p>
                    <p>Jugadores: {game?.activeConnections || 0}</p>
                    <div class="game-actions">
                      {game?.owner?.id === props?.currentUser?.id ? (
                        <button onClick={() => handleManageGame(game?.id)}>Gestionar</button>
                      ) : (
                        <button onClick={() => handleJoinGame(game?.id)}>Unirse</button>
                      )}
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </>
    )
  } catch (err) {
    console.error("Dashboard render error:", err)
    return <div style={{ color: "red" }}>Render error: {(err as Error).message}</div>
  }
}