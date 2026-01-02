import { EventsService } from './events.service';

describe('EventsService', () => {
  it('returns cursor from newest event', async () => {
    const prisma = {
      withTenant: jest.fn(async (_tenant: string, callback: any) =>
        callback({
          outbox: {
            findMany: jest.fn().mockResolvedValue([
              {
                aggregateId: BigInt(42),
                eventId: '01HF',
                eventType: 'Created',
                payload: {},
                event: { createdAt: new Date('2024-01-01T00:00:00Z') },
              },
            ]),
          },
        }),
      ),
    } as any;
    const service = new EventsService(prisma);
    const result = await service.fetchLatest('tenant', 50);
    expect(result.cursor).toBe('42');
    expect(result.items[0].event_id).toBe('01HF');
  });
});
