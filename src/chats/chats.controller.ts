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
import {
  createDirectChatSchema,
  type CreateDirectChatDto,
} from './dto/create-direct-chat.schema';
import {
  createDirectMessageSchema,
  type CreateDirectMessageDto,
} from './dto/create-direct-message.schema';
import {
  markDirectChatReadSchema,
  type MarkDirectChatReadDto,
} from './dto/mark-direct-chat-read.schema';
import { ChatsService } from './chats.service';

type AuthenticatedRequest = Request & {
  user: UserMasterRecord;
};

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get('direct')
  listDirectChats(
    @Req() req: AuthenticatedRequest,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
    @Query('search') searchValue?: string,
  ) {
    const page = Math.max(1, Number(pageValue ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitValue ?? 25) || 25));
    const search = typeof searchValue === 'string' ? searchValue : '';

    return this.chatsService.listDirectChats(req.user, page, limit, search);
  }

  @Post('direct')
  async createOrGetDirectChat(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = createDirectChatSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: CreateDirectChatDto = result.data;
    return this.chatsService.createOrGetDirectChat(req.user, data);
  }

  @Get('direct/messages')
  listDirectMessages(
    @Req() req: AuthenticatedRequest,
    @Query('participantUserId') participantUserIdValue?: string,
  ) {
    const participantUserId = Number(participantUserIdValue);

    if (!Number.isInteger(participantUserId) || participantUserId <= 0) {
      throw new BadRequestException(
        'participantUserId must be a positive integer',
      );
    }

    return this.chatsService.listDirectMessages(req.user, participantUserId);
  }

  @Post('direct/messages')
  async createDirectMessage(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = createDirectMessageSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: CreateDirectMessageDto = result.data;
    return this.chatsService.createDirectMessage(req.user, data);
  }

  @Post('direct/messages/read')
  async markDirectChatRead(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = markDirectChatReadSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: MarkDirectChatReadDto = result.data;
    return this.chatsService.markDirectChatRead(req.user, data);
  }
}
