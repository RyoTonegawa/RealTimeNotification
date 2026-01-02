import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type EventRecord = {
  id: number;
  event_id: string;
  event_type: string;
  aggregate_id: number;
  payload: any;
  created_at: string;
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async fetchLatest(tenantId: string, limit = 50) {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.outbox.findMany({
        orderBy: { aggregateId: 'desc' },
        take: Number(limit),
        include: { event: true },
      }),
    );

    const items: EventRecord[] = rows.map((row) => ({
      id: Number(row.aggregateId),
      event_id: row.eventId,
      event_type: row.eventType,
      aggregate_id: Number(row.aggregateId),
      payload: row.payload as any,
      created_at: row.event?.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    const cursor = items.length > 0 ? String(items[0].id) : null;
    return { items, cursor };
  }

  async resolveAggregateId(tenantId: string, eventId: string): Promise<number | null> {
    const result = await this.prisma.withTenant(tenantId, (tx) =>
      tx.outbox.findFirst({
        where: { eventId },
        select: { aggregateId: true },
      }),
    );
    return result ? Number(result.aggregateId) : null;
  }

  async insertEvent(tenantId: string, payload: Record<string, unknown>, eventType = 'EventCreated') {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const event = await tx.event.create({
        data: {
          tenantId,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      const eventId = ulid();
      await tx.outbox.create({
        data: {
          tenantId,
          eventId,
          eventType,
          aggregateId: event.id,
          payload: payload as Prisma.InputJsonValue,
        },
      });
      return { aggregateId: Number(event.id), eventId };
    });
  }
}
