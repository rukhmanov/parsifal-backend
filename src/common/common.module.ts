import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { EmailNewService } from './email-new.service';
import { FilterService } from './services/filter.service';

@Module({
  imports: [MailerModule],
  providers: [EmailService, EmailNewService, FilterService],
  exports: [EmailService, EmailNewService, FilterService],
})
export class CommonModule {}
