import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../entities/user/user.entity';
import { UserService } from '../../entities/user/user.service';

export const ALLOW_SELF_UPDATE_KEY = 'allowSelfUpdate';

export const AllowSelfUpdate = () => SetMetadata(ALLOW_SELF_UPDATE_KEY, true);

@Injectable()
export class SelfUpdateGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowSelfUpdate = this.reflector.getAllAndOverride<boolean>(
      ALLOW_SELF_UPDATE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowSelfUpdate) {
      return true; // Если декоратор не применен, разрешаем доступ
    }

    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    const userId = request.params.id;

    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    // Проверяем, что пользователь обновляет сам себя
    if (user.id !== userId) {
      throw new ForbiddenException('Можно обновлять только свой собственный профиль');
    }

    // Загружаем текущие данные пользователя из БД
    const currentUser = await this.userService.findById(userId);
    if (!currentUser) {
      throw new ForbiddenException('Пользователь не найден');
    }

    // Проверяем, что изменяются только разрешенные поля
    const updateData = request.body;
    
    // Временное логирование для отладки
    console.log('=== SelfUpdateGuard Debug ===');
    console.log('User ID:', userId);
    console.log('Current user ID:', user.id);
    console.log('Request body:', request.body);
    console.log('Request body type:', typeof request.body);
    console.log('Request body keys:', Object.keys(request.body || {}));
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    console.log('Current user data:', JSON.stringify({
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      displayName: currentUser.displayName,
      roleId: currentUser.roleId,
      isActive: currentUser.isActive
    }, null, 2));
    
    // Проверяем, что body существует
    if (!updateData || typeof updateData !== 'object') {
      console.log('Body is empty or not an object:', updateData);
      throw new ForbiddenException('Необходимо передать данные для обновления');
    }
    
    const allowedFields = ['firstName', 'lastName', 'displayName', 'avatar'];
    const restrictedFields = ['email', 'roleId', 'isActive', 'authProvider', 'providerId'];

    // Определяем, какие поля действительно изменились
    const changedFields: string[] = [];
    for (const field of allowedFields) {
      const currentValue = currentUser[field as keyof User];
      const newValue = updateData[field];
      
      if (updateData.hasOwnProperty(field) && currentValue !== newValue) {
        changedFields.push(field);
      }
    }

    // Проверяем, что не изменяются запрещенные поля
    for (const field of restrictedFields) {
      if (updateData.hasOwnProperty(field)) {
        const currentValue = currentUser[field as keyof User];
        const newValue = updateData[field];
        
        // Проверяем только если поле действительно изменилось
        if (currentValue !== newValue) {
          throw new ForbiddenException(`Нельзя изменять поле: ${field}`);
        }
      }
    }

    // Проверяем, что изменяется хотя бы одно разрешенное поле
    if (changedFields.length === 0) {
      throw new ForbiddenException('Необходимо указать хотя бы одно разрешенное поле для обновления');
    }

    // Устанавливаем флаг, что самообновление разрешено
    request.selfUpdateAllowed = true;

    return true;
  }
}