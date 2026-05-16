import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { UserMasterRecord } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { CreateUserDto, createUserSchema } from './dto/create-user.schema';
import { updateUserSchema } from './dto/update-user.schema';
import { PushTokenDto, pushTokenSchema } from './dto/push-token.schema';

const MAX_PROFILE_PIC_BYTES = 5 * 1024 * 1024; // 5 MB

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
  async getProfile(@Req() req: AuthenticatedRequest) {
    const profilePicUrl = await this.usersService.resolveProfilePicUrl(req.user);
    const { password: _pw, ...safe } = req.user;
    void _pw;
    return {
      message: 'Authorized',
      user: { ...safe, profile_pic_url: profilePicUrl },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/profile-pic')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROFILE_PIC_BYTES },
    }),
  )
  async uploadProfilePic(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: unknown,
  ) {
    if (!file || typeof file !== 'object') {
      throw new BadRequestException('No file uploaded');
    }

    const f = file as { buffer: Buffer; originalname: string; mimetype: string; size: number };

    if (!f.buffer || !f.mimetype) {
      throw new BadRequestException('Invalid file');
    }

    return this.usersService.uploadProfilePic(req.user, f);
  }

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  getAssignableRoles() {
    return this.usersService.getAssignableRoles();
  }

  @UseGuards(JwtAuthGuard)
  @Get('role')
  getCurrentUserRole(@Req() req: AuthenticatedRequest) {
    return this.usersService.getCurrentUserRole(req.user.userTypeId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':uuid')
  updateUser(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Body() body: unknown,
  ) {
    const result = updateUserSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }

    return this.usersService.updateUser(req.user, uuid, result.data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':uuid')
  deleteUser(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') uuid: string,
  ) {
    return this.usersService.softDeleteUser(req.user, uuid);
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
