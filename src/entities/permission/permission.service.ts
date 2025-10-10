import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './permission.entity';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permissionRepository.find({
      order: { name: 'ASC' }
    });
  }

  async findById(id: string): Promise<Permission | null> {
    return this.permissionRepository.findOne({
      where: { id },
      relations: ['roles']
    });
  }

  async findByCode(code: string): Promise<Permission | null> {
    return this.permissionRepository.findOne({
      where: { code }
    });
  }

  async create(permissionData: Partial<Permission>): Promise<Permission> {
    const permission = this.permissionRepository.create(permissionData);
    return this.permissionRepository.save(permission);
  }

  async update(id: string, permissionData: Partial<Permission>): Promise<Permission | null> {
    await this.permissionRepository.update(id, permissionData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.permissionRepository.delete(id);
  }

  // Метод для инициализации базовых пермишенов
  async initializeDefaultPermissions(): Promise<void> {
    const defaultPermissions = [
      // Пермишены для пользователей
      {
        name: 'Просмотр пользователей',
        description: 'Возможность просматривать список пользователей',
        code: 'users.view'
      },
      {
        name: 'Редактирование пользователей',
        description: 'Возможность редактировать данные пользователей',
        code: 'users.edit'
      },
      {
        name: 'Создание пользователей',
        description: 'Возможность создавать новых пользователей',
        code: 'users.create'
      },
      {
        name: 'Удаление пользователей',
        description: 'Возможность удалять пользователей',
        code: 'users.delete'
      },
      // Пермишены для ролей
      {
        name: 'Просмотр ролей',
        description: 'Возможность просматривать список ролей',
        code: 'roles.view'
      },
      {
        name: 'Редактирование ролей',
        description: 'Возможность редактировать данные ролей',
        code: 'roles.edit'
      },
      {
        name: 'Создание ролей',
        description: 'Возможность создавать новые роли',
        code: 'roles.create'
      },
      {
        name: 'Удаление ролей',
        description: 'Возможность удалять роли',
        code: 'roles.delete'
      }
    ];

    for (const permissionData of defaultPermissions) {
      const existingPermission = await this.findByCode(permissionData.code);
      if (!existingPermission) {
        await this.create(permissionData);
      }
    }
  }
}
