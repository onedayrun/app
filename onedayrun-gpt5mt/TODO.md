# TODO (Plan prac) — Oneday.run

Poniżej plan utworzenia pełnego środowiska (frontend, backend, yjs-server, nginx, electron) i uruchomienia lokalnie.

## 1) Wymagania wstępne
- Docker + Docker Compose
- Node.js 18 + npm
- (Opcjonalnie) Electron (zostanie zainstalowany przez `npm i` w `electron/`)

## 2) Konfiguracja środowiska
- Skopiuj `.env.example` do `.env` i uzupełnij klucze (Stripe, Supabase, AWS)
- Ustaw lokalny serwer współdzielenia (Yjs) w przeglądarce: `localStorage.setItem('YJS_WS_URL', 'ws://127.0.0.1:4444')` (już wspierane w `index.html`)

## 3) Instalacja zależności (lokalnie)
- backend: `npm install` w `backend/`
- yjs-server: `npm install` w `yjs-server/`
- frontend: `npm install` w `frontend/`
- electron (opcjonalnie): `npm install` w `electron/`

## 4) Budowa i uruchomienie (Docker Compose)
- Build: `docker compose build`
- Start: `docker compose up -d`
- Frontend serwowany przez nginx na: http://localhost:8087
- Backend healthcheck: `curl http://localhost:8087/health` (przez nginx)
- Yjs WebSocket: `ws://localhost:4444` (mapowany z kontenera)

## 5) Tryb deweloperski (bez Dockera)
- Backend: `npm run dev` w `backend/` (port 3000)
- Frontend (prosty podgląd): aktualny `index.html` w katalogu głównym; dla produkcji: `npm run build` w `frontend/` i pliki w `frontend/dist`
- Yjs: `node yjs-server/server.js` (port 4444)

## 6) Testy manualne
- Wejdź na http://127.0.0.1:8089 (statyczny serwer z IDE) albo http://localhost:8087 (nginx)
- Załaduj pliki w aplikacji (obsługa drag&drop) i sprawdź podgląd
- Sprawdź współpracę w czasie rzeczywistym (otwórz app w 2 kartach, użyj YJS_WS_URL na ws://127.0.0.1:4444)
- Wywołaj API:
  - `POST /api/projects` (z Authorization Bearer jeżeli używasz Supabase)
  - `GET /api/projects/:id`
  - `POST /api/projects/:projectId/files` (multipart/form-data)

## 7) Electron (opcjonalnie)
- `ELECTRON_APP_URL=http://localhost:8087 npm start` w `electron/` aby odpalić natywną aplikację

## 8) Utrzymanie
- Zatrzymanie stacka: `docker compose down`
- Logi: `docker compose logs -f`
- Usunięcie wolumenów: `docker compose down -v`

## 9) Testy E2E (Docker + API + Frontend + Yjs)
- Pliki: `e2e/run.ts`, `e2e/package.json`, `e2e/tsconfig.json`
- Wymagania: Docker + Docker Compose, Node 18
- Porty z `.env` (używane automatycznie): `NGINX_PORT=8087`, `YJS_PORT=4444`

### Uruchomienie
- Instalacja zależności: `cd e2e && npm install`
- Pełny test: `npm run test`
- Zatrzymanie stacka: `npm run down`
- Tylko uruchomienie stacka: `npm run up`
- Zachowanie stacka po testach: `KEEP_STACK=1 npm run test`

### Co jest sprawdzane
- `/health` (przez Nginx) i bezpośrednio backend
- Frontend (`/`)
- API: `POST /api/projects`, `GET /api/projects/:id`, 404 dla nieistniejącego projektu
- `GET /api/projects/:id/export` (501)
- Webhook Stripe (400 bez podpisu)
- Yjs WebSocket: bezpośrednio i przez Nginx (`/yjs`)
- (Opcjonalnie) Upload do S3: ustaw `RUN_S3_TEST=1`
