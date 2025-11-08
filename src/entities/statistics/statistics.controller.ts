import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('users')
  @ApiOperation({ summary: 'Получить статистику пользователей' })
  @ApiResponse({ status: 200, description: 'Статистика пользователей получена успешно' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав для просмотра статистики' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['statistics.view'])
  async getUserStatistics() {
    return this.statisticsService.getUserStatistics();
  }
}
