import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { Permission } from '../permission/permission.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: ['permissions', 'users'],
      order: { name: 'ASC' }
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { id },
      relations: ['permissions', 'users']
    });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.roleRepository.findOne({
      where: { name },
      relations: ['permissions']
    });
  }

  // Метод для получения роли пользователя по умолчанию
  async getDefaultUserRole(): Promise<Role> {
    let userRole = await this.findByName('Пользователь');
    
    if (!userRole) {
      // Если роль не найдена, создаем её
      userRole = await this.create({
        name: 'Пользователь',
        description: 'Базовые права пользователя',
        isActive: true
      });
    }
    
    return userRole;
  }

  async create(roleData: Partial<Role>, permissionIds?: string[]): Promise<Role> {
    const role = this.roleRepository.create(roleData);
    
    if (permissionIds && permissionIds.length > 0) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      role.permissions = permissions;
    }

    return this.roleRepository.save(role);
  }

  async update(id: string, roleData: Partial<Role>, permissionIds?: string[]): Promise<Role | null> {
    const role = await this.findById(id);
    if (!role) {
      return null;
    }

    // Обновляем основные поля роли
    Object.assign(role, roleData);

    // Обновляем пермишены если они переданы
    if (permissionIds !== undefined) {
      const permissions = await this.permissionRepository.findByIds(permissionIds);
      role.permissions = permissions;
    }

    return this.roleRepository.save(role);
  }

  async delete(id: string): Promise<void> {
    await this.roleRepository.delete(id);
  }

  async addPermissionToRole(roleId: string, permissionId: string): Promise<Role | null> {
    const role = await this.findById(roleId);
    const permission = await this.permissionRepository.findOne({ where: { id: permissionId } });

    if (!role || !permission) {
      return null;
    }

    // Проверяем, есть ли уже такой пермишен
    const hasPermission = role.permissions.some(p => p.id === permissionId);
    if (!hasPermission) {
      role.permissions.push(permission);
      return this.roleRepository.save(role);
    }

    return role;
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<Role | null> {
    const role = await this.findById(roleId);
    if (!role) {
      return null;
    }

    role.permissions = role.permissions.filter(p => p.id !== permissionId);
    return this.roleRepository.save(role);
  }

  // Метод для инициализации базовых ролей
  async initializeDefaultRoles(): Promise<void> {
    const adminRole = await this.findByName('Администратор');
    if (!adminRole) {
      // Получаем все пермишены для роли администратора
      const allPermissions = await this.permissionRepository.find();
      await this.create({
        name: 'Администратор',
        description: 'Полный доступ ко всем функциям системы',
        isActive: true
      }, allPermissions.map(p => p.id));
    } else {
      // Обновляем существующую роль администратора, добавляя новые пермишены
      const allPermissions = await this.permissionRepository.find();
      const currentPermissionIds = adminRole.permissions.map(p => p.id);
      const newPermissionIds = allPermissions.filter(p => !currentPermissionIds.includes(p.id)).map(p => p.id);
      
      if (newPermissionIds.length > 0) {
        await this.update(adminRole.id, {}, [...currentPermissionIds, ...newPermissionIds]);
      }
    }

    const userRole = await this.findByName('Пользователь');
    if (!userRole) {
      // Создаем роль пользователя без особых пермишенов
      await this.create({
        name: 'Пользователь',
        description: 'Базовые права пользователя',
        isActive: true
      });
    }
  }
}
