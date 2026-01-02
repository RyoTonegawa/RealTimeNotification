import { Controller, Get, Headers, HttpException, HttpStatus, Query } from '@nestjs/common';
import { EventsService } from '../services/events.service';
import { GetEventsDto } from '../dto/get-events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async list(@Headers('x-tenant-id') tenantId: string, @Query() query: GetEventsDto) {
    if (!tenantId) {
      throw new HttpException('x-tenant-id header is required', HttpStatus.BAD_REQUEST);
    }
    const { items, cursor } = await this.eventsService.fetchLatest(tenantId, query.limit);
    return {
      items,
      cursor,
    };
  }
}
