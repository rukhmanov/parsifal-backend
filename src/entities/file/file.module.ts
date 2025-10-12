import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { S3Service } from '../../common/services/s3.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [FileController],
  providers: [S3Service],
  exports: [S3Service],
})
export class FileModule {}
