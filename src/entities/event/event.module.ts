import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Event } from './event.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { User } from '../user/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, User]),
    PassportModule,
    UserModule
  ],
  controllers: [EventController],
  providers: [EventService, JwtAuthGuard, JwtStrategy],
  exports: [EventService],
})
export class EventModule {}

