import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { getAllPermissionCodes, ADMIN_ROLE_ID, ADMIN_ROLE_NAME, getAdminRole } from '../../common/constants/permissions.constants';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    const roles = await this.roleRepository.find({
      order: { name: 'ASC' }
    });
    
    // Всегда добавляем захардкоженную роль администратора в начало списка
    const adminRole = getAdminRole();
    return [adminRole, ...roles];
  }

  async findById(id: string): Promise<Role | null> {
    // Если запрашивается роль администратора, возвращаем захардкоженную
    if (id === ADMIN_ROLE_ID) {
      return getAdminRole();
    }
    
    return this.roleRepository.findOne({
      where: { id }
    });
  }

  async findByName(name: string): Promise<Role | null> {
    // Если запрашивается роль администратора, возвращаем захардкоженную
    if (name === ADMIN_ROLE_NAME) {
      return getAdminRole();
    }
    
    return this.roleRepository.findOne({
      where: { name }
    });
  }

  async create(roleData: Partial<Role>, permissionCodes?: string[]): Promise<Role> {
    // Запрещаем создание роли администратора
    if (roleData.name === ADMIN_ROLE_NAME) {
      throw new ForbiddenException('Роль администратора захардкожена и не может быть создана');
    }
    
    const role = this.roleRepository.create({
      ...roleData,
      permissionCodes: permissionCodes || []
    });

    return this.roleRepository.save(role);
  }

  async update(id: string, roleData: Partial<Role>, permissionCodes?: string[]): Promise<Role | null> {
    // Запрещаем обновление роли администратора
    if (id === ADMIN_ROLE_ID) {
      throw new ForbiddenException('Роль администратора захардкожена и не может быть изменена');
    }
    
    const role = await this.findById(id);
    if (!role) {
      return null;
    }

    // Запрещаем переименование роли в "Администратор"
    if (roleData.name === ADMIN_ROLE_NAME) {
      throw new ForbiddenException('Нельзя переименовать роль в "Администратор"');
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
    // Запрещаем удаление роли администратора
    if (id === ADMIN_ROLE_ID) {
      throw new ForbiddenException('Роль администратора захардкожена и не может быть удалена');
    }
    
    await this.roleRepository.delete(id);
  }

  async addPermissionToRole(roleId: string, permissionCode: string): Promise<Role | null> {
    // Роль администратора захардкожена, не нужно добавлять пермишены
    if (roleId === ADMIN_ROLE_ID) {
      throw new ForbiddenException('Роль администратора захардкожена и не может быть изменена');
    }
    
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
    // Роль администратора захардкожена, не нужно удалять пермишены
    if (roleId === ADMIN_ROLE_ID) {
      throw new ForbiddenException('Роль администратора захардкожена и не может быть изменена');
    }
    
    const role = await this.findById(roleId);
    if (!role) {
      return null;
    }

    role.permissionCodes = role.permissionCodes.filter(code => code !== permissionCode);
    return this.roleRepository.save(role);
  }

  // Метод для инициализации базовых ролей
  async initializeDefaultRoles(): Promise<void> {
    // Роль администратора теперь захардкожена, не нужно создавать её в БД
    // Удаляем роль администратора из БД, если она там есть (для миграции)
    const existingAdminRole = await this.roleRepository.findOne({
      where: { name: ADMIN_ROLE_NAME }
    });
    
    if (existingAdminRole) {
      // Проверяем, есть ли пользователи с этой ролью
      const usersWithAdminRole = await this.roleRepository.manager
        .createQueryBuilder()
        .select('COUNT(*)', 'count')
        .from('users', 'users')
        .where('users.roleId = :roleId', { roleId: existingAdminRole.id })
        .getRawOne();
      
      const userCount = parseInt(usersWithAdminRole?.count || '0', 10);
      
      if (userCount > 0) {
        // Обновляем всех пользователей с ролью администратора на захардкоженный ID
        await this.roleRepository.manager
          .createQueryBuilder()
          .update('users')
          .set({ roleId: ADMIN_ROLE_ID })
          .where('roleId = :roleId', { roleId: existingAdminRole.id })
          .execute();
      }
      
      // Удаляем роль администратора из БД
      await this.roleRepository.delete(existingAdminRole.id);
    }
  }
}
