# Server-Sent Events Stack (Aurora + NestJS + Next.js)

Reference implementation matching the new requirements:
- Aurora/PostgreSQL (via local Postgres) with Row-Level Security only.
- Transactional outbox pattern writing to Redis Streams.
- NestJS backend exposing REST (`/events`) + SSE (`/sse`).
- Next.js frontend: initial 50 rows via REST, then SSE for new arrivals.

## Project layout
- `backend/` – NestJS service + migrations + Jest tests.
- `frontend/` – Next.js App Router dashboard.
- `infrastructure/` – Docker Compose for Postgres, Redis, backend, frontend.
- `requriements.md` – architecture brief in Japanese.

## Quick start
```bash
cd backend
npm install
npm run migration:run
npm run seed  # optional sample data

cd ../frontend
npm install

cd ../infrastructure
docker compose up --build
```

Use `curl -H "x-tenant-id: <uuid>" http://localhost:3001/events?limit=50` for manual verification.
