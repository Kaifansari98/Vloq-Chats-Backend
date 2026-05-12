import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let configService: {
    get: jest.Mock;
  };
  let prismaService: {
    userMaster: {
      findFirst: jest.Mock;
      findManyByEmail: jest.Mock;
    };
    organizationMaster: {
      findById: jest.Mock;
    };
    userTypeMaster: {
      findById: jest.Mock;
    };
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    };

    prismaService = {
      userMaster: {
        findFirst: jest.fn(),
        findManyByEmail: jest.fn(),
      },
      organizationMaster: {
        findById: jest.fn(),
      },
      userTypeMaster: {
        findById: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow email login with the master override password', async () => {
    const user = {
      id: 1,
      uuid: 'user-uuid',
      name: 'Test User',
      email: 'test@example.com',
      password: null,
      organizationId: 10,
      userTypeId: 20,
      authProviders: [],
    };

    configService.get.mockReturnValue('master-secret');
    prismaService.userMaster.findManyByEmail.mockResolvedValue([user]);
    prismaService.organizationMaster.findById.mockResolvedValue({
      name: 'Test Org',
      email: 'org@example.com',
    });
    prismaService.userTypeMaster.findById.mockResolvedValue({
      code: 'ADMIN',
    });
    jwtService.sign.mockReturnValue('signed-token');

    const result = await service.login({
      email: 'test@example.com',
      password: 'master-secret',
      provider: 'EMAIL',
    });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user.email).toBe('test@example.com');
    expect(jwtService.sign).toHaveBeenCalledWith({
      userId: 1,
      uuid: 'user-uuid',
      organizationId: 10,
    });
  });
});
