import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: {
    userMaster: { findUnique: jest.Mock };
    userTypeMaster: { findById: jest.Mock };
    checkIpRestriction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      userMaster: {
        findUnique: jest.fn(),
      },
      userTypeMaster: {
        findById: jest.fn(),
      },
      checkIpRestriction: jest.fn(),
    };

    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    strategy = new JwtStrategy(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  it('bypasses IP restriction checks for ADMIN users', async () => {
    prisma.userMaster.findUnique.mockResolvedValue({
      id: 1,
      uuid: 'user-1',
      name: 'Admin User',
      email: 'admin@example.com',
      password: null,
      isActive: true,
      organizationId: 10,
      userTypeId: 99,
      createdById: null,
      updatedById: null,
      deletedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
      authProviders: [],
    });
    prisma.userTypeMaster.findById.mockResolvedValue({ code: 'ADMIN' });

    const result = await strategy.validate({ headers: {}, ip: '10.0.0.1' } as Request, {
      userId: 1,
      uuid: 'user-1',
      organizationId: 10,
    });

    expect(result.id).toBe(1);
    expect(prisma.checkIpRestriction).not.toHaveBeenCalled();
  });

  it('blocks non-admin users from restricted IPs', async () => {
    prisma.userMaster.findUnique.mockResolvedValue({
      id: 2,
      uuid: 'user-2',
      name: 'Member User',
      email: 'member@example.com',
      password: null,
      isActive: true,
      organizationId: 20,
      userTypeId: 5,
      createdById: null,
      updatedById: null,
      deletedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
      authProviders: [],
    });
    prisma.userTypeMaster.findById.mockResolvedValue({ code: 'MEMBER' });
    prisma.checkIpRestriction.mockResolvedValue(true);

    await expect(
      strategy.validate({ headers: {}, ip: '10.0.0.2' } as Request, {
        userId: 2,
        uuid: 'user-2',
        organizationId: 20,
      }),
    ).rejects.toThrow(new UnauthorizedException('Access restricted from this IP address'));

    expect(prisma.checkIpRestriction).toHaveBeenCalledWith(20, '10.0.0.2');
  });
});
