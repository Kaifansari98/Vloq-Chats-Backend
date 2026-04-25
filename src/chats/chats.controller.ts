import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
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
import {
  uploadDirectMessageSchema,
  type UploadDirectMessageDto,
} from './dto/upload-direct-message.schema';
import { ChatsService } from './chats.service';

type AuthenticatedRequest = Request & {
  user: UserMasterRecord;
};

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB ?? '10');
const MAX_FILE_SIZE_BYTES =
  (Number.isFinite(maxFileSizeMb) ? maxFileSizeMb : 10) * 1024 * 1024;

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
    @Query('filter') filterValue?: string,
  ) {
    const page = Math.max(1, Number(pageValue ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitValue ?? 25) || 25));
    const search = typeof searchValue === 'string' ? searchValue : '';
    const normalizedFilter =
      filterValue === 'UNREAD' || filterValue === 'GROUPS'
        ? filterValue
        : 'ALL';

    return this.chatsService.listDirectChats(
      req.user,
      page,
      limit,
      search,
      normalizedFilter,
    );
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

  @Get('direct/messages/attachments/:attachmentUuid/download')
  async downloadDirectAttachment(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('attachmentUuid') attachmentUuid: string,
  ) {
    const file = await this.chatsService.downloadDirectAttachment(
      req.user,
      attachmentUuid,
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.sizeBytes));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    file.body.pipe(res);
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

  @Post('direct/messages/upload')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadDirectMessage(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @UploadedFiles() files: unknown,
  ) {
    const result = uploadDirectMessageSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: UploadDirectMessageDto = result.data;
    const uploadedFiles = (Array.isArray(files) ? files : []) as UploadFile[];

    return this.chatsService.uploadDirectMessage(req.user, data, uploadedFiles);
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
