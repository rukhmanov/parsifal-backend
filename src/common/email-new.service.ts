import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailNewService {
  constructor(private readonly mailerService: MailerService) {}

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Сброс пароля - Parsifal',
      template: 'password-reset',
      context: {
        resetUrl,
        appName: 'Parsifal',
        year: new Date().getFullYear(),
      },
    });
  }

  async testEmailConnection(): Promise<boolean> {
    try {
      // Попробуем отправить тестовое письмо себе
      await this.mailerService.sendMail({
        to: process.env.SMTP_USER || 'parsifal-app@mail.ru',
        subject: 'Тест подключения',
        template: 'password-reset',
        context: {
          resetUrl: 'test',
          appName: 'Parsifal Test',
          year: new Date().getFullYear(),
        },
      });
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject: 'Добро пожаловать в Parsifal!',
      template: 'welcome',
      context: {
        name,
        appName: 'Parsifal',
        year: new Date().getFullYear(),
      },
    });
  }
}
