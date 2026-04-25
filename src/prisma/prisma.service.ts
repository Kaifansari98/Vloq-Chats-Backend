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

export type OrganizationMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  email: string | null;
  countryCode: string | null;
  logo: string | null;
  status: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type UserTypeMasterRecord = {
  id: number;
  uuid: string;
  name: string;
  code: string;
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
    organizationId?: number;
    isDeleted?: boolean;
  };
  include?: {
    authProviders?: boolean;
  };
};

type FindManyByEmailArgs = {
  where: {
    email: string;
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

type FindOrganizationUniqueArgs = {
  where: {
    slug: string;
  };
};

type FindOrganizationByIdArgs = {
  where: {
    id: number;
  };
};

type FindMembersPageArgs = {
  where: { organizationId: number };
  page: number;
  limit: number;
  search?: string;
};

type CreateOrganizationArgs = {
  data: {
    name: string;
    slug: string;
    email: string;
  };
};

type FindUserTypeUniqueArgs = {
  where: {
    code: string;
  };
};

type CreateAuthProviderArgs = {
  data: {
    userId: number;
    provider: string;
    providerId: string;
  };
};

type TransactionClient = {
  organizationMaster: {
    create(args: CreateOrganizationArgs): Promise<OrganizationMasterRecord>;
  };
  userMaster: {
    create(args: {
      data: Omit<CreateArgs['data'], 'authProviders'>;
    }): Promise<UserMasterRecord>;
  };
  userAuthProvider: {
    create(args: CreateAuthProviderArgs): Promise<UserAuthProviderRecord>;
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
    findManyByEmail: async (args: FindManyByEmailArgs) =>
      this.findManyUsersByEmail(args),
    create: async (args: CreateArgs) => this.createUser(args),
    findMembersPage: async (args: FindMembersPageArgs) =>
      this.findMembersPage(args),
  };

  readonly organizationMaster = {
    findUnique: async (args: FindOrganizationUniqueArgs) =>
      this.findUniqueOrganization(args),
    findById: async (args: FindOrganizationByIdArgs) =>
      this.findOrganizationById(args),
    create: async (args: CreateOrganizationArgs) =>
      this.createOrganization(args),
  };

  readonly userTypeMaster = {
    findUnique: async (args: FindUserTypeUniqueArgs) =>
      this.findUniqueUserType(args),
  };

  readonly userAuthProvider = {
    create: async (args: CreateAuthProviderArgs) =>
      this.createUserAuthProvider(args),
  };

  async $transaction<T>(
    callback: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(this.createTransactionClient(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

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

  private async findMembersPage({
    where,
    page,
    limit,
    search,
  }: FindMembersPageArgs): Promise<{
    members: UserMasterRecord[];
    total: number;
  }> {
    const offset = (page - 1) * limit;
    type Row = UserMasterRecord & { total_count: string };
    const values: (string | number)[] = [where.organizationId, limit, offset];
    let searchClause = '';
    const trimmed = search?.trim();
    if (trimmed) {
      values.push(`%${trimmed}%`);
      const idx = values.length;
      searchClause = ` AND (name ILIKE $${idx} OR email ILIKE $${idx})`;
    }
    const result = await this.pool.query<Row>(
      `SELECT *, COUNT(*) OVER() AS total_count
       FROM "UserMaster"
       WHERE "organizationId" = $1 AND "isDeleted" = false${searchClause}
       ORDER BY name ASC
       LIMIT $2 OFFSET $3`,
      values,
    );
    const total =
      result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const members: UserMasterRecord[] = result.rows.map(
      ({ total_count: _tc, ...m }) => {
        void _tc;
        return m as UserMasterRecord;
      },
    );
    return { members, total };
  }

  private async findOrganizationById({
    where,
  }: FindOrganizationByIdArgs): Promise<OrganizationMasterRecord | null> {
    const result = await this.pool.query<OrganizationMasterRecord>(
      `SELECT * FROM "OrganizationMaster" WHERE id = $1 LIMIT 1`,
      [where.id],
    );
    return result.rows[0] ?? null;
  }

  private async findUniqueOrganization({
    where,
  }: FindOrganizationUniqueArgs): Promise<OrganizationMasterRecord | null> {
    const result = await this.pool.query<OrganizationMasterRecord>(
      `
        SELECT *
        FROM "OrganizationMaster"
        WHERE slug = $1
        LIMIT 1
      `,
      [where.slug],
    );

    return result.rows[0] ?? null;
  }

  private async createOrganization({
    data,
  }: CreateOrganizationArgs): Promise<OrganizationMasterRecord> {
    const result = await this.pool.query<OrganizationMasterRecord>(
      `
        INSERT INTO "OrganizationMaster" (
          name,
          slug,
          email,
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [data.name, data.slug, data.email],
    );

    return result.rows[0];
  }

  private async findUniqueUserType({
    where,
  }: FindUserTypeUniqueArgs): Promise<UserTypeMasterRecord | null> {
    const result = await this.pool.query<UserTypeMasterRecord>(
      `
        SELECT *
        FROM "UserTypeMaster"
        WHERE code = $1
        LIMIT 1
      `,
      [where.code],
    );

    return result.rows[0] ?? null;
  }

  private async findFirstUser({
    where,
    include,
  }: FindFirstArgs): Promise<UserMasterRecord | null> {
    const values: Array<string | number | boolean> = [where.email];
    let organizationClause = '';
    let isDeletedClause = '';

    if (typeof where.organizationId === 'number') {
      values.push(where.organizationId);
      organizationClause = ` AND "organizationId" = $${values.length}`;
    }

    if (typeof where.isDeleted === 'boolean') {
      values.push(where.isDeleted);
      isDeletedClause = ` AND "isDeleted" = $${values.length}`;
    }

    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE email = $1${organizationClause}${isDeletedClause}
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

  private async findManyUsersByEmail({
    where,
    include,
  }: FindManyByEmailArgs): Promise<UserMasterRecord[]> {
    const values: Array<string | boolean> = [where.email];
    let isDeletedClause = '';

    if (typeof where.isDeleted === 'boolean') {
      values.push(where.isDeleted);
      isDeletedClause = ` AND "isDeleted" = $${values.length}`;
    }

    const result = await this.pool.query<UserMasterRecord>(
      `
        SELECT *
        FROM "UserMaster"
        WHERE email = $1${isDeletedClause}
        ORDER BY id ASC
      `,
      values,
    );

    if (!include?.authProviders) {
      return result.rows;
    }

    return Promise.all(
      result.rows.map((user) => this.withIncludes(user, include)),
    );
  }

  private async createUser({
    data,
    include,
  }: CreateArgs): Promise<UserMasterRecord> {
    const user = await this.createBareUserWithClient(this.pool, data);
    const authProviderResult = await this.createUserAuthProviderWithClient(
      this.pool,
      {
        data: {
          userId: user.id,
          provider: data.authProviders.create.provider,
          providerId: data.authProviders.create.providerId,
        },
      },
    );

    if (include?.authProviders) {
      return {
        ...user,
        authProviders: [authProviderResult],
      };
    }

    return user;
  }

  private async createBareUserWithClient(
    client: Pool | PoolClient,
    data: CreateArgs['data'],
  ): Promise<UserMasterRecord> {
    const createdUserResult = await client.query<UserMasterRecord>(
      `
        INSERT INTO "UserMaster" (
          name,
          email,
          password,
          "organizationId",
          "userTypeId",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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

    return createdUserResult.rows[0];
  }

  private async createUserAuthProvider({
    data,
  }: CreateAuthProviderArgs): Promise<UserAuthProviderRecord> {
    return this.createUserAuthProviderWithClient(this.pool, { data });
  }

  private async createUserAuthProviderWithClient(
    client: Pool | PoolClient,
    { data }: CreateAuthProviderArgs,
  ): Promise<UserAuthProviderRecord> {
    const result = await client.query<UserAuthProviderRecord>(
      `
        INSERT INTO "UserAuthProvider" (
          "userId",
          provider,
          "providerId",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [data.userId, data.provider, data.providerId],
    );

    return result.rows[0];
  }

  private createTransactionClient(client: PoolClient): TransactionClient {
    return {
      organizationMaster: {
        create: (args) => this.createOrganizationWithClient(client, args),
      },
      userMaster: {
        create: (args) =>
          this.createBareUserWithClient(client, {
            ...args.data,
            authProviders: {
              create: {
                provider: 'EMAIL',
                providerId: args.data.email.toLowerCase(),
              },
            },
          }),
      },
      userAuthProvider: {
        create: (args) => this.createUserAuthProviderWithClient(client, args),
      },
    };
  }

  private async createOrganizationWithClient(
    client: Pool | PoolClient,
    { data }: CreateOrganizationArgs,
  ): Promise<OrganizationMasterRecord> {
    const result = await client.query<OrganizationMasterRecord>(
      `
        INSERT INTO "OrganizationMaster" (
          name,
          slug,
          email,
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [data.name, data.slug, data.email],
    );

    return result.rows[0];
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
