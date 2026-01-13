# Frontend (Next.js App Router)

- 初回アクセス時に `GET /events?limit=50` (Nest backend) を叩いて最新 50 件を取得します。
- 取得したカーソルを `EventSource("/sse?after=<cursor>&tenantId=<uuid>")` に渡し、Redis Streams 経由の新着イベントを SSE で受け取ります。

## 環境変数
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080          # ブラウザから見たバックエンド URL
NEXT_INTERNAL_API_BASE_URL=http://backend:8080          # (任意) SSR 用の内部 URL (Docker 利用時など)
NEXT_PUBLIC_TENANT_ID=11111111-1111-1111-1111-111111111111
```

## 開発
```bash
cd frontend
npm install
npm run dev
```
