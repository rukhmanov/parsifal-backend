import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Event } from './event.entity';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { User } from '../user/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { CommonModule } from '../../common/common.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, User]),
    PassportModule,
    forwardRef(() => UserModule),
    NotificationModule,
    CommonModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [EventController],
  providers: [EventService, JwtAuthGuard, JwtStrategy],
  exports: [EventService],
})
export class EventModule {}

