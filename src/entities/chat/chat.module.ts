import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Chat } from './chat.entity';
import { Message } from './message.entity';
import { ChatParticipant } from './chat-participant.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { User } from '../user/user.entity';
import { EventModule } from '../event/event.module';
import { Event } from '../event/event.entity';
import { NotificationModule } from '../notification/notification.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, Message, ChatParticipant, User, Event]),
    PassportModule,
    UserModule,
    EventModule,
    NotificationModule,
    forwardRef(() => WebSocketModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, JwtAuthGuard, JwtStrategy],
  exports: [ChatService],
})
export class ChatModule {}

