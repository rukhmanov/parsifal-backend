import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions.constants';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionController {
  @Get()
  @ApiOperation({ summary: 'Получить список всех разрешений' })
  @ApiResponse({ status: 200, description: 'Список разрешений получен успешно' })
  @ApiBearerAuth('JWT-auth')
  async findAll(): Promise<any[]> {
    // Возвращаем захардкоженные пермишены из констант с добавлением id (используем code как id)
    return PERMISSIONS.map(permission => ({
      id: permission.code, // Используем code как id, так как нет БД
      name: permission.name,
      code: permission.code,
      description: permission.description,
      category: permission.category
    }));
  }
}
