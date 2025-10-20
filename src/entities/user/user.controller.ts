import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { User } from './user.entity';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';
import { S3Service } from '../../common/services/s3.service';

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
  async findAll(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<User | null> {
    return this.userService.findById(id);
  }

  @Post()
  async create(@Body() userData: CreateUserDto): Promise<User> {
    return this.userService.create(userData as Partial<User>);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() userData: UpdateUserDto
  ): Promise<User | null> {
    return this.userService.update(id, userData);
  }

  @Put(':id/with-photo')
  @UseInterceptors(FileInterceptor('photo'))
  async updateWithPhoto(
    @Param('id') id: string,
    @Body() userData: UpdateUserDto,
    @UploadedFile() photo?: Express.Multer.File
  ): Promise<User | null> {
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    return this.userService.delete(id);
  }

  @Post('filter')
  async findAllWithFilters(@Body() request: FilterRequestDto): Promise<FilterResponseDto<User>> {
    return this.userService.findAllWithFilters(request);
  }

}
