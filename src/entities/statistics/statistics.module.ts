import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UserModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
