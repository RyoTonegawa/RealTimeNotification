import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('app.port', 3001);
  const corsOrigins = config.get<string[]>('app.corsOrigins', ['*']);

  const allowAll = corsOrigins.includes('*');
  app.enableCors({
    origin: allowAll ? true : corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-tenant-id', 'last-event-id'],
  });

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Nest backend listening on port ${port}`);
}

bootstrap();
