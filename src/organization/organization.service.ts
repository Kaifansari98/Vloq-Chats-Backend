import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgDto } from './dto/create-org.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(data: CreateOrgDto) {
    const { organizationName, slug, email, password, adminName } = data;

    // 🔹 check slug exists
    const existingOrg = await this.prisma.organizationMaster.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      throw new ConflictException('Slug already exists');
    }

    // 🔹 hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 find ADMIN role
    const adminRole = await this.prisma.userTypeMaster.findUnique({
      where: { code: 'ADMIN' },
    });

    if (!adminRole) {
      throw new BadRequestException('ADMIN role not found');
    }

    // 🔹 transaction (VERY IMPORTANT)
    const result = await this.prisma.$transaction(async (tx) => {
      // 1️⃣ Create organization
      const org = await tx.organizationMaster.create({
        data: {
          name: organizationName,
          slug,
          email,
        },
      });

      // 2️⃣ Create admin user
      const user = await tx.userMaster.create({
        data: {
          name: adminName,
          email: email.toLowerCase(),
          password: hashedPassword,
          organizationId: org.id,
          userTypeId: adminRole.id,
        },
      });

      // 3️⃣ Create auth provider
      await tx.userAuthProvider.create({
        data: {
          userId: user.id,
          provider: 'EMAIL',
          providerId: email.toLowerCase(),
        },
      });

      return { org, user };
    });

    const { password: _password, ...safeUser } = result.user;
    void _password;

    return {
      message: 'Organization created successfully',
      data: {
        org: result.org,
        user: safeUser,
      },
    };
  }
}
