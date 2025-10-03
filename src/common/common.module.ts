import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { EmailNewService } from './email-new.service';

@Module({
  imports: [MailerModule],
  providers: [EmailService, EmailNewService],
  exports: [EmailService, EmailNewService],
})
export class CommonModule {}
