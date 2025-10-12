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
import { FileInterceptor } from '@nestjs/platform-express';
import { S3Service } from '../../common/services/s3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from '../user/user.service';
import { JwtPayload } from '../auth/auth.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(
    private readonly s3Service: S3Service,
    private readonly userService: UserService,
  ) {}


  @Post('upload')
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
  ) {
    if (!file) {
      throw new Error('No photo uploaded');
    }

    // Проверяем, что пользователь аутентифицирован
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const userId = req.user.sub;
    
    if (!userId) {
      throw new Error('User ID not found in token');
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
