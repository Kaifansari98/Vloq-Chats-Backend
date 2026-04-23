import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.schema';
import * as bcrypt from 'bcrypt';

type UserMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  email: string;
  password: string | null;
  isActive: boolean;
  organizationId: number;
  userTypeId: number;
  createdById: number | null;
  updatedById: number | null;
  deletedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
};

type UserMasterDelegate = {
  findFirst(args: {
    where: {
      email: string;
      organizationId: number;
    };
  }): Promise<UserMasterRecord | null>;
  create(args: {
    data: {
      name: string;
      email: string;
      password: string | null;
      organizationId: number;
      userTypeId: number;
      authProviders: {
        create: {
          provider: CreateUserDto['provider'];
          providerId: string;
        };
      };
    };
    include: {
      authProviders: true;
    };
  }): Promise<UserMasterRecord & { authProviders: unknown[] }>;
};

type PrismaLike = {
  userMaster: UserMasterDelegate;
};

@Injectable()
export class UsersService {
  constructor(@Optional() private readonly prisma?: PrismaLike) {}

  private get userMaster() {
    if (!this.prisma) {
      throw new InternalServerErrorException('Prisma client is not configured');
    }

    return this.prisma.userMaster;
  }

  async createUser(data: CreateUserDto) {
    const { email, password, provider, providerId } = data;
    const normalizedEmail = email.toLowerCase();
    const normalizedProviderId = providerId?.trim();

    if (provider === 'GOOGLE' && !normalizedProviderId) {
      throw new BadRequestException('Provider ID is required for Google login');
    }

    const existingUser = await this.userMaster.findFirst({
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

    const user = await this.userMaster.create({
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

    return {
      message: 'User created successfully',
      data: user,
    };
  }
}
