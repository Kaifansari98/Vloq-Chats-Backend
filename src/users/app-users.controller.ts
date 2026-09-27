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
import { PrismaService, type UserMasterRecord } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { CreateUserDto, createUserSchema } from './dto/create-user.schema';
import { updateUserSchema } from './dto/update-user.schema';
import { PushTokenDto, pushTokenSchema } from './dto/push-token.schema';

const MAX_PROFILE_PIC_BYTES = 5 * 1024 * 1024; // 5 MB

type AuthenticatedRequest = Request & {
  user: UserMasterRecord;
};

@Controller('app/users')
export class AppUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createUser(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    let orgId = body.organizationId;
    let userTypeId = body.userTypeId;

    const authUser = req.user;
    if (!orgId && authUser?.organizationId) {
      orgId = authUser.organizationId;
    } else if (!orgId) {
      const defaultOrg = await this.prisma.organizationMaster.findById({ where: { id: 2 } });
      orgId = defaultOrg?.id ?? 2;
    }

    if (!userTypeId) {
      const roleStr = typeof body.role === 'string' ? body.role.toUpperCase() : 'MEMBER';
      const role = await this.prisma.userTypeMaster.findUnique({ where: { code: roleStr } });
      userTypeId = role?.id ?? (roleStr === 'ADMIN' ? 1 : 2);
    }

    const payload = {
      name: body.name,
      email: typeof body.email === 'string' ? body.email.toLowerCase().trim() : '',
      password: body.password,
      organizationId: Number(orgId),
      userTypeId: Number(userTypeId),
      provider: body.provider || 'EMAIL',
      providerId: body.providerId,
    };

    const result = createUserSchema.safeParse(payload);

    if (!result.success) {
      const flat = result.error.flatten();
      const firstError =
        Object.values(flat.fieldErrors)[0]?.[0] ||
        flat.formErrors[0] ||
        'Invalid user creation parameters';
      throw new BadRequestException(firstError);
    }

    const data: CreateUserDto = result.data;
    const response = await this.usersService.createUser(data);
    return {
      ...response,
      user: response.data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createUserAlias(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.createUser(req, body);
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
  @Post('profile-pic')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PROFILE_PIC_BYTES },
    }),
  )
  async uploadProfilePicAlias(
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
