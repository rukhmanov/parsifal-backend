import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailNewService } from './email-new.service';

@Module({
  providers: [EmailService, EmailNewService],
  exports: [EmailService, EmailNewService],
})
export class CommonModule {}
