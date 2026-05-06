import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { UserMasterRecord } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import {
  listNotificationsSchema,
  type ListNotificationsDto,
} from './dto/list-notifications.schema';
import {
  markNotificationReadSchema,
  type MarkNotificationReadDto,
} from './dto/mark-notification-read.schema';

type AuthenticatedRequest = Request & {
  user: UserMasterRecord;
};

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(
    @Req() req: AuthenticatedRequest,
    @Query() query: unknown,
  ) {
    const result = listNotificationsSchema.safeParse(query);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: ListNotificationsDto = result.data;
    const page = Math.max(1, Number(data.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(data.limit ?? 10) || 10));
    return this.notificationsService.listForUser(req.user.id, page, limit);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.getUnreadCount(req.user.id);
  }

  @Post('read')
  async markRead(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const result = markNotificationReadSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: MarkNotificationReadDto = result.data;
    return this.notificationsService.markRead(req.user.id, data.notificationUuid);
  }

  @Post('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
