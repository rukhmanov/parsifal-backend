import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PollingService } from './polling.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('polling')
@Controller('poll')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PollingController {
  constructor(private readonly pollingService: PollingService) {}

  @Get()
  @ApiOperation({ summary: 'Получить данные для polling (чаты, заявки, оповещения)' })
  @ApiResponse({ status: 200, description: 'Данные получены успешно' })
  async getPollingData(@Request() req: any) {
    const userId = req.user.id;
    return await this.pollingService.getPollingData(userId);
  }
}

