import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { getAllPermissionCodes } from '../../common/constants/permissions.constants';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find({
      order: { name: 'ASC' }
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { id }
    });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { name }
    });
  }

  async create(roleData: Partial<Role>, permissionCodes?: string[]): Promise<Role> {
    const role = this.roleRepository.create({
      ...roleData,
      permissionCodes: permissionCodes || []
    });

    return this.roleRepository.save(role);
  }

  async update(id: string, roleData: Partial<Role>, permissionCodes?: string[]): Promise<Role | null> {
    const role = await this.findById(id);
    if (!role) {
      return null;
    }

    // Обновляем основные поля роли
    Object.assign(role, roleData);

    // Обновляем пермишены если они переданы
    if (permissionCodes !== undefined) {
      role.permissionCodes = permissionCodes;
    }

    return this.roleRepository.save(role);
  }

  async delete(id: string): Promise<void> {
    await this.roleRepository.delete(id);
  }

  async addPermissionToRole(roleId: string, permissionCode: string): Promise<Role | null> {
    const role = await this.findById(roleId);
    if (!role) {
      return null;
    }

    // Проверяем, есть ли уже такой пермишен
    if (!role.permissionCodes.includes(permissionCode)) {
      role.permissionCodes.push(permissionCode);
      return this.roleRepository.save(role);
    }

    return role;
  }

  async removePermissionFromRole(roleId: string, permissionCode: string): Promise<Role | null> {
    const role = await this.findById(roleId);
    if (!role) {
      return null;
    }

    role.permissionCodes = role.permissionCodes.filter(code => code !== permissionCode);
    return this.roleRepository.save(role);
  }

  // Метод для инициализации базовых ролей
  async initializeDefaultRoles(): Promise<void> {
    const adminRole = await this.findByName('Администратор');
    if (!adminRole) {
      // Получаем все коды пермишенов для роли администратора
      const allPermissionCodes = getAllPermissionCodes();
      await this.create({
        name: 'Администратор',
        description: 'Полный доступ ко всем функциям системы'
      }, allPermissionCodes);
    } else {
      // Обновляем существующую роль администратора, добавляя новые пермишены
      const allPermissionCodes = getAllPermissionCodes();
      const currentPermissionCodes = adminRole.permissionCodes || [];
      const newPermissionCodes = allPermissionCodes.filter(code => !currentPermissionCodes.includes(code));
      
      if (newPermissionCodes.length > 0) {
        await this.update(adminRole.id, {}, [...currentPermissionCodes, ...newPermissionCodes]);
      }
    }
  }
}
