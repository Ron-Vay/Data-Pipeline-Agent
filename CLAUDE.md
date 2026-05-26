# Data Pipeline Agent

## What it does
User submits a data source URL (CSV, JSON API, RSS feed). The agent fetches it, inspects the shape, plans a transformation pipeline, executes each step using tools, and stores the cleaned output. User can monitor job progress in real time.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | TypeScript + Express | Consistent with prior projects |
| Agent / LLM | Ollama (llama3.1 or similar) | Free, local, supports tool use |
| Job queue | BullMQ + Redis | Production-grade async job handling |
| DB | PostgreSQL | Consistent with prior projects |
| Frontend | React + Vite + shadcn/ui | Consistent with prior projects |
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
- `transform` — applies a named transformation (`dedupe`, `drop_nulls`, `rename_columns`, `cast_types`)
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
5. Wire in Ollama for dynamic planning
6. Frontend

## Current state
Steps 1–4 complete. The full pipeline runs end-to-end:
- `POST /jobs` validates the URL, enqueues a job, returns the job ID
- Worker runs `fetchSource → inspectSchema → transform (dedupe + drop_nulls) → store`
- Per-step progress tracked via `job.updateProgress` and exposed on `GET /jobs/:id`
- Cleaned rows stored to Postgres as JSONB in `pipeline_results` table
- DB credentials via `.env` / `dotenv`
- `GET /jobs/:id/results` endpoint not yet implemented

Next: wire in Ollama to replace hardcoded transforms with dynamic planning based on the schema.

## Why it's résumé-worthy
- Demonstrates agentic AI patterns (plan → tool call → observe → next step)
- Async job handling with status polling
- Tool use / function calling with a real AI model
- End-to-end data flow from raw source to structured storage
- Directly relevant to data engineering and backend AI roles
