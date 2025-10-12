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
