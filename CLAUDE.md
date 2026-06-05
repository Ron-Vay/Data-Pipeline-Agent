# Data Pipeline Agent

## What it does
User submits a data source URL (CSV, JSON API, RSS feed). The agent fetches it, inspects the shape, plans a transformation pipeline, executes each step using tools, and stores the cleaned output. User can monitor job progress in real time.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | TypeScript + Express | Consistent with prior projects |
| Agent / LLM | Ollama (llama3.2) | Free, local, supports tool use |
| Job queue | BullMQ + Redis | Production-grade async job handling |
| DB | PostgreSQL | Consistent with prior projects |
| Frontend | React + Vite + Tailwind CSS | Consistent with prior projects |
| Containerisation | Docker Compose | Redis + Postgres as sidecars |

## Architecture

### Core agent loop
1. User submits URL → job created, ID returned immediately (async)
2. Agent fetches source
3. Agent inspects shape (columns, types, nulls)
4. Agent plans transformation steps
5. Agent executes each step as a tool call
6. Cleaned data stored to Postgres
7. Job status updated at each step
8. User polls `/jobs/:id` for progress

### Agent tools
- `fetch_source` — fetches raw data from URL
- `inspect_schema` — infers column names, types, null counts
- `transform` — applies a named transformation (`dedupe`, `drop_nulls`, `rename_columns`)
- `store` — writes cleaned rows to Postgres

### API endpoints
- `POST /jobs` — submit a URL, get a job ID back
- `GET /jobs/:id` — poll job status and step-by-step progress
- `GET /jobs/:id/results` — fetch cleaned data once complete

### Frontend
- URL submission form
- Live job progress view (polling every 2s)
- Results table once complete

## Build order
1. ✅ Docker Compose with Redis + Postgres
2. ✅ BullMQ job queue wired to Express
3. ✅ Basic agent loop with hardcoded steps (no LLM yet)
4. ✅ Tool implementations (`fetch_source`, `inspect_schema`, `transform`, `store`)
5. ✅ Ollama integration — dynamic transform planning via tool-calling loop
6. ✅ Security hardening + code quality (URL validation, batch insert, SSRF protection)
7. ✅ Tests (Jest + ts-jest + supertest, 53 tests across utils/tools/api/agent/worker)
8. ✅ Worker error event handler — prevents silent process crash on BullMQ connection errors
9. ✅ GitHub Actions CI — runs `npm test` on every push
10. ✅ Frontend (React + Vite + Tailwind CSS)

## Current state
Steps 1–10 complete. The full pipeline runs end-to-end with live AI planning:
- `POST /jobs` validates the URL, enqueues a job, returns the job ID
- Worker runs `fetchSource → inspectSchema → runAgent → store`, wrapped in a 2-minute TTL (`withTimeout`)
- `runAgent` sends the schema to Ollama (llama3.2) with tool definitions; the model calls transforms
  (`dedupe`, `drop_nulls`, `rename_columns`) as tool calls; results are fed back each turn; loop
  continues until the model calls `finish()` or makes no further tool calls (max 10 turns)
- Bad LLM tool calls (e.g. `rename_columns` without `mapping`) return `{ success: false, error }` to the model instead of crashing the job
- Per-step progress tracked via `job.updateProgress` and exposed on `GET /jobs/:id`
- Cleaned rows stored to Postgres as JSONB in `pipeline_results` table
- `GET /jobs/:id/results` returns cleaned rows
- `GET /jobs/:id` includes `failedReason` for debugging failed jobs
- DB pool has `query_timeout: 10s` and `connectionTimeoutMillis: 5s` so hung queries fail fast
- DB credentials (`pipeline/pipeline/pipeline`) via `.env` / `dotenv`

## Infrastructure notes
- Postgres is `postgres` image listening on container port 5432, mapped to host port 5434
- If the container was created with the wrong port mapping, run `docker compose down && docker compose up -d` to recreate it
- Uses `pg` (node-postgres) not `postgres` (postgres.js) — postgres.js hangs on Node.js v22 + Docker Desktop Windows
- `dotenv/config` must be the first import in `index.ts` so env vars load before the pg pool is created
- `app.ts` holds the Express setup with no side effects so tests can import it safely; `index.ts` is the entry point only (calls `listen` + `initDb`)
- Run tests with `npm test` (Jest + ts-jest, no external services needed — queue and DB are mocked)

## Frontend (client/)
- Vite + React + TypeScript + Tailwind CSS in `client/`
- Dev server proxies `/jobs` to `http://localhost:3000` — no CORS config needed during development
- `npm run dev` inside `client/` to start the frontend
- Three views: URL submission form → live progress (polling every 2 s) → results table

## Why it's résumé-worthy
- Demonstrates agentic AI patterns (plan → tool call → observe → next step)
- Async job handling with status polling
- Tool use / function calling with a real AI model
- End-to-end data flow from raw source to structured storage
- Directly relevant to data engineering and backend AI roles
