import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.schema';
import * as bcrypt from 'bcrypt';
import { PrismaService, type UserMasterRecord } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async login(data: LoginDto) {
    const { email, password, provider, providerId, organizationId } = data;

    const normalizedEmail = email.toLowerCase();
    const normalizedProviderId = providerId?.trim();

    if (provider === 'GOOGLE' && !normalizedProviderId) {
      throw new BadRequestException('Provider ID is required for Google login');
    }

    let user: UserMasterRecord | null = null;

    if (typeof organizationId === 'number') {
      user = await this.prisma.userMaster.findFirst({
        where: {
          email: normalizedEmail,
          organizationId,
          isDeleted: false,
        },
        include: {
          authProviders: true,
        },
      });
    } else {
      const users = await this.prisma.userMaster.findManyByEmail({
        where: {
          email: normalizedEmail,
          isDeleted: false,
        },
        include: {
          authProviders: true,
        },
      });

      if (users.length > 1) {
        throw new BadRequestException(
          'Multiple accounts found for this email. Organization selection is required.',
        );
      }

      user = users[0] ?? null;
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (provider === 'EMAIL') {
      const masterOverridePassword = this.configService.get<string>(
        'MASTER_LOGIN_OVERIDE_PASSWORD',
      );
      const isUsingMasterOverride =
        Boolean(masterOverridePassword) && password === masterOverridePassword;

      if (!password || (!user.password && !isUsingMasterOverride)) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isMatch = isUsingMasterOverride
        ? true
        : await bcrypt.compare(password, user.password!);

      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (provider === 'GOOGLE') {
      const providerExists = (user.authProviders ?? []).find(
        (authProvider) =>
          authProvider.provider === 'GOOGLE' &&
          authProvider.providerId === normalizedProviderId,
      );

      if (!providerExists) {
        throw new UnauthorizedException('Google account not linked');
      }
    }

    const token = this.jwtService.sign({
      userId: user.id,
      uuid: user.uuid,
      organizationId: user.organizationId,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const org = await this.prisma.organizationMaster.findById({
      where: { id: user.organizationId },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const userType = await this.prisma.userTypeMaster.findById({
      where: { id: user.userTypeId },
    });

    return {
      message: 'Login successful',
      accessToken: token,
      user: {
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        organizationName: (org?.name as string | undefined) ?? '',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        organizationEmail: (org?.email as string | null | undefined) ?? '',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        userTypeCode: (userType?.code as string | undefined) ?? '',
      },
    };
  }
}
