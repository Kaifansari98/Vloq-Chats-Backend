/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

type UserAuthProviderRecord = {
  id: number;
  uuid: string;
  userId: number;
  provider: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UserMasterRecord = {
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
  authProviders?: UserAuthProviderRecord[];
};

type FindUniqueArgs = {
  where: {
    id: number;
  };
  include?: {
    authProviders?: boolean;
  };
};

type FindFirstArgs = {
  where: {
    email: string;
    organizationId: number;
    isDeleted?: boolean;
  };
  include?: {
    authProviders?: boolean;
  };
};

type CreateArgs = {
  data: {
    name: string;
    email: string;
    password: string | null;
    organizationId: number;
    userTypeId: number;
    authProviders: {
      create: {
        provider: string;
        providerId: string;
      };
    };
  };
  include?: {
    authProviders?: boolean;
  };
};

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
    });
  }

  readonly userMaster = {
    findUnique: async (args: FindUniqueArgs) => this.findUniqueUser(args),
    findFirst: async (args: FindFirstArgs) => this.findFirstUser(args),
    create: async (args: CreateArgs) => this.createUser(args),
  };

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async findUniqueUser({
    where,
    include,
  }: FindUniqueArgs): Promise<UserMasterRecord | null> {
    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE id = $1
        LIMIT 1
      `,
      [where.id],
    );

    const user = result.rows[0] ?? null;

    if (!user) {
      return null;
    }

    return this.withIncludes(user, include);
  }

  private async findFirstUser({
    where,
    include,
  }: FindFirstArgs): Promise<UserMasterRecord | null> {
    const values: Array<string | number | boolean> = [
      where.email,
      where.organizationId,
    ];
    let isDeletedClause = '';

    if (typeof where.isDeleted === 'boolean') {
      values.push(where.isDeleted);
      isDeletedClause = ` AND "isDeleted" = $${values.length}`;
    }

    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE email = $1
          AND "organizationId" = $2${isDeletedClause}
        LIMIT 1
      `,
      values,
    );

    const user = result.rows[0] ?? null;

    if (!user) {
      return null;
    }

    return this.withIncludes(user, include);
  }

  private async createUser({
    data,
    include,
  }: CreateArgs): Promise<UserMasterRecord> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const createdUserResult = await client.query<UserMasterRecord>(
        `
          INSERT INTO "UserMaster" (
            name,
            email,
            password,
            "organizationId",
            "userTypeId"
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [
          data.name,
          data.email,
          data.password,
          data.organizationId,
          data.userTypeId,
        ],
      );

      const user = createdUserResult.rows[0];

      const authProviderResult = await client.query<UserAuthProviderRecord>(
        `
          INSERT INTO "UserAuthProvider" (
            "userId",
            provider,
            "providerId"
          )
          VALUES ($1, $2, $3)
          RETURNING *
        `,
        [
          user.id,
          data.authProviders.create.provider,
          data.authProviders.create.providerId,
        ],
      );

      await client.query('COMMIT');

      if (include?.authProviders) {
        return {
          ...user,
          authProviders: authProviderResult.rows,
        };
      }

      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async withIncludes(
    user: UserMasterRecord,
    include?: {
      authProviders?: boolean;
    },
  ): Promise<UserMasterRecord> {
    if (!include?.authProviders) {
      return user;
    }

    return {
      ...user,
      authProviders: await this.findAuthProvidersByUserId(user.id),
    };
  }

  private async findAuthProvidersByUserId(
    userId: number,
    client: Pool | PoolClient = this.pool,
  ): Promise<UserAuthProviderRecord[]> {
    const result = await client.query<UserAuthProviderRecord>(
      `
        SELECT *
        FROM "UserAuthProvider"
        WHERE "userId" = $1
        ORDER BY id ASC
      `,
      [userId],
    );

    return result.rows;
  }
}
