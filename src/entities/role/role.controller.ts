import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { Role } from './role.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { PERMISSIONS, getAllPermissionCodes, PermissionDefinition } from '../../common/constants/permissions.constants';

export interface CreateRoleDto {
  name: string;
  description: string;
  permissionCodes?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionCodes?: string[];
}

@ApiTags('roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех ролей' })
  @ApiResponse({ status: 200, description: 'Список ролей получен успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.view'])
  async findAll(): Promise<any[]> {
    const roles = await this.roleService.findAll();
    
    // Загружаем пермишены для каждой роли (из констант, а не из БД)
    const rolesWithPermissions = roles.map((role) => {
      let permissionCodes = role.permissionCodes || [];
      
      // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
      if (role.name === 'Администратор' && permissionCodes.length === 0) {
        permissionCodes = getAllPermissionCodes();
      }
      
      // Получаем пермишены из констант по кодам
      const permissions = permissionCodes
        .map(code => PERMISSIONS.find(p => p.code === code))
        .filter((permission): permission is PermissionDefinition => permission !== undefined)
        .map(permission => ({
          id: permission.code, // Используем code как id, так как нет БД
          name: permission.name,
          code: permission.code,
          description: permission.description
        }));

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        permissionCodes: role.permissionCodes,
        permissions: permissions,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      };
    });

    return rolesWithPermissions;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.view'])
  async findById(@Param('id') id: string): Promise<any | null> {
    const role = await this.roleService.findById(id);
    
    if (!role) {
      return null;
    }

    // Загружаем пермишены для роли (из констант, а не из БД)
    let permissionCodes = role.permissionCodes || [];
    
    // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
    if (role.name === 'Администратор' && permissionCodes.length === 0) {
      permissionCodes = getAllPermissionCodes();
    }
    
    // Получаем пермишены из констант по кодам
    const permissions = permissionCodes
      .map(code => PERMISSIONS.find(p => p.code === code))
      .filter((permission): permission is PermissionDefinition => permission !== undefined)
      .map(permission => ({
        id: permission.code, // Используем code как id, так как нет БД
        name: permission.name,
        code: permission.code,
        description: permission.description
      }));

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissionCodes: role.permissionCodes,
      permissions: permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }

  @Post()
  @ApiOperation({ summary: 'Создать новую роль' })
  @ApiResponse({ status: 201, description: 'Роль создана успешно' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав для создания ролей' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.create'])
  async create(@Body() roleData: CreateRoleDto): Promise<Role> {
    return this.roleService.create(roleData, roleData.permissionCodes);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить роль' })
  @ApiResponse({ status: 200, description: 'Роль обновлена успешно' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав для редактирования ролей' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.edit'])
  async update(
    @Param('id') id: string,
    @Body() roleData: UpdateRoleDto
  ): Promise<Role | null> {
    return this.roleService.update(id, roleData, roleData.permissionCodes);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить роль' })
  @ApiResponse({ status: 204, description: 'Роль удалена успешно' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав для удаления ролей' })
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.delete'])
  async delete(@Param('id') id: string): Promise<void> {
    return this.roleService.delete(id);
  }

  @Post(':id/permissions/:permissionCode')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.edit'])
  async addPermissionToRole(
    @Param('id') roleId: string,
    @Param('permissionCode') permissionCode: string
  ): Promise<Role | null> {
    return this.roleService.addPermissionToRole(roleId, permissionCode);
  }

  @Delete(':id/permissions/:permissionCode')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['roles.edit'])
  async removePermissionFromRole(
    @Param('id') roleId: string,
    @Param('permissionCode') permissionCode: string
  ): Promise<Role | null> {
    return this.roleService.removePermissionFromRole(roleId, permissionCode);
  }

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initializeDefaultRoles(): Promise<{ message: string }> {
    await this.roleService.initializeDefaultRoles();
    return { message: 'Default roles initialized successfully' };
  }
}
