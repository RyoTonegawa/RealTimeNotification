# Codex指示書: Aurora(PostgreSQL)+RLS最小・Transactional Outbox + Redis Streams + NestJS SSE + Next.js 初回50件→新着SSE

## 目的
現状 30s ショートポーリングで取得している「新着データ」を、よりリアルタイムにする。
- ユーザがページ初回アクセス時は **Aurora(PostgreSQL)から最新50件** を取得
- 以後は **SSE(Server-Sent Events)** で **新着のみ** を受信して画面へ追加
- **整合性**（DB書き込みとイベント発行の原子性）を担保し、**二重配信を実質ゼロ**（重複排除可能）にする
- DBロジックは最小化し、**DB側のロジックはRLSのみ**（trigger/NOTIFY/関数などは禁止）

## 前提/制約
- Aurora PostgreSQL（ローカルはDockerのPostgresで代替）
- 書き込み元は本番ではLambdaだが、ローカル/CIでは疑似Lambda（スクリプト）で再現してよい
- バックエンド: NestJS
- フロントエンド: Next.js
- Redis利用（SSEの新着配信は **Redis Streams推奨**）
- Multi-tenant想定: `tenant_id` を必ず持ち、RLSで分離
- **DBにはRLS以外のロジックを入れない**  
  - ✅ OK: テーブル定義、インデックス、ユニーク制約、RLS policy  
  - ❌ NG: trigger、LISTEN/NOTIFY、ストアド関数/プロシージャ、DBでのイベント生成ロジック

## アーキテクチャ概要
### Write（疑似Lambda / 本番Lambda）
1. トランザクション開始
2. `SET LOCAL app.tenant_id = '<tenant_uuid>'`（RLS用）
3. `events` にINSERT
4. 同一Txで `outbox` にINSERT（Transactional Outbox）
   - `event_id`（ULIDなど）を付与し **UNIQUE制約** で冪等性
5. commit

### Publish（NestJS内 Worker もしくは別プロセス）
1. `outbox` から `published_at IS NULL` の行を一定数取得
   - `FOR UPDATE SKIP LOCKED` を使って多重起動でも競合しないようにする
2. Redis Streams へ `XADD`（event_idを必ず含める）
3. `outbox.published_at = now()` に更新して確定

### Deliver（NestJS SSE）
- SSEエンドポイント `/sse`
- クエリ `after=<cursor>` を受け取る（初回50件取得後の続き）
- 再接続時は `Last-Event-ID` ヘッダを優先して追従
- Redis Streamsから **after/last_event_id 以降** のイベントのみを読み、SSEで配信
- SSEメッセージには必ず `id: <event_id>` を付ける（クライアント側で重複排除できるように）

### Read（初回）
- REST API `/events?limit=50`
- `ORDER BY id DESC LIMIT 50`
- レスポンスに `cursor`（最新id or 最新event_id）を含める
- フロントは `EventSource("/sse?after=<cursor>")` で接続し、新着のみ受信

## データモデル（DDL要件）
### events
- `id` は単調増加（BIGSERIAL）推奨（初回50件・並びの安定のため）
- `tenant_id UUID NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- 必要なpayload列（例: `message`, `type` など）を追加

### outbox
- `id BIGSERIAL PK`
- `tenant_id UUID NOT NULL`
- `event_id TEXT NOT NULL`（ULID推奨）
- `event_type TEXT NOT NULL`（例: "EventCreated"）
- `aggregate_id BIGINT NOT NULL`（events.id）
- `payload JSONB NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `published_at TIMESTAMPTZ NULL`
- `UNIQUE(tenant_id, event_id)`（冪等性・二重登録防止）

### RLS
- `events` と `outbox` 両方で有効化
- `tenant_id = current_setting('app.tenant_id', true)::uuid` で絞る
- アプリ（Nest/疑似Lambda）はクエリ前に `SET LOCAL app.tenant_id = '...'` を必ず実行

## Redis Streams要件
- Stream key: `stream:events:{tenant_id}` など tenantごとに分ける（RLS思想に合わせる）
- `XADD` に `event_id`, `event_type`, `aggregate_id`, `payload` を入れる
- SSE側は `XREAD BLOCK` で待機し、イベント到着次第配信

## “二重配信”の扱い（必須）
- 分散環境では at-least-once は避けづらい
- **event_id** をキーにして重複排除できるように実装する
  - DB: `UNIQUE(tenant_id, event_id)`で outbox の二重登録を防止
  - SSE: `id: event_id` を付ける
  - Client: `lastSeenEventId` を保持し、重複は無視（もしくはサーバ側で last_event_id 以降のみ送る）

## 実装タスク（Codexが作るもの）
### 1) ローカル環境
- `docker-compose.yml` を用意
  - postgres
  - redis
  - nest
  - next
- DBマイグレーション（SQL or Prisma/TypeORMどちらでも可）
  - ただし「DBロジック最小」方針に反しない構成で

### 2) NestJS
#### REST: 初回50件
- `GET /events?limit=50`
- tenantはヘッダ `x-tenant-id`（仮）で受け、DB接続で `SET LOCAL app.tenant_id` を実行
- レスポンス:
  - `items`（id降順）
  - `cursor`（返した items の最大id もしくは最新イベントの識別子）

#### Worker: Outbox Publisher
- ポーリング間隔（例: 200ms〜1s）で outbox を読む
- 取得クエリは `FOR UPDATE SKIP LOCKED` を使う
- Redis Streamsへ `XADD`
- DBへ `published_at` 更新
- tenantは「テナント一覧」を別テーブルで持つか、環境変数でリスト指定でも良い（CI簡略化可）
  - 例: `TENANT_IDS=uuid1,uuid2`

#### SSE: 新着配信
- `GET /sse?after=<cursor>`
- `Last-Event-ID` があればそれを優先
- Redis Streamsから after以降のイベントを読み、SSEで送る
- 15秒ごとに heartbeat（コメント行 `: ping\n\n`）を送る
- 適切なヘッダ:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`

### 3) Next.js
- 初回ロードで `/events?limit=50` を呼び `cursor` を取得
- `EventSource("/sse?after="+cursor)` で接続
- 受け取ったイベントを state に追加
- `event.id` で重複排除

### 4) CIでのテスタビリティ（必須）
- Jest
