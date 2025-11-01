import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { S3Service } from '../../common/services/s3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from '../user/user.service';
import { JwtPayload } from '../auth/auth.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(
    private readonly s3Service: S3Service,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}


  @Post('upload')
  @ApiOperation({ summary: 'Загрузить файл' })
  @ApiResponse({ status: 201, description: 'Файл успешно загружен' })
  @ApiResponse({ status: 400, description: 'Ошибка загрузки файла' })
  @ApiBearerAuth('JWT-auth')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('path') path: string = '',
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    const fileKey = path ? `${path}/${file.originalname}` : file.originalname;
    
    const fileUrl = await this.s3Service.uploadFile(file, fileKey);
    
    return {
      success: true,
      url: fileUrl,
      key: fileKey,
      filename: file.originalname,
    };
  }

  @Post('upload-user-photo')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadUserPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
    @Body('userId') targetUserId?: string,
  ) {
    if (!file) {
      throw new Error('No photo uploaded');
    }

    // Проверяем, что пользователь аутентифицирован
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    // Определяем ID пользователя для загрузки фото
    let userId: string;
    
    if (targetUserId) {
      // Если передан userId в теле запроса, используем его (для админки)
      userId = targetUserId;
    } else {
      // Иначе используем ID из JWT токена (для редактирования собственного профиля)
      userId = req.user.sub;
      
      if (!userId) {
        throw new Error('User ID not found in token');
      }
    }
    
    const fileKey = `users/${userId}/profile-photo.${file.originalname.split('.').pop()}`;
    
    const fileUrl = await this.s3Service.uploadFile(file, fileKey);
    
    // Обновляем фото пользователя в базе данных
    await this.userService.updateUserPhoto(userId, fileUrl);
    
    return {
      success: true,
      url: fileUrl,
      message: 'Photo updated successfully',
    };
  }

  @Get('tree')
  async getFileTree(@Param('path') path?: string) {
    const tree = await this.s3Service.getFileTree(path);
    return {
      success: true,
      tree,
    };
  }

  @Get('list')
  async listFiles(@Param('path') path?: string) {
    const files = await this.s3Service.listFiles(path);
    return {
      success: true,
      files,
    };
  }

  @Get('download/:key')
  async downloadFile(@Param('key') key: string, @Res() res: any) {
    try {
      // Получаем файл из S3
      const fileData = await this.s3Service.getFile(key);
      const fileName = key.split('/').pop() || 'file';
      
      // Устанавливаем заголовки для принудительного скачивания
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      
      // Отправляем файл
      res.send(fileData);
    } catch (error) {
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }
  }

  @Delete('user-photo')
  async deleteUserPhoto(@Request() req: AuthenticatedRequest) {
    // Проверяем, что пользователь аутентифицирован
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const userId = req.user.sub;
    
    if (!userId) {
      throw new Error('User ID not found in token');
    }

    // Получаем текущего пользователя для проверки наличия фото
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.avatar) {
      return {
        success: true,
        message: 'User has no photo to delete',
      };
    }

    // Извлекаем ключ файла из URL
    const avatarUrl = user.avatar;
    const bucketName = this.configService.get<string>('S3_BUCKET') || '';
    const endpoint = this.configService.get<string>('S3_ENDPOINT') || '';
    const expectedPrefix = `${endpoint}/${bucketName}/`;
    
    let fileKey: string;
    
    if (avatarUrl.startsWith(expectedPrefix)) {
      fileKey = avatarUrl.substring(expectedPrefix.length);
    } else {
      // Fallback: старый способ
      const urlParts = avatarUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part.includes('parsifal-files'));
      
      if (bucketIndex === -1 || bucketIndex >= urlParts.length - 1) {
        throw new Error('Invalid avatar URL format');
      }

      fileKey = urlParts.slice(bucketIndex + 1).join('/');
    }
    
    try {
      // Удаляем файл из S3
      await this.s3Service.deleteFile(fileKey);
      
      // Удаляем папку пользователя, если она пуста
      const userFolder = `users/${userId}`;
      try {
        await this.s3Service.deleteFolder(userFolder);
      } catch (folderError) {
        // Игнорируем ошибки удаления папки - возможно, она уже пуста или не существует
      }
      
      // Обновляем пользователя в базе данных (удаляем ссылку на фото)
      await this.userService.updateUserPhoto(userId, '');
      
      return {
        success: true,
        message: 'User photo deleted successfully',
      };
    } catch (error) {
      // Если удаление файла не удалось, но пользователь существует, 
      // все равно очищаем ссылку в БД
      try {
        await this.userService.updateUserPhoto(userId, '');
      } catch (dbError) {
        throw new Error('Failed to update user photo in database');
      }
      
      return {
        success: true,
        message: 'User photo reference removed from database (file may not exist in storage)',
      };
    }
  }

  @Delete(':key')
  async deleteFile(@Param('key') key: string) {
    await this.s3Service.deleteFile(key);
    return {
      success: true,
      message: 'File deleted successfully',
    };
  }

  @Post('folder')
  async createFolder(@Body('path') path: string) {
    await this.s3Service.createFolder(path);
    return {
      success: true,
      message: 'Folder created successfully',
    };
  }

  @Delete('folder/:path')
  async deleteFolder(@Param('path') path: string) {
    await this.s3Service.deleteFolder(path);
    return {
      success: true,
      message: 'Folder deleted successfully',
    };
  }
}
