import { createSignal } from 'solid-js'
import { GameService } from '../services/game'
import { User } from '../types/index'
import { useToast } from '../contexts/ToastContext'

interface CreateGameProps {
  currentUser: User | null
}

export default function CreateGame(props: CreateGameProps) {
  const { addToast } = useToast()
  const [name, setName] = createSignal('')
  const [description, setDescription] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setLoading(true)

    try {
      const game = await GameService.createGame({
        name: name(),
        description: description(),
        ownerId: props.currentUser?.id
      })
      
      addToast({ message: 'Juego creado exitosamente', type: 'success' })
      window.location.href = `/owner/${game.id}`
    } catch (error) {
      console.error('Create game error:', error)
      addToast({ message: error instanceof Error ? error.message : 'Error al crear el juego', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div class="dashboard-container">
      <h1>Crear Nuevo Juego</h1>
      <form onSubmit={handleSubmit} style="max-width: 500px; margin-top: 2rem;">
        <div class="form-group">
          <label for="name">Nombre del Juego:</label>
          <input
            type="text"
            id="name"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            required
          />
        </div>
        <div class="form-group">
          <label for="description">Descripción:</label>
          <textarea
            id="description"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            rows="4"
          />
        </div>
        <button type="submit" disabled={loading()}>
          {loading() ? 'Creando juego...' : 'Crear Juego'}
        </button>
      </form>
    </div>
  )
}