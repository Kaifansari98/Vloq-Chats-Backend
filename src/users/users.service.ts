import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.schema';
import type { UpdateUserDto } from './dto/update-user.schema';
import * as bcrypt from 'bcrypt';
import type { UserMasterRecord } from '../prisma/prisma.service';
import type { PushTokenDto } from './dto/push-token.schema';
import { StorageService } from '../storage/storage.service';

type MulterFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

    const org = await this.prisma.organizationMaster.findById({
      where: { id: organizationId },
    });

    const data = await Promise.all(
      members.map(async ({ password: _p, profile_pic, ...member }) => {
        void _p;
        const profile_pic_url =
          profile_pic && org
            ? await this.storage
                .getAccessibleUrl(profile_pic, org.fileUpload)
                .catch(() => null)
            : null;
        return { ...member, profile_pic_url };
      }),
    );

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

  async uploadProfilePic(user: UserMasterRecord, file: MulterFile) {
    if (!this.storage.isImageMimeType(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        'Only JPEG and PNG images are allowed for profile pictures',
      );
    }

    const org = await this.prisma.organizationMaster.findById({
      where: { id: user.organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const sanitizedOrgName = org.name.replace(/[^a-zA-Z0-9]/g, '_');
    const folder = `profile_pics/${org.id}_${sanitizedOrgName}`;

    // Delete old profile pic to avoid orphaned files
    if (user.profile_pic) {
      try {
        await this.storage.deleteFile(user.profile_pic, org.fileUpload);
      } catch {
        // Non-fatal – continue even if old file can't be deleted
      }
    }

    const uploaded = await this.storage.uploadFile(file, folder, org.fileUpload);

    await this.prisma.userMaster.updateProfilePicKey({
      where: { id: user.id },
      key: uploaded.key,
    });

    const url = await this.storage.getAccessibleUrl(uploaded.key, org.fileUpload);

    return {
      message: 'Profile picture updated',
      profile_pic_url: url,
      profile_pic_key: uploaded.key,
    };
  }

  async resolveProfilePicUrl(
    user: UserMasterRecord,
  ): Promise<string | null> {
    if (!user.profile_pic) return null;

    const org = await this.prisma.organizationMaster.findById({
      where: { id: user.organizationId },
    });

    if (!org) return null;

    return this.storage.getAccessibleUrl(user.profile_pic, org.fileUpload);
  }
}
