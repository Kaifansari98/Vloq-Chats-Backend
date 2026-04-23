import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.schema';
import * as bcrypt from 'bcrypt';

type AuthProviderRecord = {
  provider: string;
  providerId: string;
};

type UserMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  email: string;
  password: string | null;
  organizationId: number;
  authProviders: AuthProviderRecord[];
};

type UserMasterDelegate = {
  findFirst(args: {
    where: {
      email: string;
      organizationId: number;
      isDeleted: false;
    };
    include: {
      authProviders: true;
    };
  }): Promise<UserMasterRecord | null>;
};

type PrismaLike = {
  userMaster: UserMasterDelegate;
};

@Injectable()
export class AuthService {
  constructor(
    @Optional() private readonly prisma: PrismaLike | undefined,
    private jwtService: JwtService,
  ) {}

  private get userMaster() {
    if (!this.prisma) {
      throw new InternalServerErrorException('Prisma client is not configured');
    }

    return this.prisma.userMaster;
  }

  async login(data: LoginDto) {
    const { email, password, provider, providerId, organizationId } = data;
    const normalizedEmail = email.toLowerCase();
    const normalizedProviderId = providerId?.trim();

    if (provider === 'GOOGLE' && !normalizedProviderId) {
      throw new BadRequestException('Provider ID is required for Google login');
    }

    const user = await this.userMaster.findFirst({
      where: {
        email: normalizedEmail,
        organizationId,
        isDeleted: false,
      },
      include: {
        authProviders: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (provider === 'EMAIL') {
      if (!password || !user.password) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    if (provider === 'GOOGLE') {
      const providerExists = user.authProviders.find(
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

    return {
      message: 'Login successful',
      accessToken: token,
      user: {
        uuid: user.uuid,
        name: user.name,
        email: user.email,
      },
    };
  }
}
