import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from './role.entity';

export interface CreateRoleDto {
  name: string;
  description: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  async findAll(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Role | null> {
    return this.roleService.findById(id);
  }

  @Post()
  async create(@Body() roleData: CreateRoleDto): Promise<Role> {
    return this.roleService.create(roleData, roleData.permissionIds);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() roleData: UpdateRoleDto
  ): Promise<Role | null> {
    return this.roleService.update(id, roleData, roleData.permissionIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.roleService.delete(id);
  }

  @Post(':id/permissions/:permissionId')
  async addPermissionToRole(
    @Param('id') roleId: string,
    @Param('permissionId') permissionId: string
  ): Promise<Role | null> {
    return this.roleService.addPermissionToRole(roleId, permissionId);
  }

  @Delete(':id/permissions/:permissionId')
  async removePermissionFromRole(
    @Param('id') roleId: string,
    @Param('permissionId') permissionId: string
  ): Promise<Role | null> {
    return this.roleService.removePermissionFromRole(roleId, permissionId);
  }

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initializeDefaultRoles(): Promise<{ message: string }> {
    await this.roleService.initializeDefaultRoles();
    return { message: 'Default roles initialized successfully' };
  }
}
