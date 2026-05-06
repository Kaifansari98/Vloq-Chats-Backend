import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { UserMasterRecord } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { CreateUserDto, createUserSchema } from './dto/create-user.schema';
import { PushTokenDto, pushTokenSchema } from './dto/push-token.schema';

type AuthenticatedRequest = Request & {
  user: UserMasterRecord;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async createUser(@Body() body: unknown) {
    const result = createUserSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: CreateUserDto = result.data;
    return this.usersService.createUser(data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('members')
  getMembers(
    @Req() req: AuthenticatedRequest,
    @Body() body: { page?: number; limit?: number; search?: string },
  ) {
    const page = Math.max(1, Number(body.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(body.limit ?? 25) || 25));
    const search = typeof body.search === 'string' ? body.search : '';
    return this.usersService.getOrganizationMembers(
      req.user.organizationId,
      page,
      limit,
      search,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return {
      message: 'Authorized',
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-tokens')
  async registerPushToken(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = pushTokenSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: PushTokenDto = result.data;
    return this.usersService.registerPushToken(req.user, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('push-tokens/remove')
  async removePushToken(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = pushTokenSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    const data: PushTokenDto = result.data;
    return this.usersService.removePushToken(req.user, data.token);
  }
}
