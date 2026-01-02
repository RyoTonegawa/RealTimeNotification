# NestJS SSE Backend

Implements transactional outbox + Redis Streams fan-out.

## Endpoints
- `GET /events?limit=50` initial fetch (requires `x-tenant-id`).
- `GET /sse?after=<cursor>` SSE stream; also honors `Last-Event-ID`.

## Worker
`OutboxWorkerService` polls the `outbox` table for each tenant and publishes events to Redis Streams. SSE consumers read from the stream and emit `id: <event_id>` lines.

## Commands
- `npm install`
- `npm run prisma:generate` (re-run when `prisma/schema.prisma` changes)
- `npm run migration:run`
- `npm run start:dev`
- `npm test`
