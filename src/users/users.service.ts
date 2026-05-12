import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.schema';
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
