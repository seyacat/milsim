# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Resumen del proyecto

**Milsim** es una plataforma web de juegos tácticos multijugador basada en ubicación GPS en tiempo real. Soporta equipos (2–4), puntos de control, desafíos por proximidad, desafíos por código y desafíos de bomba con temporizador.

## Arquitectura

Monorepo con backend monolítico y frontend SPA que se compila y sirve como estáticos.

- **Backend** ([src/](src/)): NestJS 11 + TypeScript + TypeORM + Socket.IO. Punto de entrada [src/main.ts](src/main.ts) (puerto `6600`). Sirve el frontend compilado desde [src/public/](src/public/) con fallback SPA.
- **Frontend** ([frontend/](frontend/)): Vue 3 (Composition API) + Vite + Leaflet + socket.io-client. Se compila a `src/public/`.
- **Lambdas** ([lambdas/start-instance/](lambdas/start-instance/)): Función Serverless Framework que arranca la instancia EC2 bajo demanda.
- **Base de datos**: MySQL/MariaDB vía TypeORM (migraciones).

### Módulos backend

- [src/auth/](src/auth/): JWT + bcrypt. Incluye [websocket-auth.service.ts](src/auth/websocket-auth.service.ts) para autenticación de sockets.
- [src/games/](src/games/): núcleo del juego. La lógica se reparte en 8 servicios dentro de [src/games/services/](src/games/services/) (timers, desafíos de posición, bombas, puntos de control, resultados, etc.) y handlers de WebSocket en [src/games/handlers/](src/games/handlers/).
- [src/shared/](src/shared/): `ConnectionTrackerService` y utilidades globales.

### Frontend

Rutas: `/login`, `/register`, `/dashboard`, `/create-game`, `/game/:gameId`, `/history`. Lógica encapsulada en composables: [useWebSocket](frontend/src/composables/useWebSocket.ts), [useMap](frontend/src/composables/useMap.ts), [useGPSTracking](frontend/src/composables/useGPSTracking.ts), timers de bombas y puntos de control, etc.

## Comandos clave

Backend (raíz):

```bash
npm run dev              # Hot reload
npm run build            # tsc -> dist/
npm run start:prod       # Ejecutar build
npm test                 # Jest
npm run migration:generate
npm run migration:run
npm run migration        # Ciclo completo: delete -> generate -> fix -> run
npm run build:all        # Backend + frontend -> src/public/
```

Frontend ([frontend/](frontend/)):

```bash
npm run dev              # Vite HTTPS en 0.0.0.0, proxy a :6600
npm run build            # Salida a ../src/public/
```

Producción: [start.sh](start.sh) (usa GNU screen, hace `git pull`, migra, compila y arranca).

## Variables de entorno

Definidas en `.env`: `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `PORT`.

## Infraestructura

- EC2 corriendo el proceso NestJS.
- Lambda ([lambdas/start-instance/serverless.yml](lambdas/start-instance/serverless.yml)) arranca la EC2 bajo demanda; redirige a `game.gato.click`.
- Dominio `milsim.gato.click` gestionado con `serverless-domain-manager`.

## Notas para Claude

- La lógica de juego está muy fragmentada en servicios; al modificar flujos del juego revisa tanto [games.service.ts](src/games/games.service.ts) como el servicio específico en [src/games/services/](src/games/services/) y el handler correspondiente en [src/games/handlers/](src/games/handlers/).
- El estado de posiciones de jugadores se mantiene en memoria en el gateway; los cambios de modelo requieren considerar tanto la persistencia (TypeORM) como la caché en memoria.
- El frontend se sirve como estáticos desde el backend en producción; tras cambios en frontend ejecuta `npm run build:all` o `./build-all.sh`.
- Hay un JWT secret hardcodeado en [auth.service.ts](src/auth/auth.service.ts) (`'your-secret-key'`) — tenerlo presente si se toca autenticación.
- Las migraciones se regeneran con `npm run migration` (flujo destructivo: borra migraciones y regenera). Evitar en producción.
- El backend de auth devuelve `access_token` dentro del cuerpo del response (no en el header `Authorization`); [auth.ts](frontend/src/services/auth.ts) lo lee del body con fallback al header.
- OSM solo sirve tiles hasta `z=19`. En [useMap.ts](frontend/src/composables/useMap.ts) se usa `maxZoom: 22` con `maxNativeZoom: 19` para que Leaflet escale los tiles en lugar de pedir 400.

## Pruebas con Playwright MCP

- Credenciales seed: `admin@admin.com` / `admin` (creadas por [scripts/seed-admin.ts](scripts/seed-admin.ts)). Para correr el seed: `npx ts-node scripts/seed-admin.ts` desde la raíz.
- Servir el frontend desde el backend en `http://localhost:6600` (no es necesario el dev de Vite). Tras editar componentes Vue ejecutar `npm run build` dentro de [frontend/](frontend/) para que los cambios aparezcan en `:6600`.
- Convención de accesibilidad para que `browser_snapshot` muestre nombres usables:
  - Botones con solo emoji **deben** llevar `aria-label` (Playwright ignora `title` para el "name" del rol).
  - Tarjetas/divs clicables (p. ej. `game-card`, `edit-pencil`) deben usar `role="button"`, `tabindex="0"`, `aria-label` y soportar `@keyup.enter` además de `@click`.
  - Inputs de auth llevan `autocomplete` (`email`, `current-password`, `new-password`, `name`) para evitar el warning de Chromium y para que el navegador pueda autocompletar.
- Si Vite falla con `esbuild` por mismatch de plataforma (p. ej. tras instalar dependencias en otro SO), correr `npm rebuild esbuild` dentro de [frontend/](frontend/) antes de `npm run build`.
- Errores 400 en `*.tile.openstreetmap.org/22/...` significan que se volvió a perder el `maxNativeZoom: 19` del tile layer.
