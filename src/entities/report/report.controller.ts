import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Подать жалобу на пользователя' })
  @ApiResponse({ status: 201, description: 'Жалоба успешно создана' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async create(@Body() createReportDto: CreateReportDto, @Request() req: any) {
    const userId = req.user.id;
    return this.reportService.create(userId, createReportDto);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['reports.view'])
  @ApiOperation({ summary: 'Получить все жалобы (только для администраторов)' })
  @ApiResponse({ status: 200, description: 'Список жалоб' })
  async findAll() {
    // Можно добавить фильтрацию по статусу через query параметры
    return this.reportService.findAll();
  }

  @Get('my-reports')
  @ApiOperation({ summary: 'Получить мои жалобы' })
  @ApiResponse({ status: 200, description: 'Список моих жалоб' })
  async getMyReports(@Request() req: any) {
    const userId = req.user.id;
    return this.reportService.getReportsByReporter(userId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['reports.view'])
  @ApiOperation({ summary: 'Получить жалобу по ID (только для администраторов)' })
  @ApiResponse({ status: 200, description: 'Жалоба найдена' })
  @ApiResponse({ status: 404, description: 'Жалоба не найдена' })
  async findOne(@Param('id') id: string) {
    return this.reportService.findById(id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['reports.update'])
  @ApiOperation({ summary: 'Обновить жалобу (только для администраторов)' })
  @ApiResponse({ status: 200, description: 'Жалоба обновлена' })
  @ApiResponse({ status: 404, description: 'Жалоба не найдена' })
  async update(@Param('id') id: string, @Body() updateReportDto: UpdateReportDto, @Request() req: any) {
    const userId = req.user.id;
    return this.reportService.update(id, userId, updateReportDto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['reports.delete'])
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить жалобу (только для администраторов)' })
  @ApiResponse({ status: 204, description: 'Жалоба удалена' })
  @ApiResponse({ status: 404, description: 'Жалоба не найдена' })
  async remove(@Param('id') id: string) {
    await this.reportService.delete(id);
  }
}

