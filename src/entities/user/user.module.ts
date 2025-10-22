import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { CommonModule } from '../../common/common.module';
import { RoleModule } from '../role/role.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { SelfUpdateGuard } from '../../common/guards/self-update.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    CommonModule, 
    RoleModule,
    PassportModule
  ],
  controllers: [UserController],
  providers: [UserService, JwtAuthGuard, JwtStrategy, SelfUpdateGuard],
  exports: [UserService],
})
export class UserModule {}
