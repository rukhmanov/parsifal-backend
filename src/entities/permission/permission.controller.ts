import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PERMISSIONS, PermissionDefinition } from '../../common/constants/permissions.constants';

@ApiTags('permissions')
@Controller('permissions')
export class PermissionController {
  @Get()
  @ApiOperation({ summary: 'Получить список всех разрешений' })
  @ApiResponse({ status: 200, description: 'Список разрешений получен успешно' })
  @ApiBearerAuth('JWT-auth')
  async findAll(): Promise<PermissionDefinition[]> {
    // Возвращаем захардкоженные пермишены из констант
    return PERMISSIONS;
  }
}
