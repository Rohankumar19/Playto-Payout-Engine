# Playto Payout Engine

Production-grade payout engine with integer money accounting, transaction-safe payout creation, DB-backed idempotency, and asynchronous processing.

## Project overview
- Ledger-first accounting (credits/debits/holds/refunds) for full auditability.
- Payout creation guarded by DB row-locking (`select_for_update`) to prevent overdraft.
- Idempotency key scoped to merchant with 24-hour expiry.
- Celery worker simulates payout outcomes and retry behavior.
- React dashboard provides merchant summary, ledger, payout form, and payout history.

## Architecture decisions
- Money is stored only as paise (`BigIntegerField`), no floats.
- State machine is explicit in model (`transition_to`) to prevent invalid status transitions.
- Atomic transactions protect coupled changes: payout status + ledger effects.
- Balance is computed from ledger using DB aggregation, not in-memory sums.

## Setup instructions
1. Start PostgreSQL and Redis (e.g. Docker).
2. Backend:
   - `cd backend`
   - create venv + activate
   - `pip install -r requirements.txt`
   - set env vars (see below)
   - `python manage.py migrate`
   - `python manage.py runserver`
3. Seed sample data:
   - `POST /api/v1/seed`
4. Worker:
   - `celery -A playto_payout_engine worker -l info`
   - `celery -A playto_payout_engine beat -l info`
5. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`

## Env variables
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL`
- `REDIS_URL`
- `CORS_ALLOWED_ORIGINS`
- `USE_SQLITE_FOR_DEV` (set `True` to run without PostgreSQL)
- `CELERY_TASK_ALWAYS_EAGER` (set `True` to run tasks in-process without Redis worker)

## How to run tests
- `cd backend`
- `pytest`

## Deployment notes
- Railway/Render/Fly:
  - deploy backend web process
  - deploy separate Celery worker process
  - deploy separate Celery beat process
  - provision PostgreSQL + Redis
  - run migrations on deploy
  - use included templates: `railway.json`, `render.yaml`, `fly.toml`, `Procfile`
