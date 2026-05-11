import { JwtService } from '@nestjs/jwt';
import { ChatsGateway } from './chats.gateway';
import { PrismaService } from '../prisma/prisma.service';

describe('ChatsGateway', () => {
  let gateway: ChatsGateway;
  let prisma: {
    userMaster: { findUnique: jest.Mock };
    userTypeMaster: { findById: jest.Mock };
    checkIpRestriction: jest.Mock;
  };
  let jwtService: { verifyAsync: jest.Mock };

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

    jwtService = {
      verifyAsync: jest.fn(),
    };

    gateway = new ChatsGateway(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as never;
  });

  it('allows ADMIN websocket connections without IP restriction checks', async () => {
    jwtService.verifyAsync.mockResolvedValue({ userId: 1, uuid: 'user-1', organizationId: 10 });
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
    });
    prisma.userTypeMaster.findById.mockResolvedValue({ code: 'ADMIN' });

    const client = {
      handshake: {
        auth: { token: 'token' },
        headers: {},
        address: '10.0.0.1',
      },
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(prisma.checkIpRestriction).not.toHaveBeenCalled();
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('user:1');
    expect(client.join).toHaveBeenCalledWith('organization:10');
  });

  it('disconnects non-admin websocket connections from restricted IPs', async () => {
    jwtService.verifyAsync.mockResolvedValue({ userId: 2, uuid: 'user-2', organizationId: 20 });
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
    });
    prisma.userTypeMaster.findById.mockResolvedValue({ code: 'MEMBER' });
    prisma.checkIpRestriction.mockResolvedValue(true);

    const client = {
      handshake: {
        auth: { token: 'token' },
        headers: {},
        address: '10.0.0.2',
      },
      data: {},
      join: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(client as never);

    expect(prisma.checkIpRestriction).toHaveBeenCalledWith(20, '10.0.0.2');
    expect(client.emit).toHaveBeenCalledWith('ip_restricted', {
      message: 'Access restricted from this IP address',
    });
    expect(client.disconnect).toHaveBeenCalled();
  });
});
