# app
Use:
[index.html](index.html)

DO step by step:
[TODO.txt](TODO.txt)
 
## Local development (Docker Compose)
See: [README_LOCAL.md](README_LOCAL.md)

Ports (from `.env`):
- Nginx: http://localhost:8087
- Backend: http://127.0.0.1:9134
- Yjs WS: ws://127.0.0.1:4444

Makefile helpers:
- `make docker-ps` – status usług
- `make docker-health` – sprawdzenie /health przez Nginx i bezpośrednio backend
- `make e2e-install` – zależności e2e
- `make e2e-test` – pełne testy e2e
- `make e2e-test-keep` – testy e2e z pozostawieniem stacka

E2E quick start:
```bash
cd e2e
npm install
npm run test
# lub zachowaj stack po testach
KEEP_STACK=1 npm run test
```
and imporve based on:
[oneday-customer-cases.md](oneday-customer-cases.md)
[rclone-implementation-guide.md](rclone-implementation-guide.md)

