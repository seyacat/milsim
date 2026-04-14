# Milsim

Plataforma web de simulación militar (milsim) multijugador en tiempo real, basada en geolocalización GPS. Permite crear partidas por equipos con puntos de control, desafíos por proximidad, códigos y bombas con temporizador.

## Características

- Autenticación de usuarios con JWT
- Creación y gestión de partidas (rol owner)
- Seguimiento GPS de jugadores en vivo sobre mapa Leaflet
- Juego por equipos (2–4 equipos)
- Puntos de control con tres tipos de desafío:
  - **Posición**: captura por proximidad GPS
  - **Código**: captura al introducir un código
  - **Bomba**: activación/desactivación contrarreloj
- Temporizadores de partida y de bombas sincronizados
- Histórico de partidas y resultados
- Sincronización en tiempo real vía WebSocket (Socket.IO)
- PWA instalable

## Stack

**Backend**: NestJS 11 · TypeScript · TypeORM · MySQL/MariaDB · Socket.IO · JWT

**Frontend**: Vue 3 (Composition API) · Vite · Vue Router · Leaflet · socket.io-client

**Infraestructura**: AWS EC2 · Lambda (Serverless Framework) · Route 53 (`milsim.gato.click`)

## Estructura

```
milsim/
├── src/                    # Backend NestJS
│   ├── auth/               # Autenticación JWT + WebSocket
│   ├── games/              # Lógica de juego (services, handlers, entities)
│   ├── shared/             # Servicios globales
│   └── public/             # Frontend compilado (servido como estático)
├── frontend/               # SPA Vue 3 + Vite
│   └── src/{components,composables,services,types}
├── lambdas/start-instance/ # Lambda para arrancar EC2 bajo demanda
├── scripts/                # Utilidades (uptime, migraciones)
├── build-all.sh            # Compila backend + frontend
└── start.sh                # Arranque en producción (GNU screen)
```

## Requisitos

- Node.js 18+
- MySQL/MariaDB accesible
- npm

## Configuración

Crear un archivo `.env` en la raíz:

```env
DB_HOST=localhost
DB_USERNAME=root
DB_PASSWORD=tu_password
DB_DATABASE=milsim
PORT=6600
```

## Instalación

```bash
npm install
cd frontend && npm install && cd ..
```

## Desarrollo

En una terminal, arranca el backend con hot reload:

```bash
npm run dev
```

En otra, el frontend (Vite HTTPS con proxy a `:6600`):

```bash
cd frontend && npm run dev
```

## Migraciones de base de datos

```bash
npm run migration:generate   # Generar desde entidades
npm run migration:run        # Aplicar pendientes
npm run migration:revert     # Revertir la última
npm run migration            # Ciclo completo (destructivo)
```

## Build de producción

```bash
npm run build:all            # Compila backend y frontend, copia a src/public/
npm run start:prod           # Ejecuta el build
```

O directamente:

```bash
./build-all.sh
./start.sh
```

## Tests

```bash
npm test            # Unitarios
npm run test:e2e    # End-to-end
npm run test:cov    # Cobertura
```

## Despliegue

- **Backend**: ejecutándose en EC2 en el puerto `6600`, sirviendo el frontend estático.
- **Lambda** ([lambdas/start-instance/](lambdas/start-instance/)): despliega con `serverless deploy`. Arranca la instancia EC2 bajo demanda vía HTTP.
- **Dominio**: `milsim.gato.click` (Route 53 vía `serverless-domain-manager`).

## Rutas del frontend

| Ruta | Descripción |
|------|-------------|
| `/login` · `/register` | Acceso y registro |
| `/dashboard` | Lista y gestión de partidas |
| `/create-game` | Crear nueva partida |
| `/game/:gameId` | Interfaz principal (mapa + controles) |
| `/history` | Histórico y resultados |

## Licencia

Privado.
