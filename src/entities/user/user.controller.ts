import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UserService } from './user.service';
import { User } from './user.entity';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';
import { S3Service } from '../../common/services/s3.service';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatar?: string;
  authProvider: 'google' | 'yandex' | 'local';
  providerId: string;
  roleId?: string;
  isActive?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: string;
  roleId?: string;
  isActive?: boolean;
}

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly s3Service: S3Service
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получить список всех пользователей' })
  @ApiResponse({ status: 200, description: 'Список пользователей получен успешно' })
  @ApiBearerAuth('JWT-auth')
  // @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @RequirePermissions(['users.view'])
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @RequirePermissions(['users.view'])
  async findById(@Param('id') id: string): Promise<User | null> {
    return this.userService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать нового пользователя' })
  @ApiResponse({ status: 201, description: 'Пользователь создан успешно' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации данных' })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
        firstName: { type: 'string', example: 'Иван' },
        lastName: { type: 'string', example: 'Иванов' },
        displayName: { type: 'string', example: 'Иван Иванов' },
        avatar: { type: 'string', example: 'https://example.com/avatar.jpg' },
        authProvider: { type: 'string', enum: ['google', 'yandex', 'local'] },
        providerId: { type: 'string', example: 'google_123456' },
        isActive: { type: 'boolean', example: true }
      },
      required: ['email', 'firstName', 'lastName', 'authProvider', 'providerId']
    }
  })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.create'])
  async create(@Body() userData: CreateUserDto): Promise<User> {
    // Удаляем roleId из данных, чтобы при создании пользователя роль всегда была null
    const { roleId, ...dataWithoutRoleId } = userData;
    return this.userService.create({ ...dataWithoutRoleId, roleId: undefined } as Partial<User>);
  }

  // PATCH эндпоинт для обновления полей пользователя (без фото)
  @Patch(':id')
  @ApiOperation({ summary: 'Частично обновить данные пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь успешно обновлен' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав для обновления' })
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'Иван' },
        lastName: { type: 'string', example: 'Иванов' },
        email: { type: 'string', example: 'user@example.com' },
        roleId: { type: 'string', example: 'role-uuid' },
        isActive: { type: 'boolean', example: true }
      }
    }
  })
  @UseGuards(JwtAuthGuard)
  async patchUser(
    @Param('id') id: string,
    @Body() userData: UpdateUserDto,
    @Request() req?: any
  ): Promise<User | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    // Проверяем, есть ли у пользователя права на редактирование пользователей
    const hasEditPermission = user.role?.permissions?.some(
      (permission: { code: string }) => permission.code === 'users.edit'
    );

    // Удаляем displayName из данных, так как он будет автоматически сформирован
    // Разрешаем avatar только для удаления (если это пустая строка)
    const { displayName, ...dataWithoutDisplayName } = userData;
    const shouldDeleteAvatar = userData.avatar === '' || userData.avatar === null;

    // Если есть права на редактирование - разрешаем обновление любых полей
    if (hasEditPermission) {
      let updateData: Partial<UpdateUserDto> = { ...dataWithoutDisplayName };
      
      // Если нужно удалить фото, устанавливаем avatar в null
      if (shouldDeleteAvatar) {
        (updateData as any).avatar = null;
      }
      
      // Автоматически формируем displayName из firstName и lastName
      if (updateData.firstName || updateData.lastName) {
        const currentUser = await this.userService.findById(id);
        if (currentUser) {
          const firstName = updateData.firstName ?? currentUser.firstName;
          const lastName = updateData.lastName ?? currentUser.lastName;
          if (firstName && lastName) {
            (updateData as any).displayName = `${firstName} ${lastName}`;
          }
        }
      }
      
      // Преобразуем строковые значения в правильные типы
      if (typeof updateData.isActive === 'string') {
        updateData.isActive = updateData.isActive === 'true';
      }
      
      return this.userService.update(id, updateData);
    }

    // Если прав нет - проверяем, что это самообновление
    if (user.id !== id) {
      throw new ForbiddenException('Недостаточно прав для обновления этого пользователя');
    }

    // Это самообновление - проверяем разрешенные поля (только имя, фамилия)
    const currentUser = await this.userService.findById(id);
    if (!currentUser) {
      throw new ForbiddenException('Пользователь не найден');
    }

    const allowedFields = ['firstName', 'lastName'];
    const restrictedFields = ['email', 'roleId', 'isActive', 'authProvider', 'providerId'];

    // Проверяем, что не изменяются запрещенные поля
    for (const field of restrictedFields) {
      if (field in dataWithoutDisplayName) {
        const currentValue = currentUser[field as keyof User];
        let newValue = (dataWithoutDisplayName as any)[field];
        
        // Преобразуем строковые значения для корректного сравнения
        if (field === 'isActive' && typeof newValue === 'string') {
          newValue = newValue === 'true' as any;
        }
        
        // Проверяем только если значение действительно изменилось
        if (currentValue !== newValue) {
          throw new ForbiddenException(`Нельзя изменять поле: ${field}`);
        }
      }
    }

    // Проверяем, что изменяется хотя бы одно разрешенное поле
    const changedFields: string[] = [];
    for (const field of allowedFields) {
      if (field in dataWithoutDisplayName) {
        const currentValue = currentUser[field as keyof User];
        const newValue = (dataWithoutDisplayName as any)[field];
        
        if (currentValue !== newValue) {
          changedFields.push(field);
        }
      }
    }

    if (changedFields.length === 0) {
      throw new ForbiddenException('Необходимо указать хотя бы одно разрешенное поле для обновления');
    }

    // Формируем данные для обновления (только разрешенные поля)
    let updateData: Partial<UpdateUserDto> = {};
    
    if ('firstName' in dataWithoutDisplayName) {
      updateData.firstName = dataWithoutDisplayName.firstName;
    }
    if ('lastName' in dataWithoutDisplayName) {
      updateData.lastName = dataWithoutDisplayName.lastName;
    }
    
    // Автоматически формируем displayName из firstName и lastName
    if (updateData.firstName || updateData.lastName) {
      const firstName = updateData.firstName ?? currentUser.firstName;
      const lastName = updateData.lastName ?? currentUser.lastName;
      if (firstName && lastName) {
        (updateData as any).displayName = `${firstName} ${lastName}`;
      }
    }
    
    return this.userService.update(id, updateData);
  }

  // POST эндпоинт для обновления только фото
  @Post(':id/photo')
  @ApiOperation({ summary: 'Обновить фото профиля пользователя' })
  @ApiResponse({ status: 200, description: 'Фото успешно обновлено' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав для обновления' })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  @UseGuards(JwtAuthGuard)
  async updatePhoto(
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File,
    @Request() req?: any
  ): Promise<User | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    if (!photo) {
      throw new ForbiddenException('Фото не предоставлено');
    }

    // Проверяем, есть ли у пользователя права на редактирование пользователей
    const hasEditPermission = user.role?.permissions?.some(
      (permission: { code: string }) => permission.code === 'users.edit'
    );

    // Если прав нет - проверяем, что это самообновление
    if (!hasEditPermission && user.id !== id) {
      throw new ForbiddenException('Недостаточно прав для обновления фото этого пользователя');
    }

    // Загружаем фото
    const fileKey = `users/${id}/profile-photo.${photo.originalname.split('.').pop()}`;
    const fileUrl = await this.s3Service.uploadFile(photo, fileKey);

    // Обновляем только avatar
    return this.userService.update(id, { avatar: fileUrl });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.delete'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.userService.delete(id);
  }

  @Post('filter')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.view'])
  async findAllWithFilters(@Body() request: FilterRequestDto): Promise<FilterResponseDto<User>> {
    return this.userService.findAllWithFilters(request);
  }

}
