'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable } from '@/components/data-table';
import { cn } from '@/lib/utils';

export type EventItem = {
  id: number;
  event_id: string;
  event_type: string;
  aggregate_id: number;
  payload: Record<string, unknown>;
  created_at: string;
};

type Props = {
  initialEvents: EventItem[];
  initialCursor: string | null;
  tenantId: string;
  apiBaseUrl: string;
};

type ConnectionState = 'connecting' | 'open' | 'closed';

const statusLabel: Record<ConnectionState, string> = {
  connecting: '接続試行中',
  open: '接続中',
  closed: '切断',
};

const statusVariant: Record<ConnectionState, 'warn' | 'success' | 'destructive'> = {
  connecting: 'warn',
  open: 'success',
  closed: 'destructive',
};

const eventColumns: ColumnDef<EventItem>[] = [
  {
    accessorKey: 'event_type',
    header: 'イベント',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-slate-900">{row.original.event_type}</span>
        <span className="text-xs text-slate-500">#{row.original.aggregate_id}</span>
      </div>
    ),
  },
  {
    accessorKey: 'payload',
    header: 'ペイロード',
    cell: ({ row }) => (
      <code className="inline-flex max-w-xl overflow-hidden text-ellipsis rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
        {JSON.stringify(row.original.payload)}
      </code>
    ),
  },
  {
    accessorKey: 'created_at',
    header: '受信時刻',
    cell: ({ row }) => (
      <span className="text-sm text-slate-500">{formatTimestamp(row.original.created_at)}</span>
    ),
  },
];

export default function Dashboard({ initialEvents, initialCursor, tenantId, apiBaseUrl }: Props) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const cursorRef = useRef<string | null>(initialCursor);
  const deliveredIds = useRef<Set<string>>(new Set(initialEvents.map((evt) => evt.event_id)));

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tenantId', tenantId);
    if (cursorRef.current) {
      params.set('after', cursorRef.current);
    }
    const source = new EventSource(`${apiBaseUrl}/sse?${params.toString()}`);
    source.onopen = () => setStatus('open');
    source.onerror = () => setStatus('closed');

    const handler = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        const eventId = (evt.lastEventId || data.event_id) as string;
        if (eventId && deliveredIds.current.has(eventId)) {
          return;
        }
        deliveredIds.current.add(eventId);
        const aggregateId = Number(data.aggregate_id ?? data.id ?? 0);
        const payloadData =
          data && typeof data === 'object' && 'payload' in data ? (data.payload as Record<string, unknown>) : data;
        const next: EventItem = {
          id: aggregateId,
          aggregate_id: aggregateId,
          event_id: eventId,
          event_type: data.event_type ?? evt.type,
          payload: typeof payloadData === 'object' ? payloadData : { value: payloadData },
          created_at: new Date().toISOString(),
        };
        cursorRef.current = String(aggregateId);
        setEvents((prev) => [next, ...prev].slice(0, 200));
      } catch (error) {
        console.error('Failed to parse SSE payload', error);
      }
    };

    source.addEventListener('message', handler as EventListener);
    source.addEventListener('EventCreated', handler as EventListener);

    return () => {
      source.close();
      setStatus('closed');
    };
  }, [apiBaseUrl, tenantId]);

  const summary = useMemo(() => {
    const map = events.reduce<Record<string, number>>((acc, evt) => {
      acc[evt.event_type] = (acc[evt.event_type] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const latestPayload = events[0]?.payload ?? null;

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Realtime SSE Dashboard</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-slate-900">リアルタイムダッシュボード</h1>
          <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          初回は REST で最新 50 件、その後は SSE で新着を受信します。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>受信イベント</CardTitle>
            <CardDescription>現在メモリに保持している件数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold text-slate-900">{events.length}</div>
            <p className="mt-2 text-sm text-slate-500">最大 200 件までメモリ上に保持します。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最新イベント</CardTitle>
            <CardDescription>最後に受信した時刻</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">
              {events[0] ? formatTimestamp(events[0].created_at) : '—'}
            </div>
            {events[0] && (
              <p className="mt-2 text-sm text-slate-500">#{events[0].aggregate_id} / {events[0].event_type}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最新ペイロード</CardTitle>
            <CardDescription>直近に受信した JSON</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {latestPayload ? JSON.stringify(latestPayload, null, 2) : 'まだイベントが届いていません。'}
            </pre>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>イベントサマリ</CardTitle>
            <CardDescription>種類別受信件数</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <ul className="space-y-3">
                {summary.length === 0 && (
                  <li className="text-sm text-slate-500">まだイベントが届いていません。</li>
                )}
                {summary.map(([type, count]) => (
                  <li key={type} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{type}</span>
                    <span className="text-sm text-slate-500">{count} 件</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>最新イベント一覧</CardTitle>
                <CardDescription>REST で取得したデータ + SSE の増分を DataTable に表示します。</CardDescription>
              </div>
              <Badge variant="default">最大 200 件</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable columns={eventColumns} data={events} emptyMessage="まだイベントが届いていません。" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('ja-JP', {
    hour12: false,
  });
}
