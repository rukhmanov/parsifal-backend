import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendRequest } from './friend-request.entity';
import { FriendRequestService } from './friend-request.service';
import { FriendRequestController } from './friend-request.controller';
import { User } from '../user/user.entity';
import { Friend } from '../friend/friend.entity';
import { UserModule } from '../user/user.module';
import { NotificationModule } from '../notification/notification.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { CommonModule } from '../../common/common.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    TypeOrmModule.forFeature([FriendRequest, Friend, User]),
    UserModule,
    NotificationModule,
    forwardRef(() => WebSocketModule),
    CommonModule,
    PassportModule
  ],
  controllers: [FriendRequestController],
  providers: [FriendRequestService, JwtAuthGuard, JwtStrategy],
  exports: [FriendRequestService],
})
export class FriendRequestModule {}

