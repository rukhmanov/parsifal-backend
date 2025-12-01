import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../entities/user/user.entity';
import { getAllPermissionCodes } from '../constants/permissions.constants';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true; // Если пермишены не требуются, разрешаем доступ
    }

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    // Проверяем, прошел ли SelfUpdateGuard (если он был применен)
    // Если пользователь обновляет сам себя с разрешенными полями, пропускаем проверку пермишенов
    if (request.selfUpdateAllowed) {
      return true;
    }

    // Если у пользователя нет роли, запрещаем доступ
    if (!user.role) {
      throw new ForbiddenException('У пользователя нет необходимых прав доступа');
    }

    // Получаем пермишены пользователя
    let userPermissions = user.role.permissionCodes || [];
    
    // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
    if (user.role.name === 'Администратор' && userPermissions.length === 0) {
      userPermissions = getAllPermissionCodes();
    }

    // Если у пользователя все еще нет пермишенов, запрещаем доступ
    if (userPermissions.length === 0) {
      throw new ForbiddenException('У пользователя нет необходимых прав доступа');
    }

    // Проверяем, есть ли у пользователя хотя бы один из требуемых пермишенов
    const hasRequiredPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasRequiredPermission) {
      throw new ForbiddenException(
        `Недостаточно прав. Требуемые пермишены: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
