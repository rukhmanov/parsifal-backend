import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CommonModule } from '../../common/common.module';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CommonModule, RoleModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
