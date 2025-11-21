import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { EmailNewService } from './email-new.service';
import { FilterService } from './services/filter.service';
import { ProfanityFilterService } from './services/profanity-filter.service';
import { S3Service } from './services/s3.service';
import { PasswordGeneratorService } from './services/password-generator.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [MailerModule],
  providers: [EmailService, EmailNewService, FilterService, ProfanityFilterService, S3Service, PasswordGeneratorService, PermissionsGuard],
  exports: [EmailService, EmailNewService, FilterService, ProfanityFilterService, S3Service, PasswordGeneratorService, PermissionsGuard],
})
export class CommonModule {}
