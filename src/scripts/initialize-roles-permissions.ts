import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PermissionService } from '../entities/permission/permission.service';
import { RoleService } from '../entities/role/role.service';

async function initializeRolesAndPermissions() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const permissionService = app.get(PermissionService);
  const roleService = app.get(RoleService);

  try {
    console.log('Инициализация пермишенов...');
    await permissionService.initializeDefaultPermissions();
    console.log('Пермишены успешно инициализированы');

    console.log('Инициализация ролей...');
    await roleService.initializeDefaultRoles();
    console.log('Роли успешно инициализированы');

    console.log('Инициализация завершена успешно!');
  } catch (error) {
    console.error('Ошибка инициализации:', error);
  } finally {
    await app.close();
  }
}

// Запуск скрипта
if (require.main === module) {
  initializeRolesAndPermissions();
}
