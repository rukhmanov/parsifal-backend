import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly s3Service: S3Service
  ) {}

  @Get()
  // @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @RequirePermissions(['users.view'])
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.view'])
  async findById(@Param('id') id: string): Promise<User | null> {
    return this.userService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.create'])
  async create(@Body() userData: CreateUserDto): Promise<User> {
    return this.userService.create(userData as Partial<User>);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('photo'))
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() userData: UpdateUserDto,
    @UploadedFile() photo?: Express.Multer.File,
    @Request() req?: any
  ): Promise<User | null> {
    // Отладочная информация
    console.log('=== UserController Update Debug ===');
    console.log('User ID:', id);
    console.log('User data received:', JSON.stringify(userData, null, 2));
    console.log('Photo file:', photo ? photo.originalname : 'No photo');
    
    // Проверяем самообновление после обработки FileInterceptor
    const user = req.user;
    if (user && user.id === id) {
      console.log('=== Self-update detected ===');
      
      // Это самообновление - проверяем разрешенные поля
      const currentUser = await this.userService.findById(id);
      if (!currentUser) {
        throw new ForbiddenException('Пользователь не найден');
      }

      const allowedFields = ['firstName', 'lastName', 'displayName', 'avatar'];
      const restrictedFields = ['email', 'roleId', 'isActive', 'authProvider', 'providerId'];

      console.log('Current user data:', {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        displayName: currentUser.displayName,
        roleId: currentUser.roleId,
        isActive: currentUser.isActive
      });

      // Проверяем, что не изменяются запрещенные поля (только если они действительно изменились)
      for (const field of restrictedFields) {
        if (field in userData) {
          const currentValue = currentUser[field as keyof User];
          let newValue = userData[field as keyof UpdateUserDto];
          
          // Преобразуем строковые значения для корректного сравнения
          if (field === 'isActive' && typeof newValue === 'string') {
            newValue = newValue === 'true' as any;
          }
          
          console.log(`Checking restricted field ${field}:`, {
            current: currentValue,
            new: newValue,
            changed: currentValue !== newValue
          });
          
          // Проверяем только если значение действительно изменилось
          if (currentValue !== newValue) {
            throw new ForbiddenException(`Нельзя изменять поле: ${field}`);
          }
        }
      }

      // Проверяем, что изменяется хотя бы одно разрешенное поле
      const changedFields: string[] = [];
      for (const field of allowedFields) {
        if (field in userData) {
          const currentValue = currentUser[field as keyof User];
          let newValue = userData[field as keyof UpdateUserDto];
          
          // Преобразуем строковые значения для корректного сравнения
          if (field === 'isActive' && typeof newValue === 'string') {
            newValue = newValue === 'true' as any;
          }
          
          console.log(`Checking allowed field ${field}:`, {
            current: currentValue,
            new: newValue,
            changed: currentValue !== newValue
          });
          
          if (currentValue !== newValue) {
            changedFields.push(field);
          }
        }
      }

      console.log('Changed fields:', changedFields);
      console.log('Photo uploaded:', !!photo);

      if (changedFields.length === 0 && !photo) {
        throw new ForbiddenException('Необходимо указать хотя бы одно разрешенное поле для обновления');
      }

      console.log('Self-update validation passed');
      // Устанавливаем флаг, что самообновление разрешено
      req.selfUpdateAllowed = true;
    }

    let updateData = { ...userData };
    
    // Преобразуем строковые значения в правильные типы
    if (typeof updateData.isActive === 'string') {
      updateData.isActive = updateData.isActive === 'true';
    }
    
    // Если загружено фото, обрабатываем его
    if (photo) {
      const fileKey = `users/${id}/profile-photo.${photo.originalname.split('.').pop()}`;
      const fileUrl = await this.s3Service.uploadFile(photo, fileKey);
      updateData.avatar = fileUrl;
    }
    
    return this.userService.update(id, updateData);
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

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(['users.reactivate'])
  @HttpCode(HttpStatus.OK)
  async reactivateUser(@Param('id') id: string): Promise<User | null> {
    return this.userService.reactivateUser(id);
  }

}
