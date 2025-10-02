import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    // Создаем transporter для отправки писем
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true для порта 465, false для других портов
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    const mailOptions = {
      from: process.env.FROM_EMAIL || process.env.SMTP_USER,
      to: to,
      subject: '🔄 Сброс пароля - Parsifal',
      html: this.getPasswordResetTemplate(resetUrl),
      text: this.getPasswordResetText(resetUrl), // Для клиентов без поддержки HTML
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Reset link for development:', resetUrl);
      }
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Не удалось отправить email для сброса пароля');
    }
  }

  private getPasswordResetTemplate(resetUrl: string): string {
    return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Сброс пароля</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .email-container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 10px;
            }
            h2 {
                color: #333;
                margin-bottom: 20px;
            }
            .btn {
                display: inline-block;
                padding: 15px 30px;
                background-color: #007bff;
                color: white !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: bold;
                margin: 20px 0;
                text-align: center;
                transition: background-color 0.3s;
            }
            .btn:hover {
                background-color: #0056b3;
            }
            .warning {
                background-color: #f8d7da;
                color: #721c24;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                border-left: 4px solid #dc3545;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 14px;
                color: #666;
                text-align: center;
            }
            .code {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                font-family: 'Courier New', monospace;
                word-break: break-all;
                margin: 15px 0;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="logo">🎭 Parsifal</div>
            </div>
            
            <h2>🔄 Сброс пароля</h2>
            
            <p>Здравствуйте!</p>
            
            <p>Вы получили это письмо, потому что кто-то запросил сброс пароля для вашего аккаунта в Parsifal.</p>
            
            <p>Если это вы - нажмите на кнопку ниже для создания нового пароля:</p>
            
            <div style="text-align: center;">
                <a href="${resetUrl}" class="btn">🔐 Сбросить пароль</a>
            </div>
            
            <div class="warning">
                ⚠️ <strong>Важная информация:</strong>
                <ul>
                    <li>Эта ссылка действительна только в течение <strong>1 часа</strong></li>
                    <li>После использования ссылка станет недоступной</li>
                    <li>Если вы не запрашивали сброс пароля - проигнорируйте это письмо</li>
                </ul>
            </div>
            
            <p><strong>Если кнопка не работает</strong>, скопируйте и вставьте эту ссылку в браузер:</p>
            
            <div class="code">${resetUrl}</div>
            
            <div class="footer">
                <p>С уважением,<br>Команда Parsifal</p>
                <p>Если у вас есть вопросы, обратитесь в службу поддержки</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private getPasswordResetText(resetUrl: string): string {
    return `
Сброс пароля Parsifal

Здравствуйте!

Вы получили это письмо, потому что запросили сброс пароля для вашего аккаунта в Parsifal.

Для сброса пароля перейдите по ссылке:
${resetUrl}

ВАЖНО:
- Эта ссылка действительна только 1 час
- После использования ссылка станет недоступной
- Если вы не запрашивали сброс пароля - проигнорируйте это письмо

С уважением,
Команда Parsifal
    `;
  }

  // Метод для тестирования email сервиса
  async testEmailConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Email service is ready');
      return true;
    } catch (error) {
      console.error('❌ Email service error:', error);
      return false;
    }
  }
}
