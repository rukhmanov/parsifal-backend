import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications/poll')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationPollingController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Получить последние 15 уведомлений для polling' })
  @ApiResponse({ status: 200, description: 'Уведомления получены успешно' })
  async getNotifications(@Request() req: any) {
    const userId = req.user.id;
    const notifications = await this.notificationService.getNotifications(userId, 15);
    return notifications;
  }
}

