/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { UserMasterRecord } from '../prisma/prisma.service';
import { OrganizationService } from './organization.service';
import { createOrgSchema, type CreateOrgDto } from './dto/create-org.schema';
import {
  updateOrgSettingsSchema,
  type UpdateOrgSettingsDto,
} from './dto/update-org-settings.schema';
import {
  addAllowedIpSchema,
  type AddAllowedIpDto,
} from './dto/add-allowed-ip.schema';

type AuthenticatedRequest = Request & { user: UserMasterRecord };

@Controller('organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  @Post()
  async createOrg(@Body() body: unknown) {
    const result = createOrgSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const data: CreateOrgDto = result.data;
    return this.orgService.createOrganization(data);
  }

  @Get('my-ip')
  @UseGuards(JwtAuthGuard)
  getMyIp(@Req() req: AuthenticatedRequest) {
    const forwarded = req.headers['x-forwarded-for'];
    const raw =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : (req.ip ?? '');
    return { ip: raw.replace(/^::ffff:/, '') };
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  getSettings(@Req() req: AuthenticatedRequest) {
    return this.orgService.getSettings(req.user);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  updateSettings(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const result = updateOrgSettingsSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const data: UpdateOrgSettingsDto = result.data;
    return this.orgService.updateSettings(req.user, data);
  }

  @Get('ip-restrictions')
  @UseGuards(JwtAuthGuard)
  listAllowedIps(@Req() req: AuthenticatedRequest) {
    return this.orgService.listAllowedIps(req.user);
  }

  @Post('ip-restrictions')
  @UseGuards(JwtAuthGuard)
  addAllowedIp(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const result = addAllowedIpSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    const data: AddAllowedIpDto = result.data;
    return this.orgService.addAllowedIp(req.user, data);
  }

  @Delete('ip-restrictions')
  @UseGuards(JwtAuthGuard)
  removeAllAllowedIps(@Req() req: AuthenticatedRequest) {
    return this.orgService.removeAllAllowedIps(req.user);
  }

  @Delete('ip-restrictions/:uuid')
  @UseGuards(JwtAuthGuard)
  removeAllowedIp(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') ipUuid: string,
  ) {
    return this.orgService.removeAllowedIp(req.user, ipUuid);
  }
}
