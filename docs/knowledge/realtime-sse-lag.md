# Realtime SSE Lag (ID: realtime-sse-lag)

## Summary
SSE クライアントがイベントを即時受信できず、ページ再読込が必要だった。原因はアウトボックスワーカーが `TENANT_IDS` 環境変数に空配列が渡された場合、どのテナントもポーリングしない設計だったことと、Redis publish + `published_at` 更新を単一トランザクションで行っていたため 5 秒超で失効しロックが残ったこと。

## Root Cause
- `OutboxWorkerService` は `TENANT_IDS` をループしながら `outbox` を `FOR UPDATE SKIP LOCKED` で取得していた。
- `TENANT_IDS` が未設定の環境では、ループ対象が空となり、Redis Streams へ `XADD` が一度も行われない。
- `TENANT_IDS` を設定しても、長時間 Redis への publish が詰まるとトランザクション失効 (timeout 5s) で `FOR UPDATE` ロックが保持されたまま次のループまで処理できず、SSE に最大 10s の遅延が生じた。

## Fix
1. `resolveTenants()` を追加し、環境変数が空の場合は `SELECT DISTINCT tenant_id FROM outbox` で動的にテナントを抽出するよう変更（`backend/src/services/outbox-worker.service.ts`）。
2. 未配信行の取得 (`SELECT ... FOR UPDATE SKIP LOCKED LIMIT n`) は短いトランザクション 1 回で行い、Redis publish/`published_at` 更新はレコード単位で個別トランザクションに分割。トランザクション失効によるロック長期保持を防止。

## Impact
- 3rd-party からの publish が Redis へ届かず、フロントは REST 再読込まで更新されない。
- 5〜10 秒の遅延が発生し、リアルタイムダッシュボードの要件を満たさない。

## Verification
- `npm run seed` を複数回実行し、ブラウザをリロードせずにイベントがリアルタイム反映されることを確認。
- SSE 接続ステータスが「接続中」のままリロード不要で増分が表示される。
