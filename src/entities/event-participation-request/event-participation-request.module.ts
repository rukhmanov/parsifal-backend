import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventParticipationRequest } from './event-participation-request.entity';
import { EventParticipationRequestService } from './event-participation-request.service';
import { EventParticipationRequestController } from './event-participation-request.controller';
import { Event } from '../event/event.entity';
import { User } from '../user/user.entity';
import { Friend } from '../friend/friend.entity';
import { UserModule } from '../user/user.module';
import { EventModule } from '../event/event.module';
import { NotificationModule } from '../notification/notification.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ChatModule } from '../chat/chat.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventParticipationRequest, Event, User, Friend]),
    UserModule,
    EventModule,
    NotificationModule,
    forwardRef(() => WebSocketModule),
    forwardRef(() => ChatModule),
    PassportModule
  ],
  controllers: [EventParticipationRequestController],
  providers: [EventParticipationRequestService, JwtAuthGuard, JwtStrategy],
  exports: [EventParticipationRequestService],
})
export class EventParticipationRequestModule {}

