import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.schema';
import type { UpdateUserDto } from './dto/update-user.schema';
import * as bcrypt from 'bcrypt';
import type { UserMasterRecord } from '../prisma/prisma.service';
import type { PushTokenDto } from './dto/push-token.schema';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationMembers(
    organizationId: number,
    page: number,
    limit: number,
    search?: string,
  ) {
    const { members, total } = await this.prisma.userMaster.findMembersPage({
      where: { organizationId },
      page,
      limit,
      search,
    });

    const data = members.map(({ password: _p, ...member }) => {
      void _p;
      return member;
    });

    return { data, total, page, limit };
  }

  async getAssignableRoles() {
    const [adminRole, memberRole] = await Promise.all([
      this.prisma.userTypeMaster.findUnique({
        where: { code: 'ADMIN' },
      }),
      this.prisma.userTypeMaster.findUnique({
        where: { code: 'MEMBER' },
      }),
    ]);

    return {
      data: [adminRole, memberRole].filter((role) => role !== null),
    };
  }

  async getCurrentUserRole(userTypeId: number) {
    const role = await this.prisma.userTypeMaster.findById({
      where: { id: userTypeId },
    });

    return {
      userTypeCode: role?.code ?? '',
    };
  }

  async createUser(data: CreateUserDto) {
    const { email, password, provider, providerId } = data;
    const normalizedEmail = email.toLowerCase();
    const normalizedProviderId = providerId?.trim();

    if (provider === 'GOOGLE' && !normalizedProviderId) {
      throw new BadRequestException('Provider ID is required for Google login');
    }

    const existingUser = await this.prisma.userMaster.findFirst({
      where: {
        email: normalizedEmail,
        organizationId: data.organizationId,
      },
    });

    if (existingUser) {
      throw new ConflictException('User already exists in this organization');
    }

    let hashedPassword: string | null = null;

    if (provider === 'EMAIL') {
      if (!password) {
        throw new BadRequestException('Password is required for email login');
      }

      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 🔹 create user + provider
    const authProviderId =
      provider === 'GOOGLE'
        ? (normalizedProviderId ??
          (() => {
            throw new BadRequestException(
              'Provider ID is required for Google login',
            );
          })())
        : normalizedEmail;

    const user = await this.prisma.userMaster.create({
      data: {
        name: data.name,
        email: normalizedEmail,
        password: hashedPassword,
        organizationId: data.organizationId,
        userTypeId: data.userTypeId,
        authProviders: {
          create: {
            provider,
            providerId: authProviderId,
          },
        },
      },
      include: {
        authProviders: true,
      },
    });

    const { password: _password, ...safeUser } = user;
    void _password;

    return {
      message: 'User created successfully',
      data: safeUser,
    };
  }

  async updateUser(
    admin: UserMasterRecord,
    userUuid: string,
    data: UpdateUserDto,
  ) {
    const target = await this.prisma.userMaster.findByUuid({
      where: { uuid: userUuid, organizationId: admin.organizationId },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (data.email) {
      const normalizedEmail = data.email.toLowerCase();
      const conflict = await this.prisma.userMaster.findFirst({
        where: {
          email: normalizedEmail,
          organizationId: admin.organizationId,
        },
      });
      if (conflict && conflict.id !== target.id) {
        throw new ConflictException('Email already in use in this organization');
      }
    }

    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const updated = await this.prisma.userMaster.update({
      where: { uuid: userUuid, organizationId: admin.organizationId },
      data: {
        name: data.name,
        email: data.email,
        userTypeId: data.userTypeId,
        password: hashedPassword ?? undefined,
        isActive: data.isActive,
      },
    });

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    const { password: _p, ...safe } = updated;
    void _p;

    return { message: 'User updated successfully', data: safe };
  }

  async softDeleteUser(admin: UserMasterRecord, userUuid: string) {
    if (admin.uuid === userUuid) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const deleted = await this.prisma.userMaster.softDelete({
      where: { uuid: userUuid, organizationId: admin.organizationId },
    });

    if (!deleted) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  async registerPushToken(user: UserMasterRecord, data: PushTokenDto) {
    await this.prisma.userPushToken.upsertForUser({
      data: {
        userId: user.id,
        token: data.token.trim(),
        platform: 'WEB',
        userAgent: data.userAgent?.trim() || null,
      },
    });

    return {
      message: 'Push token registered',
    };
  }

  async removePushToken(user: UserMasterRecord, token: string) {
    await this.prisma.userPushToken.deleteForUser({
      where: {
        userId: user.id,
        token: token.trim(),
      },
    });

    return {
      message: 'Push token removed',
    };
  }
}
