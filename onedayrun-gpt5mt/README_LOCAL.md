# Uruchomienie lokalne (skrót)

1. Skopiuj `.env.example` -> `.env` i uzupełnij
2. Zainstaluj zależności:
   - `npm i` w `backend/`, `yjs-server/`, `frontend/`, (opcjonalnie) `electron/`
3. Zbuduj i uruchom: `docker compose up -d --build`
4. Otwórz: http://localhost:8087 (nginx) lub http://127.0.0.1:8089 (serwer statyczny IDE)
5. Ustaw lokalny Yjs: w konsoli przeglądarki `localStorage.setItem('YJS_WS_URL', 'ws://127.0.0.1:4444')`

## Testy E2E (Docker + API + Frontend + Yjs)
- Instalacja: `cd e2e && npm install`
- Uruchom test: `npm run test`
- Utrzymaj stack po testach: `KEEP_STACK=1 npm run test`
- Tylko uruchomienie / zatrzymanie: `npm run up` / `npm run down`
