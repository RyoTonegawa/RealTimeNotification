'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
    return events.reduce<Record<string, number>>((acc, evt) => {
      acc[evt.event_type] = (acc[evt.event_type] ?? 0) + 1;
      return acc;
    }, {});
  }, [events]);

  return (
    <section className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>リアルタイムダッシュボード</h1>
          <p>初回は REST で最新 50 件、その後は SSE で新着を受信します。</p>
        </div>
        <span className={`status status--${status}`}>
          {status === 'open' && '接続中'}
          {status === 'connecting' && '接続試行中'}
          {status === 'closed' && '切断'}
        </span>
      </header>

      <div className="dashboard__content">
        <article className="panel">
          <h2>イベントサマリ</h2>
          <ul>
            {Object.entries(summary).map(([type, count]) => (
              <li key={type}>
                <strong>{type}</strong>
                <span>{count} 件</span>
              </li>
            ))}
            {events.length === 0 && <li>まだイベントが届いていません。</li>}
          </ul>
        </article>

        <article className="panel">
          <h2>最新イベント</h2>
          <div className="event-stream">
            {events.map((event) => (
              <div key={event.event_id} className="event-card">
                <div className="event-card__meta">
                  <strong>{event.event_type}</strong>
                  <span>#{event.aggregate_id}</span>
                </div>
                <pre>{JSON.stringify(event.payload, null, 2)}</pre>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
