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
- Frontend serwowany przez nginx na: http://localhost:8080
- Backend healthcheck: `curl http://localhost:8080/health` (przez nginx)
- Yjs WebSocket: `ws://localhost:4444` (mapowany z kontenera)

## 5) Tryb deweloperski (bez Dockera)
- Backend: `npm run dev` w `backend/` (port 3000)
- Frontend (prosty podgląd): aktualny `index.html` w katalogu głównym; dla produkcji: `npm run build` w `frontend/` i pliki w `frontend/dist`
- Yjs: `node yjs-server/server.js` (port 4444)

## 6) Testy manualne
- Wejdź na http://127.0.0.1:8089 (statyczny serwer z IDE) albo http://localhost:8080 (nginx)
- Załaduj pliki w aplikacji (obsługa drag&drop) i sprawdź podgląd
- Sprawdź współpracę w czasie rzeczywistym (otwórz app w 2 kartach, użyj YJS_WS_URL na ws://127.0.0.1:4444)
- Wywołaj API:
  - `POST /api/projects` (z Authorization Bearer jeżeli używasz Supabase)
  - `GET /api/projects/:id`
  - `POST /api/projects/:projectId/files` (multipart/form-data)

## 7) Electron (opcjonalnie)
- `ELECTRON_APP_URL=http://localhost:8080 npm start` w `electron/` aby odpalić natywną aplikację

## 8) Utrzymanie
- Zatrzymanie stacka: `docker compose down`
- Logi: `docker compose logs -f`
- Usunięcie wolumenów: `docker compose down -v`
