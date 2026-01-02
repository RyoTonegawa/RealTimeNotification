# Infrastructure stack

Docker Compose provisions:
- **postgres** (Aurora/Postgres compatible) with RLS policies applied from `backend/migrations/001_init.sql`.
- **redis** for Streams fan-out.
- **backend** NestJS service.
- **frontend** Next.js dashboard.

## Usage
```bash
cd infrastructure
docker compose up --build
```

シードデータは以下で投入できます（Transactional Outbox フローを模倣します）。

```bash
cd backend
DATABASE_URL=postgres://app:app@localhost:5432/app?sslmode=disable \\
TENANT_IDS=11111111-1111-1111-1111-111111111111 \\
npm run seed
```
