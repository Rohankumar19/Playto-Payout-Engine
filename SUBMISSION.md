# Playto Payout Engine — submission checklist (done in repo)

Use this to finish the official form: GitHub link, live URL, and a short “proud of” note.

## What is already in this repository

- Django + DRF API under `backend/`
- React + Vite + Tailwind UI under `frontend/`
- Ledger in paise (`BigIntegerField`), no floats
- Concurrency test + idempotency test + state machine + refund tests (`backend/payouts/tests/test_payouts.py`)
- `README.md` (setup, env, deployment hints)
- `EXPLAINER.md` (ledger, lock, idempotency, state machine, AI audit)
- `docker-compose.yml` (Postgres + Redis)
- Deployment stubs: `Procfile`, `railway.json`, `render.yaml`, `fly.toml`, Dockerfiles

## You must do (needs your accounts)

1. **Git + GitHub**
   - `git init` in the project root (if not already a repo)
   - Create a **public** GitHub repository
   - Push with a small number of **clear commits** (not one giant “dump”)

2. **Run tests locally (proof)**
   - See README “How to run tests”
   - Capture `pytest` output for your notes if useful

3. **Deploy (form asks for a live URL)**
   - **Railway / Render / Fly** (or similar): provision **PostgreSQL** + **Redis**
   - **Web**: Gunicorn (see `backend/Dockerfile` / `Procfile`)
   - **Worker**: `celery -A playto_payout_engine worker -l info` (on Windows in production, use Linux containers or a Linux worker)
   - **Beat**: `celery -A playto_payout_engine beat -l info`
   - Set env vars: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `REDIS_URL`, `CORS_ALLOWED_ORIGINS` (your frontend origin)
   - **Do not** set `USE_SQLITE_FOR_DEV` or `CELERY_TASK_ALWAYS_EAGER` in production
   - Run migrations on deploy
   - Seed: `POST https://<your-api>/api/v1/seed`
   - Deploy frontend (static) and point API URL if you change from localhost

4. **Form fields**
   - GitHub repo URL
   - Live deployment URL (API and/or app)
   - 3–5 lines: what you are most proud of (suggest: ledger + locking + idempotency + tests)

## Local demo mode (not for production)

For quick local setup without Docker/Postgres/Redis, you can use:

- `USE_SQLITE_FOR_DEV=True`
- `CELERY_TASK_ALWAYS_EAGER=True`

**The challenge expects real async jobs for production**; use Postgres + Redis + Celery worker/beat for the hosted deployment and mention that in the form note.
