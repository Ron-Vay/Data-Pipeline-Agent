# Data Pipeline Agent

An agentic data pipeline that accepts a CSV URL, uses a local LLM to plan and execute cleaning transforms, and stores the results. Built to demonstrate agentic AI patterns in a backend data engineering context.

## How it works

1. User submits a CSV URL via `POST /jobs`
2. The worker fetches the data and infers the schema (column names, types, null counts)
3. The schema is handed to an **Ollama agent loop**: the LLM decides which transforms to apply by calling tools (`dedupe`, `drop_nulls`, `rename_columns`), receives the results of each call, and continues until it signals done
4. Cleaned rows are stored to Postgres as JSONB
5. User polls `GET /jobs/:id` for live progress, then fetches results from `GET /jobs/:id/results`

## Stack

| Layer | Choice |
|---|---|
| Backend | TypeScript + Express |
| Agent / LLM | Ollama (llama3.2) — local, free, tool-calling |
| Job queue | BullMQ + Redis |
| Database | PostgreSQL |
| Frontend | React + Vite + Tailwind CSS |
| Containerisation | Docker Compose |

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/) with `llama3.2` pulled (`ollama pull llama3.2`)
- Node.js 18+

## Getting started

```bash
# 1. Clone and install
git clone <repo-url>
cd data-pipeline-agent
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — defaults match docker-compose out of the box

# 3. Start Redis + Postgres
docker compose up -d

# 4. Start Ollama (if not already running as a service)
ollama serve

# 5. Start the API server
npm run dev

# 6. Start the frontend (separate terminal)
cd client && npm install && npm run dev
```

### Run tests

```bash
npm test
```

## API

### Submit a job

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/data.csv"}'
# → {"jobId": "1"}
```

### Poll progress

```bash
curl http://localhost:3000/jobs/1
# → {"id":"1","status":"active","progress":{"step":"transform","status":"transform: dedupe"},"failedReason":null,...}
```

Progress steps: `fetch_source` → `inspect_schema` → `transform` (one update per tool call) → `store`

### Fetch results

```bash
curl http://localhost:3000/jobs/1/results
# → {"results": [{...}, {...}]}
```

## Agent tools

The LLM can call any combination of these in any order:

| Tool | Description |
|---|---|
| `dedupe` | Remove duplicate rows |
| `drop_nulls` | Remove rows with any missing/empty values |
| `rename_columns` | Rename columns (e.g. fix abbreviations or casing) |
| `finish` | Signal that planning is complete |

## Project structure

```
src/
  index.ts      — Entry point: starts server and DB init
  app.ts        — Express app and route definitions (importable for tests)
  worker.ts     — BullMQ worker, pipeline orchestration, 2-min job TTL
  agent.ts      — Ollama agentic loop (schema in → cleaned rows out)
  tools.ts      — fetch_source, inspect_schema, transform, store
  utils.ts      — isAllowedUrl and other pure utilities
  db.ts         — pg connection pool, initDb
  queue.ts      — BullMQ queue + Redis connection
  types.ts      — Shared types
  __tests__/    — Jest test suites
client/
  src/App.tsx   — React frontend: submit form, live progress, results table
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_USER` | — | Postgres username (matches docker-compose: `pipeline`) |
| `POSTGRES_PASSWORD` | — | Postgres password |
| `POSTGRES_DB` | — | Postgres database name |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `llama3.2` | Model to use for planning |
