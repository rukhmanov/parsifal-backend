import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { UserModule } from '../user/user.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [UserModule, CommonModule],
  controllers: [FileController],
})
export class FileModule {}
