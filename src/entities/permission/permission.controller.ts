import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { Permission } from './permission.entity';

@Controller('api/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  async findAll(): Promise<Permission[]> {
    return this.permissionService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Permission | null> {
    return this.permissionService.findById(id);
  }

  @Post()
  async create(@Body() permissionData: Partial<Permission>): Promise<Permission> {
    return this.permissionService.create(permissionData);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() permissionData: Partial<Permission>
  ): Promise<Permission | null> {
    return this.permissionService.update(id, permissionData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.permissionService.delete(id);
  }

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initializeDefaultPermissions(): Promise<{ message: string }> {
    await this.permissionService.initializeDefaultPermissions();
    return { message: 'Default permissions initialized successfully' };
  }
}
