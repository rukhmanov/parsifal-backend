import { Controller, Get, Post, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Получить историю уведомлений' })
  @ApiResponse({ status: 200, description: 'История уведомлений получена успешно' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество уведомлений' })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'Дата для пагинации (ISO string)' })
  async getNotifications(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const userId = req.user.id;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const beforeDate = before ? new Date(before) : undefined;
    
    return await this.notificationService.getNotifications(userId, limitNum, beforeDate);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Отметить уведомление как прочитанное' })
  @ApiResponse({ status: 200, description: 'Уведомление отмечено как прочитанное' })
  async markAsRead(@Param('id') notificationId: string, @Request() req: any) {
    const userId = req.user.id;
    await this.notificationService.markAsRead(notificationId, userId);
    return { message: 'Уведомление отмечено как прочитанное' };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Отметить все уведомления как прочитанные' })
  @ApiResponse({ status: 200, description: 'Все уведомления отмечены как прочитанные' })
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.id;
    await this.notificationService.markAllAsRead(userId);
    return { message: 'Все уведомления отмечены как прочитанные' };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Получить количество непрочитанных уведомлений' })
  @ApiResponse({ status: 200, description: 'Количество непрочитанных уведомлений' })
  async getUnreadCount(@Request() req: any) {
    const userId = req.user.id;
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }
}

