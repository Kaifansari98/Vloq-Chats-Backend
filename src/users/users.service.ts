import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      message: 'User created successfully',
      data: user,
    };
  }
}
