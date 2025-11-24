import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PollingController } from './polling.controller';
import { PollingService } from './polling.service';
import { ChatModule } from '../chat/chat.module';
import { FriendRequest } from '../friend-request/friend-request.entity';
import { EventParticipationRequest } from '../event-participation-request/event-participation-request.entity';
import { Event } from '../event/event.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FriendRequest, EventParticipationRequest, Event]),
    ChatModule,
  ],
  controllers: [PollingController],
  providers: [PollingService],
  exports: [PollingService],
})
export class PollingModule {}

