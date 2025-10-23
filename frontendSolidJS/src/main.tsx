import { render } from 'solid-js/web'
import { ErrorBoundary } from 'solid-js'
import { Router } from '@solidjs/router'

import App from './App'
import './styles/global.css'

// Solid Devtools - automatically attaches in development mode
if (process.env.NODE_ENV === 'development') {
  import('solid-devtools')
}


// Configurar captura global de errores
window.onerror = (msg, src, line, col, err) => {
  console.error('Error global capturado:', { msg, src, line, col, err })
  return false // Permitir que el error se propague normalmente
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('Promise rechazada no manejada:', event.reason)
  event.preventDefault()
})

console.log('Starting SolidJS application...')
const rootElement = document.getElementById('root')
console.log('Root element:', rootElement)

if (!rootElement) {
  console.error('Root element not found!')
} else {
  render(() => (
    <ErrorBoundary fallback={(err, reset) => (
      <div style={{
        padding: '20px',
        background: '#fee',
        color: '#900',
        border: '2px solid #f00',
        'font-family': 'monospace'
      }}>
        <h2>ERROR CRÍTICO EN LA APLICACIÓN</h2>
        <pre>{err.toString()}</pre>
        <details>
          <summary>Stack trace</summary>
          <pre>{err?.stack ?? 'No stack trace available'}</pre>
        </details>
        <button onClick={reset} style={{
          padding: '10px',
          background: '#900',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }}>
          Reintentar
        </button>
      </div>
    )}>
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  ), rootElement)
  console.log('SolidJS application rendered successfully')
}