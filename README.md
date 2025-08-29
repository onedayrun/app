bazując na readme.md i podlinkowanych dokumentach projektu wygeneruj i wykonaj liste TODO.md, aby stworzyć wszystkie pliki projektu, uruchomić i przetestować
dodaj ustawienia w .env portow i znmiennych
[uruchomienie E2E + logi] „Uruchom pełne testy E2E i w razie błędu zbierz docker compose ps/logs + curl /health.”
[diagnoza buildu] „Zbuduj obrazy backend/yjs/nginx z pełnymi logami i wskaż pierwszą przyczynę błędu.”
[logi usług] „Pokaż ostatnie 200 linii logów: postgres, backend, yjs-server, nginx.”
[health-check] „Sprawdź /health przez Nginx i bezpośrednio backend i wyjaśnij różnice.”
[naprawa] „Wprowadź poprawki, żeby backend startował, a prisma db push przechodził.”
[eksport] „Zaimplementuj /api/projects/:id/export (zamiast 501) i dodaj test E2E.”
[S3] „Dodaj/uruchom test uploadu do S3 (RUN_S3_TEST=1) i zdiagnozuj ewentualne błędy.”
[autoryzacja] „Dodaj testy E2E ścieżek wymagających Supabase (Bearer token).”
[CI] „Skonfiguruj GitHub Actions do automatycznych E2E na PR.”
[Electron] „Zakończ integrację Electron (port 8087) i dopisz instrukcje w README.”
