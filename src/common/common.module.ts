import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { EmailNewService } from './email-new.service';
import { FilterService } from './services/filter.service';
import { S3Service } from './services/s3.service';
import { PasswordGeneratorService } from './services/password-generator.service';

@Module({
  imports: [MailerModule],
  providers: [EmailService, EmailNewService, FilterService, S3Service, PasswordGeneratorService],
  exports: [EmailService, EmailNewService, FilterService, S3Service, PasswordGeneratorService],
})
export class CommonModule {}
