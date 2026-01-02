import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type StreamEntry = {
  id: string;
  fields: Record<string, string>;
};

@Injectable()
export class RedisStreamService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('app.redis.host'),
      port: this.config.get<number>('app.redis.port'),
    });
  }

  streamKey(tenantId: string) {
    return `stream:events:${tenantId}`;
  }

  async addEvent(key: string, payload: Record<string, string>) {
    return this.client.xadd(key, '*', ...Object.entries(payload).flat());
  }

  async xrange(key: string, from = '-', to = '+', count = 100): Promise<StreamEntry[]> {
    const raw = await this.client.xrange(key, from, to, 'COUNT', count);
    return raw.map(([id, values]) => ({ id, fields: this.toFieldMap(values as string[]) }));
  }

  async xreadBlocking(key: string, cursor: string, blockMs = 15000): Promise<StreamEntry[]> {
    const response = await this.client.xread('BLOCK', blockMs, 'STREAMS', key, cursor);
    if (!response) return [];
    const [, entries] = response[0];
    return entries.map(([id, values]) => ({ id, fields: this.toFieldMap(values as string[]) }));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  private toFieldMap(values: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (let i = 0; i < values.length; i += 2) {
      const key = values[i];
      const value = values[i + 1];
      if (key !== undefined && value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
}
