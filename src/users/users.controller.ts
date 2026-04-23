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
  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return {
      message: 'Authorized',
      user: req.user,
    };
  }
}
