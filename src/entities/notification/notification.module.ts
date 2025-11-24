import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationPollingController } from './notification-polling.controller';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
  ],
  controllers: [NotificationController, NotificationPollingController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

