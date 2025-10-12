import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private s3: AWS.S3;

  constructor(private configService: ConfigService) {
    this.s3 = new AWS.S3({
      accessKeyId: this.configService.get<string>('S3_ACCESS_KEY'),
      secretAccessKey: this.configService.get<string>('S3_SECRET_KEY'),
      endpoint: this.configService.get<string>('S3_ENDPOINT'),
      region: this.configService.get<string>('S3_REGION'),
      s3ForcePathStyle: true,
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    key: string,
    bucketName?: string,
  ): Promise<string> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    // Логируем ключ файла для отладки
    this.logger.log(`Uploading file with key: ${key}`);
    
    // Проверяем, что ключ не содержит undefined
    if (key.includes('undefined')) {
      this.logger.error(`Invalid file key detected: ${key}`);
      throw new Error(`Invalid file key: ${key}`);
    }
    
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };

    try {
      const result = await this.s3.upload(uploadParams).promise();
      this.logger.log(`File uploaded successfully: ${result.Location}`);
      return result.Location;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async deleteFile(key: string, bucketName?: string): Promise<void> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    const deleteParams: AWS.S3.DeleteObjectRequest = {
      Bucket: bucket,
      Key: key,
    };

    try {
      await this.s3.deleteObject(deleteParams).promise();
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async deleteFolder(folderPath: string, bucketName?: string): Promise<void> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    // Убеждаемся, что путь заканчивается на /
    const folderKey = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    
    try {
      // Получаем все объекты в папке
      const listParams: AWS.S3.ListObjectsV2Request = {
        Bucket: bucket,
        Prefix: folderKey,
      };

      const result = await this.s3.listObjectsV2(listParams).promise();
      
      if (result.Contents && result.Contents.length > 0) {
        // Удаляем все объекты в папке
        const deleteParams: AWS.S3.DeleteObjectsRequest = {
          Bucket: bucket,
          Delete: {
            Objects: result.Contents.map(obj => ({ Key: obj.Key! })),
            Quiet: false,
          },
        };

        const deleteResult = await this.s3.deleteObjects(deleteParams).promise();
        this.logger.log(`Deleted ${deleteResult.Deleted?.length || 0} objects from folder: ${folderKey}`);
        
        if (deleteResult.Errors && deleteResult.Errors.length > 0) {
          this.logger.error(`Errors deleting objects: ${JSON.stringify(deleteResult.Errors)}`);
        }
      } else {
        this.logger.log(`No objects found in folder: ${folderKey}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getFile(key: string, bucketName?: string): Promise<Buffer> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    const getParams: AWS.S3.GetObjectRequest = {
      Bucket: bucket,
      Key: key,
    };

    try {
      const result = await this.s3.getObject(getParams).promise();
      if (result.Body) {
        return result.Body as Buffer;
      } else {
        throw new Error('File body is empty');
      }
    } catch (error) {
      this.logger.error(`Error getting file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getFileStream(key: string, bucketName?: string): Promise<NodeJS.ReadableStream> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    const getParams: AWS.S3.GetObjectRequest = {
      Bucket: bucket,
      Key: key,
    };

    try {
      const result = await this.s3.getObject(getParams).promise();
      if (result.Body) {
        // Создаем поток из буфера
        const { Readable } = require('stream');
        const stream = new Readable();
        stream.push(result.Body);
        stream.push(null);
        return stream;
      } else {
        throw new Error('File body is empty');
      }
    } catch (error) {
      this.logger.error(`Error getting file stream: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async listFiles(prefix?: string, bucketName?: string): Promise<AWS.S3.Object[]> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    const listParams: AWS.S3.ListObjectsV2Request = {
      Bucket: bucket,
      Prefix: prefix,
    };

    try {
      const result = await this.s3.listObjectsV2(listParams).promise();
      return result.Contents || [];
    } catch (error) {
      this.logger.error(`Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getFileUrl(key: string, bucketName?: string): Promise<string> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    const endpoint = this.configService.get<string>('S3_ENDPOINT') || '';
    
    return `${endpoint}/${bucket}/${key}`;
  }

  async createFolder(folderPath: string, bucketName?: string): Promise<void> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    // В S3 папки создаются автоматически при загрузке файлов
    // Но можно создать "пустой" объект для имитации папки
    const folderKey = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    
    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: bucket,
      Key: folderKey,
      Body: '',
      ContentType: 'application/x-directory',
    };

    try {
      await this.s3.upload(uploadParams).promise();
      this.logger.log(`Folder created successfully: ${folderKey}`);
    } catch (error) {
      this.logger.error(`Error creating folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async getFileTree(prefix?: string, bucketName?: string): Promise<any[]> {
    const bucket = bucketName || this.configService.get<string>('S3_BUCKET') || '';
    
    const listParams: AWS.S3.ListObjectsV2Request = {
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
    };

    try {
      const result = await this.s3.listObjectsV2(listParams).promise();
      
      const tree: any[] = [];
      
      // Добавляем папки
      if (result.CommonPrefixes) {
        for (const prefixItem of result.CommonPrefixes) {
          const folderName = prefixItem.Prefix?.replace(prefix || '', '').replace('/', '');
          if (folderName) {
            tree.push({
              name: folderName,
              type: 'folder',
              path: prefixItem.Prefix,
              children: await this.getFileTree(prefixItem.Prefix, bucket),
            });
          }
        }
      }
      
      // Добавляем файлы
      if (result.Contents) {
        for (const object of result.Contents) {
          if (object.Key && !object.Key.endsWith('/')) {
            const fileName = object.Key.split('/').pop();
            if (fileName) {
              tree.push({
                name: fileName,
                type: 'file',
                path: object.Key,
                size: object.Size,
                lastModified: object.LastModified,
                url: await this.getFileUrl(object.Key, bucket),
              });
            }
          }
        }
      }
      
      return tree;
    } catch (error) {
      this.logger.error(`Error getting file tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
