import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class ModernEmailService {
  constructor(private mailerService: MailerService) {}

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: to,
        subject: 'Сброс пароля - Parsifal',
        template: './password-reset', // будет искать в views/password-reset.hbs
        context: {
          resetUrl: resetUrl,
          username: to.split('@')[0], // извлекаем имя пользователя из email
        },
      });
    } catch (error) {
      console.error('❌ Error sending email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async testEmailConnection(): Promise<boolean> {
    try {
      // Попробуем отправить тестовое письмо
      await this.mailerService.sendMail({
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email to verify SMTP configuration',
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
