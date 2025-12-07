import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile, UseGuards, Request, ForbiddenException, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UserService } from './user.service';
import { User } from './user.entity';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';
import { S3Service } from '../../common/services/s3.service';
import { PermissionsGuard, RequirePermissions } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getAllPermissionCodes } from '../../common/constants/permissions.constants';
import { toSafeUserDto, toAdminUserDto } from '../../common/dto/safe-user.dto';

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
  photos?: string[];
  gender?: 'male' | 'female';
  birthDate?: Date | string;
  about?: string;
  work?: string;
  interests?: string[];
  roleId?: string;
  isActive?: boolean;
  termsAccepted?: boolean;
  privacyAccepted?: boolean;
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
  async findAll(): Promise<any[]> {
    const users = await this.userService.findAll();
    return users.map(user => toSafeUserDto(user));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @RequirePermissions(['users.view'])
  async findById(
    @Param('id') id: string,
    @Request() req?: any
  ): Promise<any | null> {
    const normalizedId = this.normalizeUserId(id);
    const user = await this.userService.findById(normalizedId);
    
    if (!user) {
      return null;
    }
    
    // Проверяем права текущего пользователя
    const currentUser = req?.user;
    if (currentUser) {
      let userPermissionCodes = currentUser.role?.permissionCodes || [];
      
      // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
      if (currentUser.role?.name === 'Администратор' && userPermissionCodes.length === 0) {
        userPermissionCodes = getAllPermissionCodes();
      }
      
      const hasViewPermission = userPermissionCodes.includes('users.view');
      
      // Если есть права на просмотр пользователей, возвращаем данные для админов (без чувствительных полей)
      if (hasViewPermission) {
        return toAdminUserDto(user);
      }
    }
    
    // Иначе возвращаем только безопасные данные
    return toSafeUserDto(user);
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

    // Нормализуем ID (удаляем префикс local_ если есть)
    const normalizedId = this.normalizeUserId(id);
    const normalizedCurrentUserId = this.normalizeUserId(String(user.id));

    // Проверяем, есть ли у пользователя права на редактирование пользователей
    let userPermissionCodes = user.role?.permissionCodes || [];
    
    // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
    if (user.role?.name === 'Администратор' && userPermissionCodes.length === 0) {
      userPermissionCodes = getAllPermissionCodes();
    }
    
    const hasEditPermission = userPermissionCodes.includes('users.edit');

    // Удаляем displayName из данных, так как он будет автоматически сформирован
    // Разрешаем avatar только для удаления (если это пустая строка)
    const { displayName, ...dataWithoutDisplayName } = userData;
    const shouldDeleteAvatar = userData.avatar === '' || userData.avatar === null;

    // Если есть права на редактирование - разрешаем обновление любых полей
    if (hasEditPermission) {
      // Загружаем текущего пользователя для проверки заблокированных полей
      const currentUser = await this.userService.findById(normalizedId);
      if (!currentUser) {
        throw new ForbiddenException('Пользователь не найден');
      }

      let updateData: Partial<UpdateUserDto> = { ...dataWithoutDisplayName };
      
      // Проверяем, что gender и birthDate не изменяются, если они уже установлены
      // Но разрешаем их установку, если они еще не установлены
      if (currentUser.gender && 'gender' in updateData && updateData.gender !== currentUser.gender) {
        throw new ForbiddenException('Нельзя изменить пол, так как он был установлен при регистрации');
      }
      
      if (currentUser.birthDate && 'birthDate' in updateData) {
        const currentBirthDate = currentUser.birthDate instanceof Date 
          ? currentUser.birthDate.toISOString().split('T')[0]
          : new Date(currentUser.birthDate).toISOString().split('T')[0];
        
        let newBirthDate: string;
        if (updateData.birthDate instanceof Date) {
          newBirthDate = updateData.birthDate.toISOString().split('T')[0];
        } else if (typeof updateData.birthDate === 'string') {
          newBirthDate = new Date(updateData.birthDate).toISOString().split('T')[0];
        } else {
          newBirthDate = '';
        }
        
        if (currentBirthDate !== newBirthDate) {
          throw new ForbiddenException('Нельзя изменить дату рождения, так как она была установлена при регистрации');
        }
      } else if (!currentUser.birthDate && 'birthDate' in updateData && updateData.birthDate) {
        // Проверяем возраст при первой установке даты рождения
        const birthDateObj = updateData.birthDate instanceof Date 
          ? updateData.birthDate 
          : new Date(updateData.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
          age--;
        }
        
        if (age < 18) {
          throw new BadRequestException('Для использования сервиса необходимо достичь возраста 18 лет');
        }
      }
      
      // Удаляем gender и birthDate из updateData, если они уже установлены (заблокированы)
      // Но оставляем их, если они еще не установлены (разрешаем установку)
      if (currentUser.gender && 'gender' in updateData) {
        // Если значение не изменилось, удаляем из updateData (не нужно обновлять)
        if (updateData.gender === currentUser.gender) {
          delete updateData.gender;
        }
      }
      if (currentUser.birthDate && 'birthDate' in updateData) {
        // Если значение не изменилось, удаляем из updateData (не нужно обновлять)
        const currentBirthDate = currentUser.birthDate instanceof Date 
          ? currentUser.birthDate.toISOString().split('T')[0]
          : new Date(currentUser.birthDate).toISOString().split('T')[0];
        
        let newBirthDate: string;
        if (updateData.birthDate instanceof Date) {
          newBirthDate = updateData.birthDate.toISOString().split('T')[0];
        } else if (typeof updateData.birthDate === 'string') {
          newBirthDate = new Date(updateData.birthDate).toISOString().split('T')[0];
        } else {
          newBirthDate = '';
        }
        
        if (currentBirthDate === newBirthDate) {
          delete updateData.birthDate;
        }
      }
      
      // Если нужно удалить фото, устанавливаем avatar в null
      if (shouldDeleteAvatar) {
        (updateData as any).avatar = null;
      }
      
      // Автоматически формируем displayName из firstName и lastName
      if (updateData.firstName || updateData.lastName) {
        const firstName = updateData.firstName ?? currentUser.firstName;
        const lastName = updateData.lastName ?? currentUser.lastName;
        if (firstName && lastName) {
          (updateData as any).displayName = `${firstName} ${lastName}`;
        }
      }
      
      // Преобразуем строковые значения в правильные типы
      if (typeof updateData.isActive === 'string') {
        updateData.isActive = updateData.isActive === 'true';
      }
      
      // Преобразуем birthDate в Date, если он есть и не заблокирован
      let birthDateAsDate: Date | undefined = undefined;
      if (updateData.birthDate) {
        if (updateData.birthDate instanceof Date) {
          birthDateAsDate = updateData.birthDate;
        } else if (typeof updateData.birthDate === 'string') {
          birthDateAsDate = new Date(updateData.birthDate);
        }
      }
      
      // Преобразуем updateData в правильный тип для userService.update
      const finalUpdateData: Partial<User> = {
        ...updateData,
        birthDate: birthDateAsDate
      };
      
      return this.userService.update(normalizedId, finalUpdateData);
    }

    // Если прав нет - проверяем, что это самообновление
    if (normalizedCurrentUserId !== normalizedId) {
      throw new ForbiddenException('Недостаточно прав для обновления этого пользователя');
    }

    // Это самообновление - проверяем разрешенные поля (только имя, фамилия)
    const currentUser = await this.userService.findById(normalizedId);
    if (!currentUser) {
      throw new ForbiddenException('Пользователь не найден');
    }

    const allowedFields = ['firstName', 'lastName', 'about', 'work', 'interests'];
    const restrictedFields = ['email', 'roleId', 'isActive', 'authProvider', 'providerId'];

    // Добавляем gender и birthDate в разрешенные поля, если они еще не установлены
    if (!currentUser.gender && 'gender' in dataWithoutDisplayName) {
      allowedFields.push('gender');
    }
    if (!currentUser.birthDate && 'birthDate' in dataWithoutDisplayName) {
      // Проверяем возраст перед добавлением в разрешенные поля
      const newBirthDate = (dataWithoutDisplayName as any).birthDate;
      if (newBirthDate) {
        const birthDateObj = newBirthDate instanceof Date ? newBirthDate : new Date(newBirthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
          age--;
        }
        
        if (age < 18) {
          throw new BadRequestException('Для использования сервиса необходимо достичь возраста 18 лет');
        }
      }
      allowedFields.push('birthDate');
    }

    // Проверяем, что gender и birthDate не изменяются, если они уже установлены
    if (currentUser.gender && 'gender' in dataWithoutDisplayName) {
      if (dataWithoutDisplayName.gender !== currentUser.gender) {
        throw new ForbiddenException('Нельзя изменить пол, так как он был установлен при регистрации');
      }
    }
    
    if (currentUser.birthDate && 'birthDate' in dataWithoutDisplayName) {
      const currentBirthDate = currentUser.birthDate instanceof Date 
        ? currentUser.birthDate.toISOString().split('T')[0]
        : new Date(currentUser.birthDate).toISOString().split('T')[0];
      
      let newBirthDate: string;
      const newValue = (dataWithoutDisplayName as any).birthDate;
      if (newValue instanceof Date) {
        newBirthDate = newValue.toISOString().split('T')[0];
      } else if (typeof newValue === 'string') {
        newBirthDate = new Date(newValue).toISOString().split('T')[0];
      } else {
        newBirthDate = '';
      }
      
      if (currentBirthDate !== newBirthDate) {
        throw new ForbiddenException('Нельзя изменить дату рождения, так как она была установлена при регистрации');
      }
    }

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
        
        // Специальная обработка для массива interests
        if (field === 'interests') {
          const currentInterests = Array.isArray(currentValue) ? currentValue : (currentValue ? [currentValue] : []);
          const newInterests = Array.isArray(newValue) ? newValue : (newValue ? [newValue] : []);
          const currentStr = currentInterests.sort().join(',');
          const newStr = newInterests.sort().join(',');
          if (currentStr !== newStr) {
            changedFields.push(field);
          }
        } else if (currentValue !== newValue) {
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
    if ('about' in dataWithoutDisplayName) {
      updateData.about = dataWithoutDisplayName.about && dataWithoutDisplayName.about.trim() !== '' ? dataWithoutDisplayName.about : undefined;
    }
    if ('work' in dataWithoutDisplayName) {
      updateData.work = dataWithoutDisplayName.work && dataWithoutDisplayName.work.trim() !== '' ? dataWithoutDisplayName.work : undefined;
    }
    if ('interests' in dataWithoutDisplayName) {
      // Преобразуем пустой массив в undefined для TypeORM simple-array
      const interestsValue = dataWithoutDisplayName.interests;
      updateData.interests = (Array.isArray(interestsValue) && interestsValue.length > 0) ? interestsValue : undefined;
    }
    
    // Добавляем gender и birthDate, если они разрешены (еще не установлены)
    if (!currentUser.gender && 'gender' in dataWithoutDisplayName) {
      updateData.gender = dataWithoutDisplayName.gender;
    }
    if (!currentUser.birthDate && 'birthDate' in dataWithoutDisplayName) {
      const birthDateValue = (dataWithoutDisplayName as any).birthDate;
      if (birthDateValue instanceof Date) {
        updateData.birthDate = birthDateValue;
      } else if (typeof birthDateValue === 'string') {
        updateData.birthDate = new Date(birthDateValue);
      }
    }
    
    // Автоматически формируем displayName из firstName и lastName
    if (updateData.firstName || updateData.lastName) {
      const firstName = updateData.firstName ?? currentUser.firstName;
      const lastName = updateData.lastName ?? currentUser.lastName;
      if (firstName && lastName) {
        (updateData as any).displayName = `${firstName} ${lastName}`;
      }
    }
    
    // Преобразуем updateData в правильный тип для userService.update
    const finalUpdateData: Partial<User> = updateData as Partial<User>;
    
    return this.userService.update(normalizedId, finalUpdateData);
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

    // Нормализуем ID (удаляем префикс local_ если есть)
    const normalizedId = this.normalizeUserId(id);
    const normalizedCurrentUserId = this.normalizeUserId(String(user.id));

    // Проверяем, есть ли у пользователя права на редактирование пользователей
    let userPermissionCodes = user.role?.permissionCodes || [];
    
    // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
    if (user.role?.name === 'Администратор' && userPermissionCodes.length === 0) {
      userPermissionCodes = getAllPermissionCodes();
    }
    
    const hasEditPermission = userPermissionCodes.includes('users.edit');

    // Если прав нет - проверяем, что это самообновление
    if (!hasEditPermission && normalizedCurrentUserId !== normalizedId) {
      throw new ForbiddenException('Недостаточно прав для обновления фото этого пользователя');
    }

    // Загружаем фото
    const fileKey = `users/${normalizedId}/profile-photo.${photo.originalname.split('.').pop()}`;
    const fileUrl = await this.s3Service.uploadFile(photo, fileKey);

    // Обновляем только avatar
    return this.userService.update(normalizedId, { avatar: fileUrl });
  }

  // Вспомогательная функция для нормализации ID (удаление префикса local_)
  private normalizeUserId(id: string): string {
    if (id.startsWith('local_')) {
      return id.replace(/^local_/, '');
    }
    return id;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req?: any
  ): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    // Нормализуем ID (удаляем префикс local_ если есть)
    const normalizedId = this.normalizeUserId(id);
    const normalizedCurrentUserId = this.normalizeUserId(String(user.id));

    // Проверяем, что пользователь существует
    const userToDelete = await this.userService.findById(normalizedId);
    if (!userToDelete) {
      throw new ForbiddenException('Пользователь не найден');
    }

    // Проверяем, является ли это самоудалением
    const isSelfDeletion = normalizedCurrentUserId === normalizedId;

    // Если это не самоудаление, проверяем права
    if (!isSelfDeletion) {
      // Загружаем пользователя с ролью и пермишенами для проверки прав
      const userWithPermissions = await this.userService.findById(normalizedCurrentUserId);
      if (!userWithPermissions) {
        throw new ForbiddenException('Пользователь не найден');
      }

      // Проверяем, есть ли у пользователя права на удаление пользователей
      let deletePermissionCodes = userWithPermissions.role?.permissionCodes || [];
      
      // Если у роли администратора пустой массив permissionCodes, используем все коды пермишенов
      if (userWithPermissions.role?.name === 'Администратор' && deletePermissionCodes.length === 0) {
        deletePermissionCodes = getAllPermissionCodes();
      }
      
      const hasDeletePermission = deletePermissionCodes.includes('users.delete');

      if (!hasDeletePermission) {
        throw new ForbiddenException('Недостаточно прав для удаления этого пользователя');
      }
    }

    return this.userService.delete(normalizedId);
  }

  @Post('filter')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.view'])
  async findAllWithFilters(@Body() request: FilterRequestDto): Promise<FilterResponseDto<any>> {
    const response = await this.userService.findAllWithFilters(request);
    return {
      ...response,
      data: response.data.map(user => toSafeUserDto(user)),
    };
  }

  @Post(':id/block')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.block'])
  @ApiOperation({ summary: 'Заблокировать пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь заблокирован' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Нарушение правил сообщества' },
        blockedUntil: { type: 'string', format: 'date-time', nullable: true, example: null }
      },
      required: ['reason']
    }
  })
  async blockUser(
    @Param('id') id: string,
    @Body() body: { reason: string; blockedUntil?: string },
    @Request() req: any
  ): Promise<User> {
    const normalizedId = this.normalizeUserId(id);
    const normalizedCurrentUserId = this.normalizeUserId(String(req.user.id));

    // Нельзя заблокировать самого себя
    if (normalizedId === normalizedCurrentUserId) {
      throw new ForbiddenException('Нельзя заблокировать самого себя');
    }

    const blockedUntil = body.blockedUntil ? new Date(body.blockedUntil) : undefined;
    return this.userService.blockUser(normalizedId, body.reason, blockedUntil);
  }

  @Post(':id/unblock')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.block'])
  @ApiOperation({ summary: 'Разблокировать пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь разблокирован' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async unblockUser(
    @Param('id') id: string
  ): Promise<User> {
    const normalizedId = this.normalizeUserId(id);
    return this.userService.unblockUser(normalizedId);
  }

  @Post('accept-legal-documents')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Принять юридические документы (для OAuth пользователей)' })
  @ApiResponse({ status: 200, description: 'Документы приняты' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        acceptTerms: { type: 'boolean' },
        acceptPrivacy: { type: 'boolean' },
        confirmAge: { type: 'boolean' }
      },
      required: ['acceptTerms', 'acceptPrivacy', 'confirmAge']
    }
  })
  async acceptLegalDocuments(
    @Body() body: { acceptTerms: boolean; acceptPrivacy: boolean; confirmAge: boolean },
    @Request() req: any
  ): Promise<User> {
    const userId = req.user.id;
    const normalizedId = this.normalizeUserId(String(userId));
    
    if (!body.confirmAge) {
      throw new BadRequestException('Необходимо подтвердить совершеннолетие');
    }
    
    const now = new Date();
    const updatedUser = await this.userService.update(normalizedId, {
      termsAccepted: body.acceptTerms,
      termsAcceptedAt: body.acceptTerms ? now : undefined,
      privacyAccepted: body.acceptPrivacy,
      privacyAcceptedAt: body.acceptPrivacy ? now : undefined,
    });
    
    if (!updatedUser) {
      throw new BadRequestException('Пользователь не найден');
    }
    
    return updatedUser;
  }

}
