import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../config';
import { EventsService } from '../services/events.service';
import { EventsController } from '../controllers/events.controller';
import { SseController } from '../controllers/sse.controller';
import { RedisStreamService } from '../services/redis-stream.service';
import { OutboxWorkerService } from '../services/outbox-worker.service';
import { PrismaService } from '../services/prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] })],
  controllers: [EventsController, SseController],
  providers: [PrismaService, EventsService, RedisStreamService, OutboxWorkerService],
})
export class AppModule {}
