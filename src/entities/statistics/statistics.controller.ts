import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('users')
  @ApiOperation({ summary: 'Получить статистику пользователей' })
  @ApiResponse({ status: 200, description: 'Статистика пользователей получена успешно' })
  @ApiBearerAuth('JWT-auth')
  async getUserStatistics() {
    return this.statisticsService.getUserStatistics();
  }
}
