import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { AppUsersController } from './app-users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [UsersController, AppUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
