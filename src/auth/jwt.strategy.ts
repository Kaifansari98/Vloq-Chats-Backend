import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type JwtPayload = {
  userId: number;
  uuid: string;
  organizationId: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(request: Request, payload: JwtPayload) {
    const user = await this.prisma.userMaster.findUnique({
      where: { id: payload.userId },
      include: { authProviders: true },
    });

    if (!user || user.isDeleted || !user.isActive) {
      throw new UnauthorizedException();
    }

    const ip = this.extractIp(request);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const blocked = await this.prisma.checkIpRestriction(
      user.organizationId,
      ip,
    );

    if (blocked) {
      throw new UnauthorizedException('Access restricted from this IP address');
    }

    return user;
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded
        .split(',')[0]
        .trim()
        .replace(/^::ffff:/, '');
    }
    const realIp = request.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim().replace(/^::ffff:/, '');
    }
    return (request.ip ?? '').replace(/^::ffff:/, '');
  }
}
